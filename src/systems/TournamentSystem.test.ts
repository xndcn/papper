import { describe, expect, it } from 'vitest';

import { getParts, getSkills, getWeatherPresets } from '@/systems/ContentLoader';
import {
  abandonRun,
  completeRace,
  createTournamentRun,
  generateTournamentMap,
  getAvailableNodes,
  getRunRewards,
  isRunComplete,
  selectNode,
  startRace,
} from '@/systems/TournamentSystem';
import type { RaceResult, TournamentMap, TournamentNode, TournamentRun } from '@/types';

function createRun(map: TournamentMap, overrides: Partial<TournamentRun> = {}): TournamentRun {
  return {
    seed: map.seed,
    map,
    currentNodeId: '',
    visitedNodeIds: [],
    currentLayer: -1,
    collectedParts: [],
    activeBuffs: [],
    runCoins: 0,
    runSkills: [],
    raceResults: [],
    startedAt: 1000,
    status: 'in_progress',
    ...overrides,
  };
}

function createRaceResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    raceId: 'race-1',
    score: 1800,
    distance: 620,
    airTime: 4200,
    trickScore: 150,
    ranking: 1,
    totalParticipants: 2,
    weather: getWeatherPresets()[0],
    opponentScores: [],
    ...overrides,
  };
}

