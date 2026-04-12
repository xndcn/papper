import Phaser from 'phaser';

import {
  GAME_BACKGROUND_COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENE_BUTTON_STYLE,
  SCENE_HINT_STYLE,
  SCENE_KEYS,
  SCENE_SUBTITLE_STYLE,
  SCENE_TITLE_STYLE,
} from '@/config/constants';
import { calculateFinalStats } from '@/systems/AirplaneStatsSystem';
import { getAirplaneById, getAirplanes, getOpponentById, getOpponents, getParts, getWeatherPresets } from '@/systems/ContentLoader';
import {
  calculateAILaunchParams,
  generateOpponentScore,
  simulateOpponentFlight,
  type AILaunchParams,
} from '@/systems/OpponentAI';
import {
  activateSkill,
  calculateBuffedStats,
  checkPassiveTrigger,
  createSkillBuff,
  removeExpiredBuffs,
  updateCooldowns,
  type SkillState,
} from '@/systems/SkillSystem';
import {
  calculateAerodynamicForce,
  calculateAngleOfAttackDegrees,
  calculateAngularDamping,
  calculateCollisionRetention,
  calculateDragCoefficient,
  calculateLaunchVector,
  calculateMaxTorque,
  getAerodynamicCoefficients,
  predictTrajectoryPoints,
  resolveGlideAlignmentRotation,
  resolvePitchControlAngularVelocity,
  type PitchControlDirection,
} from '@/systems/PhysicsSystem';
import { calculateFlightScore, isFlightOutOfBounds } from '@/systems/RaceSystem';
import { completeRace } from '@/systems/TournamentSystem';
import { calculateWindEffect, selectWeather } from '@/systems/WeatherSystem';
import type {
  AirplaneStats,
  Buff,
  Opponent,
  OpponentRaceResult,
  Part,
  RaceParticipantResult,
  RaceSceneData,
  ResultSceneData,
  SceneNavigationButton,
  Skill,
  Weather,
} from '@/types';
import { persistGameState } from '@/utils/gamePersistence';
import { GameState } from '@/utils/GameState';
import { formatRelativeRacePosition, getWindDirectionArrow } from '@/utils/scenePresentation';
import { describeCompletedRunSettlement, settleCompletedRun } from '@/utils/runPersistence';
import { clamp, lerp, scaleVector, subtractVectors, vectorMagnitude, type Vector2Like } from '@/utils/math';

const FINISH_RACE_BUTTON: SceneNavigationButton = {
  label: '进入结算',
  target: SCENE_KEYS.RESULT,
};
const RESET_RACE_BUTTON: SceneNavigationButton = {
  label: '重新试飞',
  target: SCENE_KEYS.RACE,
};

const PAPER_PLANE_TEXTURE_KEY = 'paper-plane-step3';
const PAPER_PLANE_LABEL = 'paper-plane';
const GROUND_LABEL = 'ground';
const LAUNCH_ANCHOR: Vector2Like = { x: 116, y: 178 };
const MAX_DRAG_DISTANCE = 72;
const GROUND_HEIGHT = 34;
const GROUND_TOP_Y = GAME_HEIGHT - GROUND_HEIGHT;
const PLANE_PICK_RADIUS = 28;
const RACE_WORLD_WIDTH = 2200;
// Scene-level tuning is intentionally higher than PhysicsSystem defaults so Step 4 feels readable in-browser.
const LIFT_FORCE_MULTIPLIER = 0.00009;
const DRAG_FORCE_MULTIPLIER_SCALE = 0.00072;
const MIN_AERODYNAMIC_SPEED = 1.4;
const CAMERA_LERP_FACTOR = 0.08;
const CAMERA_HORIZONTAL_OFFSET = -GAME_WIDTH * 0.18;
const LAUNCH_FORCE_MULTIPLIER = 5.5;
const FRICTION_AIR_SCALE = 0.1;
const RESTITUTION_SCALE = 0.1;
const AI_SIMULATION_DURATION_SECONDS = 8;
const PROGRESS_TRACK_START_X = 164;
const PROGRESS_TRACK_END_X = GAME_WIDTH - 44;
const PROGRESS_TRACK_Y = 82;
const MIN_PROGRESS_DENOMINATOR = 1;
const SPEED_GAUGE_X = GAME_WIDTH - 120;
const SPEED_GAUGE_Y = 118;
const SPEED_GAUGE_WIDTH = 96;
const SPEED_GAUGE_HEIGHT = 8;
const SPEED_GAUGE_MAX_SPEED = 320;
const SPEED_GAUGE_REDRAW_THRESHOLD = 1;
const MIN_STALL_SPEED = 24;
const MIN_STALL_VERTICAL_VELOCITY = 1.5;
const FLIGHT_BOUNDS = {
  minX: 0,
  maxX: RACE_WORLD_WIDTH - 28,
  minY: -120,
  maxY: GAME_HEIGHT + 120,
} as const;

interface AirplanePhysicsProfile {
  readonly dragCoefficient: number;
  readonly angularDamping: number;
  readonly maxTorque: number;
  readonly collisionRetention: number;
}

const DEFAULT_AIRPLANE = getAirplanes()[0];
const DEFAULT_WEATHER = getWeatherPresets()[0];
const DEFAULT_OPPONENT = getOpponents()[0];

function getPartsByIds(partIds: readonly string[]): readonly Part[] {
  const partsById = new Map(getParts().map((part) => [part.id, part] as const));

  return partIds.flatMap((partId) => {
    const part = partsById.get(partId);
    return part ? [part] : [];
  });
}

function resolveOpponentSetup(opponentId: string): { opponent: Opponent; stats: AirplaneStats } {
  const opponent = getOpponentById(opponentId) ?? DEFAULT_OPPONENT;
  const airplane = getAirplaneById(opponent.airplaneId) ?? DEFAULT_AIRPLANE;
  return {
    opponent,
    stats: calculateFinalStats(airplane.baseStats, getPartsByIds(opponent.partIds)),
  };
}

