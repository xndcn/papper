export {
  GAME_BACKGROUND_COLOR,
  GAME_GRAVITY,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/config/constants';

export function resolveMatterDebug(isDevelopment: boolean): boolean {
  return isDevelopment;
}