describe('TournamentSystem', () => {
  it('creates a fresh tournament run and assigns the class boss to the final layer', () => {
    const run = createTournamentRun(2026);
    const bossNode = run.map.layers.at(-1)?.[0];

    expect(run.seed).toBe(2026);
    expect(run.currentNodeId).toBe('');
    expect(run.currentLayer).toBe(-1);
    expect(run.visitedNodeIds).toEqual([]);
    expect(run.status).toBe('in_progress');
    expect(bossNode?.difficulty).toBeGreaterThanOrEqual(6);
    expect(bossNode?.difficulty).toBeLessThanOrEqual(7);
    expect(bossNode?.opponent?.id).toBe('gale_lin');
  });

  it('generates deterministic maps with layered node structure and valid connections', () => {
    const firstMap = generateTournamentMap(2026);
    const secondMap = generateTournamentMap(2026);

    expect(secondMap).toEqual(firstMap);
    expect(firstMap.totalLayers).toBe(5);
    expect(firstMap.layers).toHaveLength(5);
    expect(firstMap.layers.slice(0, -1).every((layer) => layer.length >= 2 && layer.length <= 3)).toBe(true);
    expect(firstMap.layers[4]).toHaveLength(1);
    expect(firstMap.layers[4][0]?.type).toBe('boss');

    const nodeIds = firstMap.layers.flat().map((node) => node.id);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);

    const typeCounts = firstMap.layers
      .flat()
      .reduce<Record<string, number>>((counts, node) => ({ ...counts, [node.type]: (counts[node.type] ?? 0) + 1 }), {});
    expect(typeCounts.race ?? 0).toBeGreaterThan(typeCounts.elite ?? 0);
    expect(typeCounts.elite ?? 0).toBeGreaterThanOrEqual(1);

    firstMap.layers.slice(0, -1).forEach((layer, layerIndex) => {
      const nextLayerIds = new Set(firstMap.layers[layerIndex + 1]?.map((node) => node.id));

      layer.forEach((node) => {
        expect(node.connections.length).toBeGreaterThanOrEqual(1);
        expect(node.connections.every((connectionId) => nextLayerIds.has(connectionId))).toBe(true);
      });
    });
  });

  it('returns available nodes for the current path and advances the run when a node is selected', () => {
    const map = generateTournamentMap(77, 4);
    const initialRun = createRun(map);

    expect(getAvailableNodes(initialRun)).toEqual(map.layers[0]);

    const selectedNode = map.layers[0][0]!;
    const advancedRun = selectNode(initialRun, selectedNode.id);

    expect(advancedRun.currentNodeId).toBe(selectedNode.id);
    expect(advancedRun.currentLayer).toBe(0);
    expect(advancedRun.visitedNodeIds).toEqual([selectedNode.id]);
    expect(getAvailableNodes(advancedRun)).toEqual(
      map.layers[1]!.filter((node) => selectedNode.connections.includes(node.id)),
    );
  });

  it('builds deterministic race configs from selected race nodes', () => {
    const map = generateTournamentMap(99, 4);
    const run = selectNode(createRun(map), map.layers[0][0]!.id);
    const node = map.layers[0][0]!;

    const firstConfig = startRace(run, node);
    const secondConfig = startRace(run, node);

    expect(firstConfig).toEqual(secondConfig);
    expect(firstConfig.nodeId).toBe(node.id);
    expect(firstConfig.opponent.id).toBe(node.opponent?.id);
    expect(firstConfig.difficulty).toBe(node.difficulty);
  });

  it('records winning race rewards into the run state and marks boss clears as victory', () => {
    const rewardPart = getParts()[1]!;
    const rewardSkill = getSkills()[0]!;
    const weather = getWeatherPresets()[1]!;
    const node: TournamentNode = {
      id: 'boss-node',
      type: 'boss',
      position: { x: 320, y: 40 },
      connections: [],
      difficulty: 10,
      rewards: [
        { type: 'coins', value: 80, rarity: 'rare' },
        { type: 'part', value: rewardPart, rarity: rewardPart.rarity },
        { type: 'skill', value: rewardSkill, rarity: rewardSkill.rarity },
      ],
      opponent: generateTournamentMap(101).layers.at(-1)?.[0]?.opponent,
    };
    const map: TournamentMap = {
      seed: 101,
      totalLayers: 1,
      layers: [[node]],
    };
    const run = createRun(map, {
      currentNodeId: node.id,
      currentLayer: 0,
      visitedNodeIds: [node.id],
    });

    const completedRun = completeRace(
      run,
      createRaceResult({
        raceId: node.id,
        weather,
      }),
    );

    expect(completedRun.runCoins).toBe(80);
    expect(completedRun.collectedParts).toEqual([rewardPart]);
    expect(completedRun.runSkills).toEqual([rewardSkill]);
    expect(completedRun.raceResults).toHaveLength(1);
    expect(completedRun.status).toBe('victory');
    expect(isRunComplete(completedRun)).toBe(true);
  });

  it('returns differentiated end rewards and supports defeat / abandon flows', () => {
    const rewardPart = getParts()[0]!;
    const rewardSkill = getSkills()[1]!;
    const templateMap = generateTournamentMap(555, 3);
    const victoryRun = createRun(templateMap, {
      status: 'victory',
      runCoins: 120,
      collectedParts: [rewardPart],
      runSkills: [rewardSkill],
    });
    const defeatRun = createRun(templateMap, {
      status: 'defeat',
      runCoins: 120,
      collectedParts: [rewardPart],
      runSkills: [rewardSkill],
    });

    const victoryRewards = getRunRewards(victoryRun);
    const defeatRewards = getRunRewards(defeatRun);
    const victoryCoins = victoryRewards.find((reward) => reward.type === 'coins');
    const defeatCoins = defeatRewards.find((reward) => reward.type === 'coins');

    expect(victoryRewards).toContainEqual({ type: 'part', value: rewardPart, rarity: rewardPart.rarity });
    expect(victoryRewards).toContainEqual({ type: 'skill', value: rewardSkill, rarity: rewardSkill.rarity });
    expect(typeof victoryCoins?.value).toBe('number');
    expect(typeof defeatCoins?.value).toBe('number');
    expect(victoryCoins?.value as number).toBeGreaterThan(defeatCoins?.value as number);
    expect(abandonRun(createRun(templateMap)).status).toBe('abandoned');
    expect(isRunComplete(createRun(templateMap))).toBe(false);
  });
});
