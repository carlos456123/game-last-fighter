import type { FighterData } from '@/types';
import { BRONN } from './bronn';
import { KAEL } from './kael';
import { NYX } from './nyx';

/** Roster registry. Adding a fighter = create its data file and list it here. */
export const FIGHTERS: readonly FighterData[] = [KAEL, BRONN, NYX];
