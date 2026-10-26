import { Rng } from '@/utils/MathUtils';

/**
 * Torneio da Última Arena: single-elimination bracket with 8 unique fighters
 * (quarterfinals, semifinals, final). Pure logic: no Phaser, fully testable and serialisable.
 * The player always occupies slot 0. AI-vs-AI matches are resolved by a weighted coin flip.
 */
export interface TournamentMatch {
  /** Participant slots. */
  a: number;
  b: number;
  winner: number | null;
  arenaId: string;
}

export type TournamentStatus = 'active' | 'eliminated' | 'champion';

export interface TournamentState {
  edition: number;
  seed: number;
  playerId: string;
  participants: string[];
  rounds: TournamentMatch[][];
  round: number;
  status: TournamentStatus;
}

export const TOURNAMENT = {
  size: 8,
  rounds: 3,
  finalArena: 'sanctuary',
  roundKeys: ['quarter', 'semi', 'final'] as const,
} as const;

export type RoundKey = (typeof TOURNAMENT.roundKeys)[number];

export const roundKey = (round: number): RoundKey => TOURNAMENT.roundKeys[Math.min(round, 2)];

/**
 * Creates a new edition. The 8 other fighters are rotated so one different fighter sits out
 * each edition; the remaining 7 are shuffled with the edition seed.
 */
export const createTournament = (
  playerId: string,
  roster: readonly string[],
  arenaIds: readonly string[],
  edition: number,
  seed: number,
): TournamentState => {
  const others = roster.filter((id) => id !== playerId);
  if (others.length < TOURNAMENT.size - 1) throw new Error('Not enough fighters for a tournament');
  const excluded = others.length > TOURNAMENT.size - 1 ? others[edition % others.length] : null;
  const pool = others.filter((id) => id !== excluded);
  const rng = new Rng(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const participants = [playerId, ...pool.slice(0, TOURNAMENT.size - 1)];
  const early = arenaIds.filter((a) => a !== TOURNAMENT.finalArena);
  const arenaFor = (i: number): string =>
    early[(i + edition) % Math.max(1, early.length)] ?? TOURNAMENT.finalArena;
  const quarter: TournamentMatch[] = [0, 2, 4, 6].map((a, i) => ({
    a,
    b: a + 1,
    winner: null,
    arenaId: arenaFor(i),
  }));
  return { edition, seed, playerId, participants, rounds: [quarter], round: 0, status: 'active' };
};

export const playerMatch = (state: TournamentState): TournamentMatch | null => {
  if (state.status !== 'active') return null;
  return state.rounds[state.round]?.find((m) => m.a === 0 || m.b === 0) ?? null;
};

export const opponentSlot = (m: TournamentMatch): number => (m.a === 0 ? m.b : m.a);

export const currentOpponent = (state: TournamentState): string | null => {
  const m = playerMatch(state);
  return m ? state.participants[opponentSlot(m)] : null;
};

export type StrengthFn = (fighterId: string) => number;

const simulate = (state: TournamentState, m: TournamentMatch, strength: StrengthFn, rng: Rng): number => {
  const sa = Math.max(1, strength(state.participants[m.a]));
  const sb = Math.max(1, strength(state.participants[m.b]));
  return rng.next() < sa / (sa + sb) ? m.a : m.b;
};

const nextRound = (round: TournamentMatch[]): TournamentMatch[] => {
  const winners = round.map((m) => m.winner as number);
  const isFinal = winners.length === 2;
  const out: TournamentMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    out.push({
      a: winners[i],
      b: winners[i + 1],
      winner: null,
      arenaId: isFinal ? TOURNAMENT.finalArena : round[i + 1].arenaId,
    });
  }
  return out;
};

/**
 * Applies the result of the player's current match. Other matches of the round are simulated,
 * and the next round is generated. Losing ends the edition; the rest of the bracket is still
 * simulated so the player can see who became champion.
 * Returns true when this result made the player champion.
 */
export const resolvePlayerMatch = (state: TournamentState, won: boolean, strength: StrengthFn): boolean => {
  const m = playerMatch(state);
  if (!m) return false;
  const rng = new Rng(state.seed + 7919 * (state.round + 1));
  m.winner = won ? 0 : opponentSlot(m);
  for (const other of state.rounds[state.round]) {
    if (other.winner === null) other.winner = simulate(state, other, strength, rng);
  }
  if (!won) {
    state.status = 'eliminated';
    while (state.rounds.length < TOURNAMENT.rounds) {
      const next = nextRound(state.rounds[state.rounds.length - 1]);
      for (const n of next) n.winner = simulate(state, n, strength, rng);
      state.rounds.push(next);
    }
    return false;
  }
  if (state.round >= TOURNAMENT.rounds - 1) {
    state.status = 'champion';
    return true;
  }
  state.rounds.push(nextRound(state.rounds[state.round]));
  state.round++;
  return false;
};

/** Champion slot of a finished bracket, if any. */
export const championOf = (state: TournamentState): string | null => {
  const final = state.rounds[TOURNAMENT.rounds - 1]?.[0];
  return final && final.winner !== null ? state.participants[final.winner] : null;
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSlot = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < TOURNAMENT.size;

/** Validates a stored tournament. Anything inconsistent is discarded (a new edition can be started). */
export const sanitizeTournament = (raw: unknown, known: Set<string>): TournamentState | null => {
  if (!isObject(raw)) return null;
  const { participants, rounds } = raw;
  if (!Array.isArray(participants) || participants.length !== TOURNAMENT.size) return null;
  if (!participants.every((p) => typeof p === 'string' && known.has(p))) return null;
  if (new Set(participants).size !== TOURNAMENT.size) return null;
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > TOURNAMENT.rounds) return null;
  const clean: TournamentMatch[][] = [];
  for (const r of rounds) {
    if (!Array.isArray(r)) return null;
    const matches: TournamentMatch[] = [];
    for (const m of r) {
      if (!isObject(m) || !isSlot(m.a) || !isSlot(m.b) || typeof m.arenaId !== 'string') return null;
      if (m.winner !== null && m.winner !== m.a && m.winner !== m.b) return null;
      matches.push({ a: m.a, b: m.b, winner: m.winner as number | null, arenaId: m.arenaId });
    }
    clean.push(matches);
  }
  const status = raw.status === 'champion' || raw.status === 'eliminated' ? raw.status : 'active';
  const round =
    typeof raw.round === 'number' ? Math.max(0, Math.min(clean.length - 1, Math.floor(raw.round))) : 0;
  return {
    edition: typeof raw.edition === 'number' ? raw.edition : 0,
    seed: typeof raw.seed === 'number' ? raw.seed : 1,
    playerId: participants[0] as string,
    participants: participants as string[],
    rounds: clean,
    round,
    status,
  };
};
