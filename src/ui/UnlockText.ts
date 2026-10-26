import type { LocalizationManager } from '@/systems/LocalizationManager';
import { isUnlocked, unlockProgress } from '@/systems/ProgressionManager';
import type { SaveData } from '@/systems/SaveManager';
import type { FighterData } from '@/types';

/** Human readable unlock requirement and progress for a fighter (e.g. "Faça 10 esquivas perfeitas", "6/10"). */
export const unlockText = (
  i18n: LocalizationManager,
  save: SaveData,
  fighter: FighterData,
): { requirement: string; progress: string; ratio: number; unlocked: boolean } => {
  const rule = fighter.unlock;
  const { current, required } = unlockProgress(save, fighter);
  const params: Record<string, number> = { count: required, level: required, current };
  return {
    requirement: rule.type === 'default' ? '' : i18n.t(`unlock.${rule.type}`, params),
    progress: required > 0 ? `${current}/${required}` : '',
    ratio: required > 0 ? current / required : 1,
    unlocked: isUnlocked(save, fighter),
  };
};