function resolveRaceSceneData(data: RaceSceneData | undefined): Required<RaceSceneData> {
  const resolvedAirplane = getAirplaneById(data?.airplaneId ?? DEFAULT_AIRPLANE.id) ?? DEFAULT_AIRPLANE;
  const equippedParts = data?.equippedParts ?? [];

  return {
    airplaneId: data?.airplaneId ?? resolvedAirplane.id,
    airplaneName: data?.airplaneName ?? resolvedAirplane.name,
    airplaneStats: data?.airplaneStats ?? calculateFinalStats(resolvedAirplane.baseStats, equippedParts),
    equippedParts,
    equippedSkills: data?.equippedSkills ?? [],
    weather: data?.weather ?? selectWeather(getWeatherPresets(), Date.now()),
    opponentId: data?.opponentId ?? DEFAULT_OPPONENT.id,
    tournamentRun: data?.tournamentRun,
    tournamentNodeId: data?.tournamentNodeId,
  };
}

function createAirplanePhysicsProfile(airplaneStats: AirplaneStats): AirplanePhysicsProfile {
  return {
    dragCoefficient: calculateDragCoefficient(airplaneStats.glide),
    angularDamping: calculateAngularDamping(airplaneStats.stability),
    maxTorque: calculateMaxTorque(airplaneStats.trick),
    collisionRetention: calculateCollisionRetention(airplaneStats.durability),
  };
}

function formatStatsLabel(airplaneStats: AirplaneStats): string {
  return `速度 ${airplaneStats.speed} · 滑翔 ${airplaneStats.glide} · 稳定 ${airplaneStats.stability} · 特技 ${airplaneStats.trick} · 耐久 ${airplaneStats.durability}`;
}

function hasBodyLabel(body: MatterJS.BodyType | undefined, label: string): boolean {
  return body?.label === label;
}

function toPhaserVector(vector: Vector2Like): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2(vector.x, vector.y);
}

function formatSignedAngle(angle: number): string {
  const sign = angle > 0 ? '+' : '';
  return `${sign}${angle.toFixed(1)}°`;
}

function formatOpponentPersonality(personality: Opponent['personality']): string {
  switch (personality) {
    case 'aggressive':
      return '进攻型';
    case 'balanced':
      return '均衡型';
    case 'cautious':
      return '防守型';
    case 'tricky':
      return '花式型';
  }
}

function rankParticipants(participants: readonly RaceParticipantResult[]): readonly RaceParticipantResult[] {
  return [...participants].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.distance !== left.distance) {
      return right.distance - left.distance;
    }

    return right.flightTimeMs - left.flightTimeMs;
  });
}

function generateRaceSummary({
  airplaneName,
  opponent,
  opponentResult,
  playerScore,
  beatOpponent,
  reason,
  weather,
}: {
  readonly airplaneName: string;
  readonly opponent: Opponent;
  readonly opponentResult?: OpponentRaceResult;
  readonly playerScore: number;
  readonly beatOpponent: boolean;
  readonly reason: 'landed' | 'out_of_bounds';
  readonly weather: Weather;
}): string {
  if (opponentResult) {
    if (beatOpponent) {
      return `你以 ${playerScore} 分击败了 ${opponent.name}（${opponentResult.score} 分），${reason === 'landed' ? '成功完成落地结算。' : '虽然越界，但仍保住了领先。'}`;
    }

    return `${opponent.name} 以 ${opponentResult.score} 分领先，你获得 ${playerScore} 分。${reason === 'landed' ? '本轮已完成结算。' : '本轮因越界结束。'}`;
  }

  if (reason === 'landed') {
    return `${airplaneName} 原型验证完成：${weather.displayName}会持续施加风力，已可观察天气对飞行距离的影响。`;
  }

  return `${airplaneName} 原型验证完成：${weather.displayName}会持续施加风力，飞机越界后会结束本轮并结算得分。`;
}

/**
 * Converts the live race outcome into the compact TournamentSystem result shape
 * used for run progression, rewards, and return-to-map flow after ResultScene.
 */
function createTournamentRaceResult({
  nodeId,
  playerRank,
  rankings,
  distance,
  flightTimeMs,
  weather,
  opponent,
  opponentResult,
}: {
  readonly nodeId: string;
  readonly playerRank: number;
  readonly rankings: readonly RaceParticipantResult[];
  readonly distance: number;
  readonly flightTimeMs: number;
  readonly weather: Weather;
  readonly opponent: Opponent;
  readonly opponentResult?: OpponentRaceResult;
}) {
  return {
    raceId: nodeId,
    score: rankings.find((entry) => entry.isPlayer)?.score ?? 0,
    distance,
    airTime: flightTimeMs,
    trickScore: 0,
    ranking: playerRank,
    totalParticipants: rankings.length,
    weather,
    opponentScores: opponentResult ? [{ opponentId: opponent.id, score: opponentResult.score }] : [],
  } as const;
}

function formatBuffSummary(buff: Buff, currentTime: number): string {
  const remainingMs =
    buff.startTime === undefined || buff.duration <= 0 ? 0 : Math.max(0, buff.startTime + buff.duration - currentTime);
  return `${buff.name}${remainingMs > 0 ? ` ${Math.ceil(remainingMs / 100) / 10}s` : ''}`;
}

function formatSkillButtonLabel(skillState: SkillState, currentTime: number): string {
  const remainingMs = Math.max(0, skillState.cooldownEnd - currentTime);
  return skillState.isReady ? skillState.skill.name : `${skillState.skill.name} ${Math.ceil(remainingMs / 100) / 10}s`;
}

