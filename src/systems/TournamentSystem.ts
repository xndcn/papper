import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { getOpponents, getParts, getSkills, getWeatherPresets } from '@/systems/ContentLoader';
import { selectWeather } from '@/systems/WeatherSystem';
import type {
  EventData,
  Opponent,
  Part,
  RaceConfig,
  RaceResult,
  Reward,
  Skill,
  TournamentMap,
  TournamentNode,
  TournamentNodeType,
  TournamentRun,
} from '@/types';
import { createRNG, randomInt, shuffle, weightedChoice } from '@/utils/SeedManager';

const DEFAULT_LAYER_COUNT = 5;
const MIN_NODES_PER_LAYER = 2;
const MAX_NODES_PER_LAYER = 3;
const HORIZONTAL_LAYER_PADDING = 40;
const LAYER_VERTICAL_PADDING = 40;
const NODE_TYPE_OPTIONS = ['race', 'shop', 'event', 'elite'] as const;
const NODE_TYPE_WEIGHTS = [6, 2, 2, 1] as const;
const MIN_BASE_DIFFICULTY = 2;
const BASE_DIFFICULTY_RANGE = 6;
const CLASS_BOSS_DIFFICULTY = 7;
const VICTORY_BONUS_COINS = 60;
const DEFEAT_BONUS_COINS = 20;
const BASE_OPPONENT_WEIGHT = 6;
const FNV_PRIME_32 = 16777619;
const NON_BOSS_SELECTION_PENALTY = 8;

export function createTournamentRun(seed: number, layerCount = DEFAULT_LAYER_COUNT): TournamentRun {
  return {
    seed,
    map: generateTournamentMap(seed, layerCount),
    currentNodeId: '',
    visitedNodeIds: [],
    currentLayer: -1,
    collectedParts: [],
    activeBuffs: [],
    runCoins: 0,
    runSkills: [],
    raceResults: [],
    startedAt: Date.now(),
    status: 'in_progress',
  };
}

export function generateTournamentMap(seed: number, layerCount = DEFAULT_LAYER_COUNT): TournamentMap {
  if (!Number.isInteger(layerCount) || layerCount < 1) {
    throw new Error('generateTournamentMap requires at least one layer');
  }

  const rng = createRNG(seed);
  const opponents = getOpponents();
  const parts = getParts();
  const skills = getSkills();

  const baseLayers = Array.from({ length: layerCount }, (_, layerIndex) =>
    createLayer(seed, layerIndex, layerCount, rng, opponents, parts, skills),
  );

  return {
    seed,
    layers: attachConnections(baseLayers),
    totalLayers: layerCount,
  };
}

export function getAvailableNodes(run: TournamentRun): TournamentNode[] {
  if (run.status !== 'in_progress' || run.map.layers.length === 0) {
    return [];
  }

  if (run.currentLayer < 0 || run.currentNodeId === '') {
    return [...(run.map.layers[0] ?? [])];
  }

  const currentNode = findNodeById(run.map, run.currentNodeId);
  if (!currentNode || run.currentLayer >= run.map.totalLayers - 1) {
    return [];
  }

  const nextLayer = run.map.layers[run.currentLayer + 1] ?? [];
  const allowedConnections = new Set(currentNode.connections);
  const visitedNodeIds = new Set(run.visitedNodeIds);

  return nextLayer.filter((node) => allowedConnections.has(node.id) && !visitedNodeIds.has(node.id));
}

export function selectNode(run: TournamentRun, nodeId: string): TournamentRun {
  const nextNode = getAvailableNodes(run).find((node) => node.id === nodeId);

  if (!nextNode) {
    throw new Error(`node ${nodeId} is not available from the current run state`);
  }

  return {
    ...run,
    currentNodeId: nextNode.id,
    currentLayer: findNodeLayerIndex(run.map, nextNode.id),
    visitedNodeIds: run.visitedNodeIds.includes(nextNode.id)
      ? run.visitedNodeIds
      : [...run.visitedNodeIds, nextNode.id],
  };
}

