export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const GAME_BACKGROUND_COLOR = '#0f172a';
export const GAME_GRAVITY = { x: 0, y: 0.5 } as const;
export const MIN_STAT_VALUE = 1;
export const MAX_STAT_VALUE = 10;

export const GAME_CENTER_X = GAME_WIDTH / 2;
export const GAME_CENTER_Y = GAME_HEIGHT / 2;
export const SCENE_FONT_FAMILY = '"Noto Sans SC", "Microsoft YaHei", sans-serif';

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  RACE: 'RaceScene',
  RESULT: 'ResultScene',
} as const;

export const SCENE_TRANSITIONS = {
  [SCENE_KEYS.BOOT]: [SCENE_KEYS.PRELOAD],
  [SCENE_KEYS.PRELOAD]: [SCENE_KEYS.MAIN_MENU],
  [SCENE_KEYS.MAIN_MENU]: [SCENE_KEYS.RACE],
  [SCENE_KEYS.RACE]: [SCENE_KEYS.RESULT],
  [SCENE_KEYS.RESULT]: [SCENE_KEYS.MAIN_MENU],
} as const;

export const SCENE_TITLE_STYLE = {
  color: '#f8fafc',
  fontFamily: SCENE_FONT_FAMILY,
  fontSize: '24px',
} as const;

export const SCENE_SUBTITLE_STYLE = {
  color: '#cbd5e1',
  fontFamily: SCENE_FONT_FAMILY,
  fontSize: '12px',
} as const;

export const SCENE_BUTTON_STYLE = {
  backgroundColor: '#1d4ed8',
  color: '#f8fafc',
  fontFamily: SCENE_FONT_FAMILY,
  fontSize: '14px',
  padding: {
    x: 18,
    y: 10,
  },
} as const;

export const SCENE_HINT_STYLE = {
  color: '#94a3b8',
  fontFamily: SCENE_FONT_FAMILY,
  fontSize: '10px',
} as const;
