import type { Opponent } from '@/types';

const BOSS_OPPONENT_IDS = new Set(['gale_lin', 'ace_yun']);

export function isBossOpponent(opponent: Opponent): boolean {
  return BOSS_OPPONENT_IDS.has(opponent.id);
}