export function startRace(run: TournamentRun, node: TournamentNode): RaceConfig {
  if (node.type !== 'race' && node.type !== 'elite' && node.type !== 'boss') {
    throw new Error('startRace requires a race-capable node');
  }

  if (!node.opponent) {
    throw new Error(`node ${node.id} does not define an opponent`);
  }

  const raceSeed = deriveNodeSeed(run.seed, node.id);

  return {
    seed: raceSeed,
    nodeId: node.id,
    nodeType: node.type,
    difficulty: node.difficulty,
    opponent: node.opponent,
    weather: selectWeather(getWeatherPresets(), raceSeed),
    rewards: node.rewards,
  };
}

export function completeRace(run: TournamentRun, result: RaceResult): TournamentRun {
  const currentNode = findNodeById(run.map, run.currentNodeId);

  if (!currentNode || (currentNode.type !== 'race' && currentNode.type !== 'elite' && currentNode.type !== 'boss')) {
    throw new Error('completeRace requires the run to be on a race-capable node');
  }

  if (result.ranking !== 1) {
    return {
      ...run,
      raceResults: [...run.raceResults, result],
      status: 'defeat',
    };
  }

  const rewardedRun = applyRewards(run, currentNode.rewards);

  return {
    ...rewardedRun,
    raceResults: [...rewardedRun.raceResults, result],
    status: currentNode.type === 'boss' || run.currentLayer >= run.map.totalLayers - 1 ? 'victory' : 'in_progress',
  };
}

export function isRunComplete(run: TournamentRun): boolean {
  return run.status !== 'in_progress';
}

export function getRunRewards(run: TournamentRun): Reward[] {
  const rewards: Reward[] = [
    ...run.collectedParts.map((part) => ({
      type: 'part' as const,
      value: part,
      rarity: part.rarity,
    })),
    ...run.runSkills.map((skill) => ({
      type: 'skill' as const,
      value: skill,
      rarity: skill.rarity,
    })),
  ];

  const bonusCoins = run.status === 'victory' ? VICTORY_BONUS_COINS : run.status === 'defeat' ? DEFEAT_BONUS_COINS : 0;

  rewards.push({
    type: 'coins',
    value: run.runCoins + bonusCoins,
    rarity: run.status === 'victory' ? 'rare' : 'common',
  });

  return rewards;
}

export function abandonRun(run: TournamentRun): TournamentRun {
  return {
    ...run,
    status: 'abandoned',
  };
}

export function getNodeById(map: TournamentMap, nodeId: string): TournamentNode | undefined {
  return findNodeById(map, nodeId);
}

function createLayer(
  seed: number,
  layerIndex: number,
  layerCount: number,
  rng: () => number,
  opponents: readonly Opponent[],
  parts: readonly Part[],
  skills: readonly Skill[],
): TournamentNode[] {
  const isFinalLayer = layerIndex === layerCount - 1;
  const nodeCount = isFinalLayer ? 1 : randomInt(rng, MIN_NODES_PER_LAYER, MAX_NODES_PER_LAYER);

  return Array.from({ length: nodeCount }, (_, nodeIndex) => {
    const type = resolveNodeType(layerIndex, layerCount, nodeIndex, rng);
    const difficulty = resolveNodeDifficulty(layerIndex, layerCount, type, rng);
    const nodeId = `tournament_${seed}_${layerIndex}_${nodeIndex}_${type}`;

    return {
      id: nodeId,
      type,
      position: resolveNodePosition(layerIndex, layerCount, nodeIndex, nodeCount),
      connections: [],
      difficulty,
      rewards: createNodeRewards(type, difficulty, rng, parts, skills),
      opponent: isRaceNodeType(type) ? selectOpponent(opponents, difficulty, type, rng) : undefined,
      shopInventory: type === 'shop' ? shuffle(rng, parts).slice(0, 3) : undefined,
      eventData: type === 'event' ? createEventData(nodeId, difficulty, rng, parts) : undefined,
    };
  });
}

function resolveNodeType(
  layerIndex: number,
  layerCount: number,
  nodeIndex: number,
  rng: () => number,
): TournamentNodeType {
  if (layerIndex === layerCount - 1) {
    return 'boss';
  }

  if (layerIndex === 0) {
    return 'race';
  }

  if (layerIndex === layerCount - 2 && nodeIndex === 0) {
    return 'elite';
  }

  return weightedChoice(rng, NODE_TYPE_OPTIONS, NODE_TYPE_WEIGHTS);
}