export class RaceScene extends Phaser.Scene {
  private airplane?: Phaser.Physics.Matter.Image;
  private guideGraphics?: Phaser.GameObjects.Graphics;
  private trajectoryGraphics?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private finishButton?: Phaser.GameObjects.Text;
  private resetButton?: Phaser.GameObjects.Text;
  private weatherText?: Phaser.GameObjects.Text;
  private opponentText?: Phaser.GameObjects.Text;
  private flightMetricsText?: Phaser.GameObjects.Text;
  private relativePositionText?: Phaser.GameObjects.Text;
  private speedGaugeLabelText?: Phaser.GameObjects.Text;
  private speedGaugeGraphics?: Phaser.GameObjects.Graphics;
  private playerProgressMarker?: Phaser.GameObjects.Arc;
  private opponentProgressMarker?: Phaser.GameObjects.Arc;
  private skillStatusText?: Phaser.GameObjects.Text;
  private buffStatusText?: Phaser.GameObjects.Text;
  private skillButtons: Phaser.GameObjects.Text[] = [];
  private airplaneName = DEFAULT_AIRPLANE.name;
  private airplaneStats = DEFAULT_AIRPLANE.baseStats;
  private weather = DEFAULT_WEATHER;
  private opponent = DEFAULT_OPPONENT;
  private opponentStats = DEFAULT_AIRPLANE.baseStats;
  private currentRaceSceneData: Required<RaceSceneData> = resolveRaceSceneData(undefined);
  private airplanePhysicsProfile = createAirplanePhysicsProfile(DEFAULT_AIRPLANE.baseStats);
  private activeBuffs: Buff[] = [];
  private skillStates: SkillState[] = [];
  private passiveSkills: Skill[] = [];
  private readonly triggeredPassiveSkillIds = new Set<string>();
  private opponentLaunchParams?: AILaunchParams;
  private opponentResult?: OpponentRaceResult;
  private isDragging = false;
  private hasLaunched = false;
  private hasLanded = false;
  private flightStartTime = 0;
  private launchStartX = LAUNCH_ANCHOR.x;
  private maxFlightX = LAUNCH_ANCHOR.x;
  private lastRenderedSpeed = -1;
  private pitchDirection: PitchControlDirection = 'neutral';
  private resultData: ResultSceneData = {
    distance: 0,
    flightTimeMs: 0,
    score: 0,
    summary: '请先完成一次拖拽发射。',
    playerName: DEFAULT_AIRPLANE.name,
  };

  constructor() {
    super(SCENE_KEYS.RACE);
  }

  create(data?: RaceSceneData): void {
    const raceSceneData = resolveRaceSceneData(data);
    const opponentSetup = resolveOpponentSetup(raceSceneData.opponentId);

    this.airplaneName = raceSceneData.airplaneName;
    this.airplaneStats = raceSceneData.airplaneStats;
    this.weather = raceSceneData.weather;
    this.opponent = opponentSetup.opponent;
    this.opponentStats = opponentSetup.stats;
    this.currentRaceSceneData = raceSceneData;
    this.airplanePhysicsProfile = createAirplanePhysicsProfile(raceSceneData.airplaneStats);
    this.activeBuffs = [];
    this.skillStates = raceSceneData.equippedSkills.map((skill) => ({
      skill,
      cooldownEnd: 0,
      uses: 0,
      isReady: true,
    }));
    this.passiveSkills = (raceSceneData.tournamentRun?.runSkills ?? []).filter((skill) => skill.type === 'passive');
    this.triggeredPassiveSkillIds.clear();
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.cameras.main.setBounds(0, 0, RACE_WORLD_WIDTH, GAME_HEIGHT);
    this.createParallaxBackground();
    this.createRaceHud();
    this.createGround();
    this.createAnchorMarker();
    this.createPlaneTexture();

    this.guideGraphics = this.add.graphics();
    this.trajectoryGraphics = this.add.graphics();
    this.airplane = this.createAirplane();
    this.finishButton = this.createFinishButton();
    this.resetButton = this.createResetButton();
    this.statusText = this.add.text(24, 96, '', SCENE_SUBTITLE_STYLE).setScrollFactor(0);

    this.registerInput();
    this.registerCollisionListener();
    this.resetAirplane();
  }

  update(_time: number, delta: number): void {
    if (!this.airplane || !this.statusText || !this.hasLaunched || this.hasLanded) {
      return;
    }

    this.activeBuffs = removeExpiredBuffs(this.activeBuffs, this.time.now);
    this.skillStates = updateCooldowns(this.skillStates, this.time.now);
    const runtimeStats = calculateBuffedStats(this.airplaneStats, this.activeBuffs);
    this.airplanePhysicsProfile = createAirplanePhysicsProfile(runtimeStats);
    const velocity = this.airplane.body?.velocity ?? { x: 0, y: 0 };
    const currentAngularVelocity = this.airplane.body?.angularVelocity ?? 0;
    // First apply stability damping, then layer either auto-glide alignment or active pitch input on top.
    const dampedAngularVelocity = currentAngularVelocity * (1 - this.airplanePhysicsProfile.angularDamping);
    let airplaneAngleRadians = this.airplane.rotation;

    if (this.pitchDirection === 'neutral') {
      airplaneAngleRadians = resolveGlideAlignmentRotation({
        currentRotationRadians: airplaneAngleRadians,
        velocity,
        stabilityStat: runtimeStats.stability,
        deltaMs: delta,
      });
      this.airplane.setRotation(airplaneAngleRadians);
      this.airplane.setAngularVelocity(dampedAngularVelocity);
    } else {
      this.airplane.setAngularVelocity(
        resolvePitchControlAngularVelocity({
          currentAngularVelocity: dampedAngularVelocity,
          direction: this.pitchDirection,
          maxAngularVelocity: this.airplanePhysicsProfile.maxTorque,
        }),
      );
      airplaneAngleRadians = this.airplane.rotation;
    }

    const aerodynamicForce = calculateAerodynamicForce({
      airplaneAngleRadians,
      velocity,
      liftMultiplier: LIFT_FORCE_MULTIPLIER,
      dragMultiplier: this.airplanePhysicsProfile.dragCoefficient * DRAG_FORCE_MULTIPLIER_SCALE,
      minSpeed: MIN_AERODYNAMIC_SPEED,
    });

    this.airplane.applyForce(toPhaserVector(aerodynamicForce));
    const windEffect =
      this.hasActiveSpecialEffect('block_collision_and_headwind_once') && this.weather.condition === 'headwind'
        ? { x: 0, y: 0 }
        : calculateWindEffect(this.weather, runtimeStats);
    this.airplane.applyForce(toPhaserVector(scaleVector(windEffect, delta / 1000)));

    if (isFlightOutOfBounds({ x: this.airplane.x, y: this.airplane.y }, FLIGHT_BOUNDS)) {
      this.handleLanding('out_of_bounds');
      return;
    }

    const speed = vectorMagnitude(velocity);
    this.maxFlightX = Math.max(this.maxFlightX, this.airplane.x);
    const angleOfAttack = calculateAngleOfAttackDegrees(airplaneAngleRadians, velocity);
    const coefficients = getAerodynamicCoefficients(angleOfAttack);
    const playerDistancePx = Math.max(0, this.airplane.x - this.launchStartX);
    const opponentProjectedDistance = this.resolveAnimatedOpponentDistance(this.time.now - this.flightStartTime);
    const altitudePx = Math.max(0, Math.round(GROUND_TOP_Y - this.airplane.y));
    this.checkPassiveSkills(speed, velocity.y);

    this.updateProgressMarkers(playerDistancePx, opponentProjectedDistance);
    this.renderTelemetry(speed, altitudePx, Math.round(playerDistancePx), Math.round(opponentProjectedDistance));
    this.buffStatusText?.setText(
      this.activeBuffs.length > 0
        ? `Buff：${this.activeBuffs.map((buff) => formatBuffSummary(buff, this.time.now)).join(' ｜ ')}`
        : `Buff：${this.passiveSkills.length > 0 ? '等待被动 / 主动技能触发' : '当前无 Buff'}`,
    );
    this.refreshSkillButtons();

    this.statusText.setText([
      `速度 ${speed.toFixed(2)} px/s · 攻角 ${formatSignedAngle(angleOfAttack)}`,
      `升力系数 ${coefficients.lift.toFixed(2)} · 阻力系数 ${coefficients.drag.toFixed(3)}`,
      `飞行控制：${this.pitchDirection === 'neutral' ? '自动滑翔' : this.pitchDirection === 'up' ? '抬头' : '压头'}`,
      '轻触并按住上/下半屏微调，松开后自动顺着速度方向滑翔',
      this.opponentResult
        ? `对手 ${this.opponent.name}：${formatOpponentPersonality(this.opponent.personality)} · 当前进度 ${Math.round(opponentProjectedDistance)}px / 目标 ${this.opponentResult.distance}px`
        : `对手 ${this.opponent.name}：等待同步起飞`,
    ]);
  }

