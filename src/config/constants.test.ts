import { describe, expect, it } from 'vitest';

import {
  GAME_BACKGROUND_COLOR,
  GAME_GRAVITY,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENE_KEYS,
  SCENE_TRANSITIONS,
} from '@/config/constants';

describe('config constants', () => {
  it('defines the documented base game settings', () => {
    expect(GAME_WIDTH).toBe(480);
    expect(GAME_HEIGHT).toBe(270);
    expect(GAME_BACKGROUND_COLOR).toBe('#0f172a');
    expect(GAME_GRAVITY).toEqual({ x: 0, y: 0.5 });
  });

  it('defines the Step 2 scene flow loop', () => {
    expect(SCENE_TRANSITIONS[SCENE_KEYS.BOOT]).toEqual([SCENE_KEYS.PRELOAD]);
    expect(SCENE_TRANSITIONS[SCENE_KEYS.PRELOAD]).toEqual([SCENE_KEYS.MAIN_MENU]);
    expect(SCENE_TRANSITIONS[SCENE_KEYS.MAIN_MENU]).toEqual([SCENE_KEYS.BUILD]);
    expect(SCENE_TRANSITIONS[SCENE_KEYS.BUILD]).toEqual([SCENE_KEYS.RACE]);
    expect(SCENE_TRANSITIONS[SCENE_KEYS.RACE]).toEqual([SCENE_KEYS.RESULT]);
    expect(SCENE_TRANSITIONS[SCENE_KEYS.RESULT]).toEqual([SCENE_KEYS.MAIN_MENU]);
  });
});