function resolveNodeDifficulty(
  layerIndex: number,
  layerCount: number,
  type: TournamentNodeType,
  rng: () => number,
): number {
  if (type === 'boss') {
    return CLASS_BOSS_DIFFICULTY;
  }

  const progress = layerCount <= 1 ? 1 : layerIndex / (layerCount - 1);
  const baseDifficulty = MIN_BASE_DIFFICULTY + Math.round(progress * BASE_DIFFICULTY_RANGE);
  const bonus =
    type === 'elite'
      ? 2
      : type === 'shop' || type === 'event'
          ? 0
          : 1;

  return Math.min(10, baseDifficulty + bonus + randomInt(rng, 0, 1));
}

function resolveNodePosition(
  layerIndex: number,
  layerCount: number,
  nodeIndex: number,
  nodeCount: number,
): TournamentNode['position'] {
  const usableWidth = GAME_WIDTH - HORIZONTAL_LAYER_PADDING * 2;
  const stepX = nodeCount === 1 ? 0 : usableWidth / Math.max(1, nodeCount - 1);
  const stepY = layerCount <= 1 ? 0 : (GAME_HEIGHT - LAYER_VERTICAL_PADDING * 2) / Math.max(1, layerCount - 1);

  return {
    x: HORIZONTAL_LAYER_PADDING + stepX * nodeIndex,
    y: LAYER_VERTICAL_PADDING + stepY * layerIndex,
  };
}

function createNodeRewards(
  type: TournamentNodeType,
  difficulty: number,
  rng: () => number,
  parts: readonly Part[],
  skills: readonly Skill[],
): Reward[] {
  if (type === 'shop' || type === 'event' || type === 'rest') {
    return [];
  }

  const partPool = shuffle(rng, parts);
  const skillPool = shuffle(rng, skills);
  const rewards: Reward[] = [
    {
      type: 'coins',
      value: 20 + difficulty * 10,
      rarity: type === 'boss' ? 'legendary' : type === 'elite' ? 'rare' : 'common',
    },
  ];

  if (partPool[0]) {
    rewards.push({
      type: 'part',
      value: partPool[0],
      rarity: partPool[0].rarity,
    });
  }

  if ((type === 'elite' || type === 'boss') && skillPool[0]) {
    rewards.push({
      type: 'skill',
      value: skillPool[0],
      rarity: skillPool[0].rarity,
    });
  }

  return rewards;
}

function selectOpponent(
  opponents: readonly Opponent[],
  difficulty: number,
  type: Extract<TournamentNodeType, 'race' | 'elite' | 'boss'>,
  rng: () => number,
): Opponent {
  if (opponents.length === 0) {
    throw new Error('at least one opponent is required to generate tournament nodes');
  }

  const scoredCandidates = opponents.map((opponent) => ({
    opponent,
    score: scoreOpponent(opponent, difficulty, type),
  }));
  const sortedCandidates = scoredCandidates.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.opponent.id.localeCompare(right.opponent.id);
  });
  const candidates = sortedCandidates.slice(0, Math.min(3, sortedCandidates.length));
  const weights = candidates.map(({ score }, index) =>
    Math.max(1, BASE_OPPONENT_WEIGHT - score - index),
  );

  return weightedChoice(
    rng,
    candidates.map(({ opponent }) => opponent),
    weights,
  );
}

function scoreOpponent(
  opponent: Opponent,
  difficulty: number,
  type: Extract<TournamentNodeType, 'race' | 'elite' | 'boss'>,
): number {
  const difficultyDelta = Math.abs(opponent.difficulty - difficulty);
  const typePenalty =
    type === 'boss'
      ? (isBossOpponent(opponent) ? 0 : NON_BOSS_SELECTION_PENALTY) + difficultyDelta
      : type === 'elite'
        ? Math.max(0, 6 - opponent.difficulty) + (isBossOpponent(opponent) ? 2 : 0)
        : Math.max(0, opponent.difficulty - difficulty) + (isBossOpponent(opponent) ? 3 : 0);

  return difficultyDelta + typePenalty;
}

