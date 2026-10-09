import type { MusicId } from '@/types';

/**
 * Procedural music definitions. Patterns are 16 steps per bar; melodic lines are scale degrees
 * (null = rest). These are original compositions generated at runtime by the synthesizer.
 */
export interface TrackDef {
  bpm: number;
  /** MIDI note of the root. */
  root: number;
  /** Scale as semitone offsets. */
  scale: number[];
  kick: string;
  snare: string;
  hat: string;
  /** One entry per step, for each bar (bars repeat cyclically). */
  bass: Array<Array<number | null>>;
  lead: Array<Array<number | null>>;
  /** Chord (scale degrees) per bar, held as a pad. */
  pads: number[][];
  leadWave: OscillatorType;
  intensity: number;
}

const _ = null;
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

export const TRACKS: Record<Exclude<MusicId, 'victory'>, TrackDef> = {
  menu: {
    bpm: 92,
    root: 57,
    scale: MINOR,
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: [
      [0, _, _, _, 0, _, _, _, 0, _, _, _, 0, _, 4, _],
      [5, _, _, _, 5, _, _, _, 5, _, _, _, 5, _, 4, _],
      [2, _, _, _, 2, _, _, _, 2, _, _, _, 2, _, 1, _],
      [4, _, _, _, 4, _, _, _, 6, _, _, _, 6, _, 4, _],
    ],
    lead: [
      [_, _, _, _, 7, _, _, 9, _, _, 8, _, _, _, _, _],
      [_, _, _, _, 7, _, _, 5, _, _, 4, _, _, _, _, _],
      [_, _, _, _, 9, _, _, 10, _, _, 9, _, _, _, 7, _],
      [_, _, _, _, 8, _, _, 7, _, _, 6, _, _, _, _, _],
    ],
    pads: [
      [0, 2, 4],
      [5, 7, 9],
      [2, 4, 6],
      [4, 6, 8],
    ],
    leadWave: 'triangle',
    intensity: 0.7,
  },
  battle_colosseum: {
    bpm: 132,
    root: 50,
    scale: PHRYGIAN,
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'x.x.x.x.x.x.x.xx',
    bass: [
      [0, _, 0, 0, _, 0, 1, _, 0, _, 0, 0, _, 3, 1, _],
      [0, _, 0, 0, _, 0, 1, _, 0, _, 0, 0, _, 4, 3, _],
      [5, _, 5, 5, _, 5, 4, _, 3, _, 3, 3, _, 1, 0, _],
      [0, _, 0, 0, _, 0, 1, _, 0, _, 0, 0, 1, 1, 3, 4],
    ],
    lead: [
      [7, _, _, 8, _, _, 7, _, 5, _, _, _, 3, _, _, _],
      [7, _, _, 8, _, _, 10, _, 8, _, 7, _, _, _, _, _],
      [12, _, _, 11, _, _, 10, _, 8, _, _, _, 7, _, 8, _],
      [7, _, 5, _, 3, _, 1, _, 0, _, _, _, _, _, _, _],
    ],
    pads: [
      [0, 2, 4],
      [0, 2, 4],
      [5, 7, 9],
      [1, 3, 5],
    ],
    leadWave: 'sawtooth',
    intensity: 1,
  },
  battle_neon: {
    bpm: 140,
    root: 52,
    scale: MINOR,
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: '.xx.xx.xx.xx.xx.',
    bass: [
      [0, 0, 7, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 7, 0, 3],
      [5, 5, 12, 5, 5, 12, 5, 5, 5, 5, 12, 5, 5, 12, 5, 4],
      [3, 3, 10, 3, 3, 10, 3, 3, 3, 3, 10, 3, 3, 10, 3, 3],
      [4, 4, 11, 4, 4, 11, 4, 4, 6, 6, 13, 6, 6, 13, 6, 4],
    ],
    lead: [
      [7, _, 9, _, 10, _, 9, _, 7, _, _, _, 4, _, _, _],
      [7, _, 9, _, 10, _, 12, _, 11, _, _, _, 9, _, _, _],
      [10, _, 9, _, 7, _, 9, _, 10, _, _, _, 12, _, _, _],
      [11, _, _, _, 9, _, _, _, 8, _, 9, _, 11, _, _, _],
    ],
    pads: [
      [0, 2, 4],
      [5, 7, 9],
      [3, 5, 7],
      [4, 6, 8],
    ],
    leadWave: 'square',
    intensity: 0.95,
  },
};

export const degreeToMidi = (track: TrackDef, degree: number): number => {
  const len = track.scale.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return track.root + octave * 12 + track.scale[idx];
};

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
