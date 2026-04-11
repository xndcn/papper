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
import {
  calculateAerodynamicForce,
  calculateAngleOfAttackDegrees,
  calculateLaunchVector,
  getAerodynamicCoefficients,
  predictTrajectoryPoints,
  resolvePitchControlAngularVelocity,
  type PitchControlDirection,
} from '@/systems/PhysicsSystem';
import { calculateFlightScore, isFlightOutOfBounds } from '@/systems/RaceSystem';
import type { ResultSceneData, SceneNavigationButton } from '@/types';
import { clamp, scaleVector, subtractVectors, vectorMagnitude, type Vector2Like } from '@/utils/math';

const FINISH_RACE_BUTTON: SceneNavigationButton = {
  label: '进入结算',
  target: SCENE_KEYS.RESULT,
};

const PAPER_PLANE_TEXTURE_KEY = 'paper-plane-step3';
const PAPER_PLANE_LABEL = 'paper-plane';
const GROUND_LABEL = 'ground';
const LAUNCH_ANCHOR: Vector2Like = { x: 116, y: 178 };
const MAX_DRAG_DISTANCE = 72;
const PAPER_PLANE_SPEED_STAT = 6;
const GROUND_HEIGHT = 34;
const GROUND_TOP_Y = GAME_HEIGHT - GROUND_HEIGHT;
const PLANE_PICK_RADIUS = 28;
const RACE_WORLD_WIDTH = 2200;
// Scene-level tuning is intentionally higher than PhysicsSystem defaults so Step 4 feels readable in-browser.
const LIFT_FORCE_MULTIPLIER = 0.00009;
const DRAG_FORCE_MULTIPLIER = 0.00002;
const MIN_AERODYNAMIC_SPEED = 1.4;
const CAMERA_LERP_FACTOR = 0.08;
const CAMERA_HORIZONTAL_OFFSET = -GAME_WIDTH * 0.18;
const LAUNCH_FORCE_MULTIPLIER = 3.5;
const FLIGHT_BOUNDS = {
  minX: 0,
  maxX: RACE_WORLD_WIDTH - 28,
  minY: -120,
  maxY: GAME_HEIGHT + 120,
} as const;

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

export class RaceScene extends Phaser.Scene {
  private airplane?: Phaser.Physics.Matter.Image;
  private guideGraphics?: Phaser.GameObjects.Graphics;
  private trajectoryGraphics?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private finishButton?: Phaser.GameObjects.Text;
  private isDragging = false;
  private hasLaunched = false;
  private hasLanded = false;
  private flightStartTime = 0;
  private launchStartX = LAUNCH_ANCHOR.x;
  private maxFlightX = LAUNCH_ANCHOR.x;
  private pitchDirection: PitchControlDirection = 'neutral';
  private resultData: ResultSceneData = {
    distance: 0,
    flightTimeMs: 0,
    score: 0,
    summary: '请先完成一次拖拽发射。',
  };

  constructor() {
    super(SCENE_KEYS.RACE);
  }

  create(): void {
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
    this.statusText = this.add.text(24, 58, '', SCENE_SUBTITLE_STYLE).setScrollFactor(0);

    this.registerInput();
    this.registerCollisionListener();
    this.resetAirplane();
  }

