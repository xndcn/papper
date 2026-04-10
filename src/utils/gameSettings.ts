export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const GAME_BACKGROUND_COLOR = '#0f172a';
export const GAME_GRAVITY = { x: 0, y: 0.5 } as const;

export function resolveMatterDebug(isDevelopment: boolean): boolean {
  return isDevelopment;
}