function createEventData(nodeId: string, difficulty: number, rng: () => number, parts: readonly Part[]): EventData {
  const rewardPart = shuffle(rng, parts)[0];

  return {
    id: `${nodeId}_event`,
    description: '路边的折纸摊主愿意帮你快速调整机体，但你也可以换一袋补给金币。',
    choices: [
      {
        text: '收下补给金币',
        outcome: {
          type: 'coins',
          value: 10 + difficulty * 5,
          rarity: 'common',
        },
      },
      {
        text: '接受临时改装',
        outcome: rewardPart
          ? { type: 'part', value: rewardPart, rarity: rewardPart.rarity }
          : { stability: 1 },
      },
    ],
  };
}

function attachConnections(layers: readonly TournamentNode[][]): TournamentNode[][] {
  return layers.map((layer, layerIndex) => {
    const nextLayer = layers[layerIndex + 1] ?? [];

    return layer.map((node, nodeIndex) => ({
      ...node,
      connections: nextLayer.length === 0 ? [] : resolveConnections(nodeIndex, layer.length, nextLayer),
    }));
  });
}

function resolveConnections(
  nodeIndex: number,
  currentLayerLength: number,
  nextLayer: readonly TournamentNode[],
): string[] {
  if (nextLayer.length === 1) {
    return [nextLayer[0]!.id];
  }

  const primaryIndex = Math.round((nodeIndex / Math.max(1, currentLayerLength - 1)) * (nextLayer.length - 1));
  const connectionIds = new Set<string>([nextLayer[primaryIndex]!.id]);

  if (primaryIndex + 1 < nextLayer.length) {
    connectionIds.add(nextLayer[primaryIndex + 1]!.id);
  } else if (primaryIndex - 1 >= 0) {
    connectionIds.add(nextLayer[primaryIndex - 1]!.id);
  }

  return [...connectionIds];
}

function applyRewards(run: TournamentRun, rewards: readonly Reward[]): TournamentRun {
  return rewards.reduce((currentRun, reward) => {
    switch (reward.type) {
      case 'coins':
        return {
          ...currentRun,
          runCoins: currentRun.runCoins + (typeof reward.value === 'number' ? reward.value : 0),
        };
      case 'part':
        return {
          ...currentRun,
          collectedParts: isRewardPart(reward.value)
            ? appendUniqueById(currentRun.collectedParts, reward.value)
            : currentRun.collectedParts,
        };
      case 'skill':
        return {
          ...currentRun,
          runSkills: isRewardSkill(reward.value)
            ? appendUniqueById(currentRun.runSkills, reward.value)
            : currentRun.runSkills,
        };
      case 'airplane_unlock':
      default:
        return currentRun;
    }
  }, run);
}

function appendUniqueById<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
  return items.some((existingItem) => existingItem.id === item.id) ? items : [...items, item];
}

function isRewardPart(value: Reward['value']): value is Part {
  return typeof value === 'object' && value !== null && 'slot' in value && 'statModifiers' in value;
}

function isRewardSkill(value: Reward['value']): value is Skill {
  return typeof value === 'object' && value !== null && 'effect' in value && 'iconKey' in value;
}

function findNodeById(map: TournamentMap, nodeId: string): TournamentNode | undefined {
  return map.layers.flat().find((node) => node.id === nodeId);
}

function findNodeLayerIndex(map: TournamentMap, nodeId: string): number {
  return map.layers.findIndex((layer) => layer.some((node) => node.id === nodeId));
}

/**
 * Uses a small 32-bit FNV-1a style hash to deterministically derive per-node seeds
 * from the run seed and node id, so repeated visits to the same node configuration
 * always resolve the same weather and other seeded race details.
 */
function deriveNodeSeed(seed: number, nodeId: string): number {
  let hash = seed >>> 0;

  for (const character of nodeId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME_32) >>> 0;
  }

  return hash;
}

function isRaceNodeType(
  type: TournamentNodeType,
): type is Extract<TournamentNodeType, 'race' | 'elite' | 'boss'> {
  return type === 'race' || type === 'elite' || type === 'boss';
}

function isBossOpponent(opponent: Opponent): boolean {
  return opponent.title.includes('馆主');
}
