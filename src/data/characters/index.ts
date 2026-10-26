import type { FighterData } from '@/types';
import { AYAME } from './ayame';
import { BRONN } from './bronn';
import { DANTE } from './dante';
import { HAN } from './han';
import { KAEL } from './kael';
import { NYX } from './nyx';
import { R0N } from './r0n';
import { VALKYRIE } from './valkyrie';
import { VESPER } from './vesper';

/** Roster registry, in unlock order. Adding a fighter = create its data file and list it here. */
export const FIGHTERS: readonly FighterData[] = [KAEL, BRONN, NYX, AYAME, HAN, R0N, VESPER, DANTE, VALKYRIE];