  update(): void {
    if (!this.airplane || !this.statusText || !this.hasLaunched || this.hasLanded) {
      return;
    }

    const velocity = this.airplane.body?.velocity ?? { x: 0, y: 0 };
    const currentAngularVelocity = this.airplane.body?.angularVelocity ?? 0;
    const aerodynamicForce = calculateAerodynamicForce({
      airplaneAngleRadians: this.airplane.rotation,
      velocity,
      liftMultiplier: LIFT_FORCE_MULTIPLIER,
      dragMultiplier: DRAG_FORCE_MULTIPLIER,
      minSpeed: MIN_AERODYNAMIC_SPEED,
    });

    this.airplane.applyForce(toPhaserVector(aerodynamicForce));
    this.airplane.setAngularVelocity(
      resolvePitchControlAngularVelocity({
        currentAngularVelocity,
        direction: this.pitchDirection,
      }),
    );

    if (isFlightOutOfBounds({ x: this.airplane.x, y: this.airplane.y }, FLIGHT_BOUNDS)) {
      this.handleLanding('out_of_bounds');
      return;
    }

    const speed = vectorMagnitude(velocity);
    this.maxFlightX = Math.max(this.maxFlightX, this.airplane.x);
    const angleOfAttack = calculateAngleOfAttackDegrees(this.airplane.rotation, velocity);
    const coefficients = getAerodynamicCoefficients(angleOfAttack);

    this.statusText.setText([
      `速度 ${speed.toFixed(2)} px/s · 攻角 ${formatSignedAngle(angleOfAttack)}`,
      `升力系数 ${coefficients.lift.toFixed(2)} · 阻力系数 ${coefficients.drag.toFixed(3)}`,
      `飞行控制：${this.pitchDirection === 'neutral' ? '未输入' : this.pitchDirection === 'up' ? '抬头' : '压头'} · 上半屏抬头 / 下半屏压头`,
    ]);
  }

  private createRaceHud(): void {
    this.add.text(GAME_WIDTH / 2, 26, '飞行体验测试场', SCENE_TITLE_STYLE).setOrigin(0.5).setScrollFactor(0);
    this.add
      .text(
        GAME_WIDTH / 2,
        48,
        'Step 4：升阻力 + 俯仰控制 + 相机跟随视差 + 着陆/越界计分',
        SCENE_SUBTITLE_STYLE,
      )
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.add
      .text(24, GAME_HEIGHT - 18, '拖拽发射后，轻触上/下半屏微调机头；按 R 可重置本次尝试。', SCENE_HINT_STYLE)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
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
      frictionAir: 0.0025,
      frictionStatic: 0.6,
      label: PAPER_PLANE_LABEL,
      restitution: 0.05,
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
      this.scene.restart();
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
      speedStat: PAPER_PLANE_SPEED_STAT,
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
      speedStat: PAPER_PLANE_SPEED_STAT,
    });

    if (launch.power <= 0.05) {
      this.resetAirplane();
      return;
    }

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
  }

  private updatePitchDirection(pointer: Phaser.Input.Pointer): void {
    this.pitchDirection = pointer.y <= GAME_HEIGHT / 2 ? 'up' : 'down';
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

    this.resultData = {
      distance,
      flightTimeMs,
      score: score.totalScore,
      summary:
        reason === 'landed'
          ? 'Step 4 原型验证完成：已实现升阻力模拟、俯仰微调、相机跟随视差与着陆计分。'
          : 'Step 4 原型验证完成：飞机越界后会结束本轮，并按飞行距离与滞空时间计分。',
    };

    this.finishButton?.setAlpha(1);
    this.statusText.setText([
      `${reason === 'landed' ? '已着陆' : '已越界'}：飞行距离 ${distance}px · 滞空 ${(flightTimeMs / 1000).toFixed(2)}s`,
      `总分 ${score.totalScore}（距离 ${score.distanceScore} + 滞空 ${score.airtimeScore}）`,
      '点击“进入结算”或按 Enter 继续。',
      '按 R 可重新回到本场景起点再次测试。',
    ]);
  }

  private finishRace(): void {
    if (!this.hasLanded) {
      this.statusText?.setText([
        '请先完成一次发射并等待飞机碰地停止。',
        '拖拽纸飞机松手即可开始本轮测试。',
        '按 R 可重置场景。',
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
    this.statusText.setText([
      '将纸飞机向后拖拽蓄力，松手即可发射。',
      '发射后可轻触上/下半屏微调机头，并观察升力效果与相机跟随。',
      '目标：观察飞机着陆或越界后进入计分结算。',
    ]);
  }
}
