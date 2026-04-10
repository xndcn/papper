import { SCENE_KEYS } from '@/config/constants';

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export interface SceneNavigationButton {
  readonly label: string;
  readonly target: SceneKey;
}

export interface ResultSceneData {
  readonly distance: number;
  readonly flightTimeMs: number;
  readonly summary: string;
}