  private createRaceHud(): void {
    this.add.text(GAME_WIDTH / 2, 26, `${this.airplaneName} · 飞行测试场`, SCENE_TITLE_STYLE).setOrigin(0.5).setScrollFactor(0);
    this.add
      .text(
        GAME_WIDTH / 2,
        48,
        'Phase 1 · Step 6：完整 HUD 显示速度、高度、距离、风向与 AI 相对位置',
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.opponentText = this.add
      .text(
        24,
        62,
        `对手：${this.opponent.name} · ${this.opponent.title} · ${formatOpponentPersonality(this.opponent.personality)}`,
        SCENE_SUBTITLE_STYLE,
      )
      .setScrollFactor(0);
    this.weatherText = this.add
      .text(
        GAME_WIDTH - 24,
        18,
        `天气：${this.weather.displayName} ${getWindDirectionArrow(this.weather)} 风力 ${this.weather.windStrength}`,
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.flightMetricsText = this.add.text(24, 94, '', SCENE_SUBTITLE_STYLE).setScrollFactor(0);
    this.relativePositionText = this.add
      .text(GAME_WIDTH - 24, 62, '相对位置：等待发射', SCENE_SUBTITLE_STYLE)
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.speedGaugeLabelText = this.add
      .text(GAME_WIDTH - 24, 94, '速度仪表 0 px/s', SCENE_SUBTITLE_STYLE)
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.speedGaugeGraphics = this.add.graphics().setScrollFactor(0);
    this.buffStatusText = this.add.text(GAME_WIDTH - 24, 108, 'Buff：当前无 Buff', SCENE_HINT_STYLE).setOrigin(1, 0).setScrollFactor(0);
    this.skillStatusText = this.add
      .text(GAME_WIDTH - 24, 122, this.skillStates.length > 0 ? '技能待命：点击下方按钮触发' : '技能待命：当前未装备主动技能', SCENE_HINT_STYLE)
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.add.text(24, PROGRESS_TRACK_Y, '你', SCENE_HINT_STYLE).setOrigin(0, 0.5).setScrollFactor(0);
    this.add.text(132, PROGRESS_TRACK_Y, 'AI', SCENE_HINT_STYLE).setOrigin(0, 0.5).setScrollFactor(0);
    this.add.rectangle(
      (PROGRESS_TRACK_START_X + PROGRESS_TRACK_END_X) / 2,
      PROGRESS_TRACK_Y,
      PROGRESS_TRACK_END_X - PROGRESS_TRACK_START_X,
      4,
      0x334155,
    )
      .setScrollFactor(0)
      .setOrigin(0.5);
    this.playerProgressMarker = this.add.circle(PROGRESS_TRACK_START_X, PROGRESS_TRACK_Y, 4, 0xf8fafc).setScrollFactor(0);
    this.opponentProgressMarker = this.add.circle(PROGRESS_TRACK_START_X, PROGRESS_TRACK_Y, 4, 0xf59e0b).setScrollFactor(0);
    this.add
      .text(
        24,
        GAME_HEIGHT - 18,
        `${formatStatsLabel(this.airplaneStats)}；当前天气：${this.weather.displayName}；下方技能按钮支持点击 / 触屏触发。`,
        SCENE_HINT_STYLE,
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    this.createSkillButtons();
    this.renderSpeedGauge(0);
  }

  private renderTelemetry(speed: number, altitudePx: number, playerDistancePx: number, opponentDistancePx: number): void {
    this.flightMetricsText?.setText([
      `高度 ${altitudePx}px · 距离 ${playerDistancePx}px`,
      `风向 ${getWindDirectionArrow(this.weather)} · 风力 ${this.weather.windStrength} · AI ${opponentDistancePx}px`,
    ]);
    this.relativePositionText?.setText(formatRelativeRacePosition(playerDistancePx, opponentDistancePx));
    this.renderSpeedGauge(speed);
  }

  private renderSpeedGauge(speed: number): void {
    if (Math.abs(speed - this.lastRenderedSpeed) < SPEED_GAUGE_REDRAW_THRESHOLD) {
      return;
    }

    const normalizedSpeed = clamp(speed / SPEED_GAUGE_MAX_SPEED, 0, 1);

    this.speedGaugeGraphics?.clear();
    this.speedGaugeGraphics?.fillStyle(0x1e293b, 1);
    this.speedGaugeGraphics?.fillRect(SPEED_GAUGE_X, SPEED_GAUGE_Y, SPEED_GAUGE_WIDTH, SPEED_GAUGE_HEIGHT);
    this.speedGaugeGraphics?.fillStyle(0x38bdf8, 1);
    this.speedGaugeGraphics?.fillRect(
      SPEED_GAUGE_X,
      SPEED_GAUGE_Y,
      SPEED_GAUGE_WIDTH * normalizedSpeed,
      SPEED_GAUGE_HEIGHT,
    );
    this.speedGaugeGraphics?.lineStyle(1, 0xe2e8f0, 0.85);
    this.speedGaugeGraphics?.strokeRect(SPEED_GAUGE_X, SPEED_GAUGE_Y, SPEED_GAUGE_WIDTH, SPEED_GAUGE_HEIGHT);
    this.speedGaugeLabelText?.setText(`速度仪表 ${Math.round(speed)} px/s`);
    this.lastRenderedSpeed = speed;
  }

  private createParallaxBackground(): void {
    const farColor = 0x1d4ed8;
    const midColor = 0x2563eb;
    const nearColor = 0x60a5fa;

    for (let index = 0; index < 8; index += 1) {
      const x = 140 + index * 300;
      this.add.ellipse(x, 176, 320, 96, farColor, 0.3).setScrollFactor(0.1);
      this.add.circle(x - 30, 68 + (index % 2) * 8, 18, 0xffffff, 0.65).setScrollFactor(0.3);
      this.add.circle(x, 60 + (index % 3) * 12, 24, 0xffffff, 0.65).setScrollFactor(0.3);
      this.add.circle(x + 26, 72 + (index % 2) * 8, 16, 0xffffff, 0.65).setScrollFactor(0.3);
      this.add.ellipse(x, 200, 240, 72, midColor, 0.55).setScrollFactor(0.3);
      this.add.rectangle(x, 214, 180, 34, nearColor, 0.5).setScrollFactor(1);
    }
  }

  private createGround(): void {
    this.add.rectangle(RACE_WORLD_WIDTH / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, RACE_WORLD_WIDTH, GROUND_HEIGHT, 0x1e293b);
    this.add.rectangle(RACE_WORLD_WIDTH / 2, GROUND_TOP_Y, RACE_WORLD_WIDTH, 2, 0x94a3b8);
    this.matter.add.rectangle(RACE_WORLD_WIDTH / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, RACE_WORLD_WIDTH, GROUND_HEIGHT, {
      isStatic: true,
      label: GROUND_LABEL,
    });
  }

  private createAnchorMarker(): void {
    this.add.circle(LAUNCH_ANCHOR.x, LAUNCH_ANCHOR.y, 5, 0x38bdf8);
    this.add.circle(LAUNCH_ANCHOR.x, LAUNCH_ANCHOR.y, MAX_DRAG_DISTANCE, 0x38bdf8, 0.08).setStrokeStyle(1, 0x38bdf8, 0.25);
  }

  private createPlaneTexture(): void {
    if (this.textures.exists(PAPER_PLANE_TEXTURE_KEY)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xf8fafc, 1);
    graphics.lineStyle(2, 0x38bdf8, 1);
    graphics.beginPath();
    graphics.moveTo(2, 12);
    graphics.lineTo(34, 2);
    graphics.lineTo(34, 22);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.generateTexture(PAPER_PLANE_TEXTURE_KEY, 36, 24);
    graphics.destroy();
  }

  private createAirplane(): Phaser.Physics.Matter.Image {
    const airplane = this.matter.add.image(LAUNCH_ANCHOR.x, LAUNCH_ANCHOR.y, PAPER_PLANE_TEXTURE_KEY, undefined, {
      density: 0.0012,
      friction: 0.8,
      frictionAir: this.airplanePhysicsProfile.dragCoefficient * FRICTION_AIR_SCALE,
      frictionStatic: 0.6,
      label: PAPER_PLANE_LABEL,
      restitution: this.airplanePhysicsProfile.collisionRetention * RESTITUTION_SCALE,
      shape: {
        type: 'fromVertices',
        verts: '2 12 34 2 34 22',
      },
    });

    airplane.setOrigin(0.5);

    return airplane;
  }

  private createFinishButton(): Phaser.GameObjects.Text {
    return this.add
      .text(GAME_WIDTH - 76, GAME_HEIGHT - 50, FINISH_RACE_BUTTON.label, SCENE_BUTTON_STYLE)
      .setAlpha(0.45)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.finishRace();
      });
  }

  private createResetButton(): Phaser.GameObjects.Text {
    return this.add
      .text(GAME_WIDTH - 176, GAME_HEIGHT - 50, RESET_RACE_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.restart(this.currentRaceSceneData);
      });
  }

