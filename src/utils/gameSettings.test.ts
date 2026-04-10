import { describe, expect, it } from 'vitest';

import {
  GAME_BACKGROUND_COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  resolveMatterDebug,
} from '@/utils/gameSettings';

describe('gameSettings', () => {
  it('uses the documented internal resolution and default background', () => {
    expect(GAME_WIDTH).toBe(480);
    expect(GAME_HEIGHT).toBe(270);
    expect(GAME_BACKGROUND_COLOR).toBe('#0f172a');
  });

  it('mirrors the development flag for Matter debug rendering', () => {
    expect(resolveMatterDebug(true)).toBe(true);
    expect(resolveMatterDebug(false)).toBe(false);
  });
});
