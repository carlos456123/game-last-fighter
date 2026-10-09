import { RESERVED_KEYS } from '@/config/gameConfig';
import { ALL_ACTIONS, type ActionId, type ControlBindings } from '@/types';

export const actionsForCode = (bindings: ControlBindings, code: string): ActionId[] =>
  ALL_ACTIONS.filter((a) => bindings[a].includes(code));

export interface RebindResult {
  bindings: ControlBindings;
  /** Action that previously owned the key and received the old key in exchange. */
  swappedWith: ActionId | null;
  rejected: boolean;
}

const clone = (b: ControlBindings): ControlBindings => {
  const out = {} as ControlBindings;
  for (const a of ALL_ACTIONS) out[a] = [...b[a]];
  return out;
};

/**
 * Sets the primary key of an action. If another action used that key, the two are swapped so
 * no key is ever bound to two actions and no action is left without a key.
 */
export const rebind = (bindings: ControlBindings, action: ActionId, code: string): RebindResult => {
  if (RESERVED_KEYS.has(code)) return { bindings, swappedWith: null, rejected: true };
  const next = clone(bindings);
  const old = next[action][0];
  let swappedWith: ActionId | null = null;
  for (const other of ALL_ACTIONS) {
    if (other === action) continue;
    const idx = next[other].indexOf(code);
    if (idx === -1) continue;
    swappedWith = other;
    if (old && !next[other].includes(old)) next[other][idx] = old;
    else next[other].splice(idx, 1);
  }
  next[action] = [code, ...next[action].filter((c) => c !== code && c !== old)];
  return { bindings: next, swappedWith, rejected: false };
};

/** Finds keys bound to more than one action (should always be empty after `rebind`). */
export const findConflicts = (bindings: ControlBindings): string[] => {
  const seen = new Map<string, number>();
  for (const a of ALL_ACTIONS) for (const c of bindings[a]) seen.set(c, (seen.get(c) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c);
};

const SPECIAL_LABELS: Record<string, string> = {
  Space: 'keys.space',
  Escape: 'keys.escape',
  Enter: 'keys.enter',
  ShiftLeft: 'keys.shift',
  ShiftRight: 'keys.shift',
  ControlLeft: 'keys.ctrl',
  ControlRight: 'keys.ctrl',
  AltLeft: 'keys.alt',
  AltRight: 'keys.alt',
  Backspace: 'keys.backspace',
};
const ARROWS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

/** Human readable key label. Returns literal text, or a locale key prefixed with "@". */
export const keyLabel = (code: string): string => {
  if (ARROWS[code]) return ARROWS[code];
  if (SPECIAL_LABELS[code]) return `@${SPECIAL_LABELS[code]}`;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
};