  private createSkillButtons(): void {
    this.skillButtons.forEach((button) => button.destroy());
    this.skillButtons = this.skillStates.map((skillState, index) =>
      this.add
        .text(64 + index * 92, GAME_HEIGHT - 50, skillState.skill.name, SCENE_BUTTON_STYLE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.tryActivateSkill(index);
        }),
    );
    this.refreshSkillButtons();
  }

  private bindPitchControlKey(key: string, direction: PitchControlDirection): void {
    this.input.keyboard?.on(`keydown-${key}`, () => {
      this.pitchDirection = direction;
    });
    this.input.keyboard?.on(`keyup-${key}`, () => {
      this.pitchDirection = 'neutral';
    });
  }

  private registerInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.hasLaunched && !this.hasLanded) {
        this.updatePitchDirection(pointer);
        return;
      }

      this.beginDrag(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.hasLaunched && !this.hasLanded && pointer.isDown) {
        this.updatePitchDirection(pointer);
        return;
      }

      this.updateDrag(pointer);
    });
    this.input.on('pointerup', () => {
      this.pitchDirection = 'neutral';
      this.releaseDrag();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.finishRace();
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.restart(this.currentRaceSceneData);
    });
    this.bindPitchControlKey('UP', 'up');
    this.bindPitchControlKey('W', 'up');
    this.bindPitchControlKey('DOWN', 'down');
    this.bindPitchControlKey('S', 'down');
  }

  private registerCollisionListener(): void {
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      if (!this.hasLaunched || this.hasLanded) {
        return;
      }

      const touchedGround = event.pairs.some((pair) => {
        return (
          (hasBodyLabel(pair.bodyA, PAPER_PLANE_LABEL) && hasBodyLabel(pair.bodyB, GROUND_LABEL)) ||
          (hasBodyLabel(pair.bodyA, GROUND_LABEL) && hasBodyLabel(pair.bodyB, PAPER_PLANE_LABEL))
        );
      });

      if (touchedGround) {
        this.handleLanding();
      }
    });
  }

  private refreshSkillButtons(): void {
    this.skillButtons.forEach((button, index) => {
      const skillState = this.skillStates[index];
      if (!skillState) {
        return;
      }

      button.setText(formatSkillButtonLabel(skillState, this.time.now));
      button.setAlpha(skillState.isReady && this.hasLaunched && !this.hasLanded ? 1 : 0.5);
    });
  }

  private tryActivateSkill(index: number): void {
    if (!this.hasLaunched || this.hasLanded) {
      this.skillStatusText?.setText('技能待命：请先完成发射再触发主动技能');
      return;
    }

    const skillState = this.skillStates[index];
    if (!skillState) {
      return;
    }

    if (!skillState.isReady) {
      this.skillStatusText?.setText(`技能冷却中：${skillState.skill.name}`);
      return;
    }

    const activation = activateSkill(skillState.skill, this.time.now);
    this.activeBuffs = [...this.activeBuffs, activation.buff];
    this.skillStates = this.skillStates.map((currentSkillState, skillIndex) =>
      skillIndex === index
        ? {
            ...currentSkillState,
            cooldownEnd: activation.cooldownEnd,
            uses: currentSkillState.uses + 1,
            isReady: false,
          }
        : currentSkillState,
    );
    this.applySpecialSkillEffect(activation.buff.specialEffect);
    this.skillStatusText?.setText(`技能触发：${skillState.skill.name}`);
    this.refreshSkillButtons();
  }

  private checkPassiveSkills(speed: number, verticalVelocity: number): void {
    const triggerType =
      this.weather.condition === 'headwind'
        ? 'on_headwind'
        : speed < MIN_STALL_SPEED && verticalVelocity > MIN_STALL_VERTICAL_VELOCITY
          ? 'on_stall'
          : undefined;

    if (!triggerType) {
      return;
    }

    const matchingSkill = this.passiveSkills.find(
      (skill) => !this.triggeredPassiveSkillIds.has(skill.id) && checkPassiveTrigger(skill, { type: triggerType }),
    );

    if (!matchingSkill) {
      return;
    }

    this.triggeredPassiveSkillIds.add(matchingSkill.id);
    const buff = createSkillBuff(matchingSkill, this.time.now);
    this.activeBuffs = [...this.activeBuffs, buff];
    this.applySpecialSkillEffect(buff.specialEffect);
    this.skillStatusText?.setText(`被动触发：${matchingSkill.name}`);
  }

  private applySpecialSkillEffect(specialEffect: string | undefined): void {
    if (!this.airplane || !specialEffect) {
      return;
    }

    if (specialEffect === 'turn_pitch_45_degrees') {
      this.airplane.setRotation(this.airplane.rotation - Phaser.Math.DegToRad(45));
      this.airplane.applyForce(new Phaser.Math.Vector2(0.006, -0.008));
      return;
    }

    if (specialEffect === 'phoenix_rise_once') {
      this.airplane.applyForce(new Phaser.Math.Vector2(0, -0.012));
    }
  }

  private hasActiveSpecialEffect(specialEffect: string): boolean {
    return this.activeBuffs.some((buff) => buff.specialEffect === specialEffect);
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.airplane || this.hasLaunched) {
      return;
    }

    const pointerPosition = { x: pointer.worldX, y: pointer.worldY };
    const distanceToPlane = vectorMagnitude(subtractVectors(pointerPosition, { x: this.airplane.x, y: this.airplane.y }));

    if (distanceToPlane > PLANE_PICK_RADIUS) {
      return;
    }

    this.isDragging = true;
    this.updateDrag(pointer);
  }

  private updateDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.airplane || !this.guideGraphics || !this.trajectoryGraphics || !this.statusText || !this.isDragging) {
      return;
    }

    const dragPosition = this.resolveDragPosition({ x: pointer.worldX, y: pointer.worldY });
    const launch = calculateLaunchVector({
      anchor: LAUNCH_ANCHOR,
      dragPosition,
      maxDragDistance: MAX_DRAG_DISTANCE,
      speedStat: this.airplaneStats.speed,
    });

    this.airplane.setPosition(dragPosition.x, dragPosition.y);
    this.airplane.setRotation(launch.angleRadians);
    this.drawGuides(dragPosition, predictTrajectoryPoints({ gravity: 0.5, launchForce: launch.force, origin: dragPosition }));
    this.statusText.setText([
      `蓄力 ${(launch.power * 100).toFixed(0)}% · 发射角 ${formatSignedAngle((launch.angleRadians * 180) / Math.PI)}`,
      '虚线为预测轨迹，松手后将施加 Matter.js 发射力。',
      '请避免把飞机拖到地面以下。',
    ]);
  }

  private resolveDragPosition(pointerPosition: Vector2Like): Vector2Like {
    const offset = subtractVectors(pointerPosition, LAUNCH_ANCHOR);
    const distance = vectorMagnitude(offset);
    const clampedDistance = Math.min(distance, MAX_DRAG_DISTANCE);
    const ratio = distance === 0 ? 0 : clampedDistance / distance;
    const rawX = LAUNCH_ANCHOR.x + offset.x * ratio;
    const rawY = LAUNCH_ANCHOR.y + offset.y * ratio;

    return {
      x: clamp(rawX, 24, GAME_WIDTH - 24),
      y: clamp(rawY, 70, GROUND_TOP_Y - 18),
    };
  }

  private drawGuides(origin: Vector2Like, trajectoryPoints: Vector2Like[]): void {
    this.guideGraphics?.clear();
    this.trajectoryGraphics?.clear();

    this.guideGraphics?.lineStyle(2, 0x38bdf8, 0.9);
    this.guideGraphics?.lineBetween(LAUNCH_ANCHOR.x, LAUNCH_ANCHOR.y, origin.x, origin.y);

    let previousPoint = origin;

    trajectoryPoints.forEach((point, index) => {
      if (point.y > GROUND_TOP_Y) {
        return;
      }

      if (index % 2 === 0) {
        this.trajectoryGraphics?.lineStyle(2, 0xf8fafc, 0.8);
        this.trajectoryGraphics?.lineBetween(previousPoint.x, previousPoint.y, point.x, point.y);
      }

      previousPoint = point;
    });
  }

  private releaseDrag(): void {
    if (!this.airplane || !this.isDragging) {
      return;
    }

    this.isDragging = false;

    const launch = calculateLaunchVector({
      anchor: LAUNCH_ANCHOR,
      dragPosition: { x: this.airplane.x, y: this.airplane.y },
      maxDragDistance: MAX_DRAG_DISTANCE,
      speedStat: this.airplaneStats.speed,
    });

    if (launch.power <= 0.05) {
      this.resetAirplane();
      return;
    }

    this.opponentLaunchParams = calculateAILaunchParams(this.opponent, this.weather);
    const simulatedOpponentFlight = simulateOpponentFlight(
      this.opponentLaunchParams,
      this.opponentStats,
      this.weather,
      AI_SIMULATION_DURATION_SECONDS,
      this.opponent,
    );
    const simulatedOpponentScore = generateOpponentScore(simulatedOpponentFlight);
    this.opponentResult = {
      id: this.opponent.id,
      name: this.opponent.name,
      title: this.opponent.title,
      personality: this.opponent.personality,
      distance: simulatedOpponentFlight.distancePx,
      flightTimeMs: simulatedOpponentFlight.flightTimeMs,
      score: simulatedOpponentScore.totalScore,
      launchAngleDegrees: this.opponentLaunchParams.angleDegrees,
      launchPower: this.opponentLaunchParams.power,
    };
    this.hasLaunched = true;
    this.flightStartTime = this.time.now;
    this.launchStartX = this.airplane.x;
    this.maxFlightX = this.airplane.x;
    this.cameras.main.startFollow(
      this.airplane,
      true,
      CAMERA_LERP_FACTOR,
      CAMERA_LERP_FACTOR,
      CAMERA_HORIZONTAL_OFFSET,
      0,
    );
    this.guideGraphics?.clear();
    this.trajectoryGraphics?.clear();
    this.airplane.setStatic(false);
    this.airplane.setAngularVelocity(0);
    this.airplane.applyForce(toPhaserVector(scaleVector(launch.force, LAUNCH_FORCE_MULTIPLIER)));
    this.updateProgressMarkers(0, 0);
  }

  private updatePitchDirection(pointer: Phaser.Input.Pointer): void {
    this.pitchDirection = pointer.y <= GAME_HEIGHT / 2 ? 'up' : 'down';
  }

  private resolveAnimatedOpponentDistance(elapsedMs: number): number {
    if (!this.opponentResult) {
      return 0;
    }

    const progress = clamp(elapsedMs / Math.max(this.opponentResult.flightTimeMs, 1), 0, 1);
    return this.opponentResult.distance * progress;
  }

  private updateProgressMarkers(playerDistance: number, opponentDistance: number): void {
    const maxDistance = Math.max(
      MIN_PROGRESS_DENOMINATOR,
      playerDistance,
      opponentDistance,
      this.opponentResult?.distance ?? 0,
    );
    const playerProgress = clamp(playerDistance / maxDistance, 0, 1);
    const opponentProgress = clamp(opponentDistance / maxDistance, 0, 1);

    this.playerProgressMarker?.setX(lerp(PROGRESS_TRACK_START_X, PROGRESS_TRACK_END_X, playerProgress));
    this.opponentProgressMarker?.setX(lerp(PROGRESS_TRACK_START_X, PROGRESS_TRACK_END_X, opponentProgress));
  }

  private handleLanding(reason: 'landed' | 'out_of_bounds' = 'landed'): void {
    if (!this.airplane || !this.statusText) {
      return;
    }

    this.hasLanded = true;
    this.pitchDirection = 'neutral';
    this.airplane.setVelocity(0, 0);
    this.airplane.setAngularVelocity(0);
    this.airplane.setStatic(true);

    const distance = Math.max(0, Math.round(this.maxFlightX - this.launchStartX));
    const flightTimeMs = Math.max(0, Math.round(this.time.now - this.flightStartTime));
    const score = calculateFlightScore({ distancePx: distance, flightTimeMs });
    const playerResult: RaceParticipantResult = {
      name: `你 · ${this.airplaneName}`,
      distance,
      flightTimeMs,
      score: score.totalScore,
      isPlayer: true,
    };
    const rankings = rankParticipants(
      this.opponentResult ? [playerResult, this.opponentResult] : [playerResult],
    );
    const playerRank = rankings.findIndex((entry) => entry.isPlayer) + 1;
    const hasOpponent = this.opponentResult !== undefined;
    const beatOpponent = hasOpponent && playerRank === 1;

    this.resultData = {
      distance,
      flightTimeMs,
      score: score.totalScore,
      playerName: this.airplaneName,
      opponentResult: this.opponentResult,
      rankings,
      airplaneId: this.currentRaceSceneData.airplaneId,
      replayData: this.currentRaceSceneData.tournamentRun ? undefined : this.currentRaceSceneData,
      scoreBreakdown: {
        distanceScore: score.distanceScore,
        airtimeScore: score.airtimeScore,
      },
      summary: generateRaceSummary({
        airplaneName: this.airplaneName,
        opponent: this.opponent,
        opponentResult: this.opponentResult,
        playerScore: score.totalScore,
        beatOpponent,
        reason,
        weather: this.weather,
      }),
    };

    if (this.currentRaceSceneData.tournamentRun && this.currentRaceSceneData.tournamentNodeId) {
      const completion = completeRace(
        this.currentRaceSceneData.tournamentRun,
        createTournamentRaceResult({
          nodeId: this.currentRaceSceneData.tournamentNodeId,
          playerRank,
          rankings,
          distance,
          flightTimeMs,
          weather: this.weather,
          opponent: this.opponent,
          opponentResult: this.opponentResult,
        }),
      );
      this.resultData = {
        ...this.resultData,
        nextTournamentRun: completion.nextRun,
        rewardOptions: completion.rewardOptions,
        specialRewards: completion.specialRewards,
      };

      if (completion.nextRun.status === 'in_progress') {
        if (GameState.getInstance().getSaveData()) {
          GameState.getInstance().setCurrentRun(completion.nextRun);
          void persistGameState({
            auto: true,
          });
        }
      } else if (completion.nextRun.status === 'defeat') {
        const currentSaveData = GameState.getInstance().getSaveData();

        if (!currentSaveData) {
          return;
        }

        const settlement = settleCompletedRun(currentSaveData, completion.nextRun);

        GameState.getInstance().updateSaveData(() => settlement.saveData);
        void persistGameState();
        this.resultData = {
          ...this.resultData,
          runCompletionSummary: describeCompletedRunSettlement(settlement),
          runSettlementApplied: true,
        };
      } else if (GameState.getInstance().getSaveData()) {
        GameState.getInstance().setCurrentRun(completion.nextRun);
      }
    }

    this.finishButton?.setAlpha(1);
    this.updateProgressMarkers(distance, this.opponentResult?.distance ?? 0);
    this.statusText.setText([
      `${reason === 'landed' ? '已着陆' : '已越界'}：飞行距离 ${distance}px · 滞空 ${(flightTimeMs / 1000).toFixed(2)}s`,
      `总分 ${score.totalScore}（距离 ${score.distanceScore} + 滞空 ${score.airtimeScore}）`,
      this.opponentResult
        ? `对手 ${this.opponent.name}：${this.opponentResult.score} 分 · 距离 ${this.opponentResult.distance}px · 滞空 ${(this.opponentResult.flightTimeMs / 1000).toFixed(2)}s`
        : '本轮未生成对手数据。',
      `天气 ${this.weather.displayName} ${getWindDirectionArrow(this.weather)} · 风力 ${this.weather.windStrength}`,
      '点击“进入结算”继续，或点击“重新试飞”立刻再来一次。',
      '桌面端也可按 Enter 继续、按 R 快速重置。',
    ]);
    this.renderTelemetry(0, Math.max(0, Math.round(GROUND_TOP_Y - this.airplane.y)), distance, this.opponentResult?.distance ?? 0);
  }

  private finishRace(): void {
    if (!this.hasLanded) {
      this.statusText?.setText([
        '请先完成一次发射并等待飞机碰地停止。',
        '拖拽纸飞机松手即可开始本轮测试。',
        '移动端可点击“重新试飞”，桌面端也可按 R 重置场景。',
      ]);
      return;
    }

    this.scene.start(FINISH_RACE_BUTTON.target, this.resultData);
  }

  private resetAirplane(): void {
    if (!this.airplane || !this.statusText) {
      return;
    }

    this.isDragging = false;
    this.hasLaunched = false;
    this.hasLanded = false;
    this.opponentLaunchParams = undefined;
    this.opponentResult = undefined;
    this.activeBuffs = [];
    this.skillStates = this.skillStates.map((skillState) => ({
      ...skillState,
      cooldownEnd: 0,
      isReady: true,
      uses: 0,
    }));
    this.triggeredPassiveSkillIds.clear();
    this.launchStartX = LAUNCH_ANCHOR.x;
    this.maxFlightX = LAUNCH_ANCHOR.x;
    this.pitchDirection = 'neutral';
    this.cameras.main.stopFollow();
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
    this.airplane.setPosition(LAUNCH_ANCHOR.x, LAUNCH_ANCHOR.y);
    this.airplane.setVelocity(0, 0);
    this.airplane.setAngularVelocity(0);
    this.airplane.setRotation(0);
    this.airplane.setStatic(true);
    this.guideGraphics?.clear();
    this.trajectoryGraphics?.clear();
    this.finishButton?.setAlpha(0.45);
    this.updateProgressMarkers(0, 0);
    this.lastRenderedSpeed = -1;
    this.statusText.setText([
      '将纸飞机向后拖拽蓄力，松手即可发射。',
      `对手 ${this.opponent.name}（${formatOpponentPersonality(this.opponent.personality)}）会同步起飞并给出预估成绩。`,
      `当前天气：${this.weather.displayName} ${getWindDirectionArrow(this.weather)} · 风力 ${this.weather.windStrength}`,
      '发射后可轻触并按住上/下半屏微调机头，松开后会自动顺着速度方向滑翔。',
      '目标：观察飞机着陆或越界后进入带排名、奖励与技能反馈的计分结算。',
    ]);
    this.relativePositionText?.setText('相对位置：等待发射');
    this.buffStatusText?.setText('Buff：当前无 Buff');
    this.skillStatusText?.setText(this.skillStates.length > 0 ? '技能待命：点击下方按钮触发' : '技能待命：当前未装备主动技能');
    this.flightMetricsText?.setText([
      '高度 0px · 距离 0px',
      `风向 ${getWindDirectionArrow(this.weather)} · 风力 ${this.weather.windStrength} · AI 0px`,
    ]);
    this.renderSpeedGauge(0);
    this.refreshSkillButtons();
  }
}
