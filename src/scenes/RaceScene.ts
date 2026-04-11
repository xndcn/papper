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
  calculateAngleOfAttackDegrees,
  calculateLaunchVector,
  getAerodynamicCoefficients,
  predictTrajectoryPoints,
} from '@/systems/PhysicsSystem';
import type { ResultSceneData, SceneNavigationButton } from '@/types';
import { clamp, subtractVectors, vectorMagnitude, type Vector2Like } from '@/utils/math';

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
  private resultData: ResultSceneData = {
    distance: 0,
    flightTimeMs: 0,
    summary: '请先完成一次拖拽发射。',
  };

  constructor() {
    super(SCENE_KEYS.RACE);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.createRaceHud();
    this.createGround();
    this.createAnchorMarker();
    this.createPlaneTexture();

    this.guideGraphics = this.add.graphics();
    this.trajectoryGraphics = this.add.graphics();
    this.airplane = this.createAirplane();
    this.finishButton = this.createFinishButton();
    this.statusText = this.add.text(24, 58, '', SCENE_SUBTITLE_STYLE);

    this.registerInput();
    this.registerCollisionListener();
    this.resetAirplane();
  }

  update(): void {
    if (!this.airplane || !this.statusText || !this.hasLaunched || this.hasLanded) {
      return;
    }

    const velocity = this.airplane.body?.velocity ?? { x: 0, y: 0 };
    const speed = vectorMagnitude(velocity);
    const angleOfAttack = calculateAngleOfAttackDegrees(this.airplane.rotation, velocity);
    const coefficients = getAerodynamicCoefficients(angleOfAttack);

    this.statusText.setText([
      `速度 ${speed.toFixed(2)} px/s · 攻角 ${formatSignedAngle(angleOfAttack)}`,
      `升力系数 ${coefficients.lift.toFixed(2)} · 阻力系数 ${coefficients.drag.toFixed(3)}`,
      '等待落地后进入结算，按 R 可立即重置本次发射。',
    ]);
  }

  private createRaceHud(): void {
    this.add.text(GAME_WIDTH / 2, 26, '物理发射测试场', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 48, 'Step 3：拖拽纸飞机并松手，验证刚体飞行、轨迹预览与地面碰撞', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);
    this.add
      .text(24, GAME_HEIGHT - 18, '拖拽飞机蓄力，松手发射；按 R 可重置本次尝试。', SCENE_HINT_STYLE)
      .setOrigin(0, 0.5);
  }

  private createGround(): void {
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT, 0x1e293b);
    this.add.rectangle(GAME_WIDTH / 2, GROUND_TOP_Y, GAME_WIDTH, 2, 0x94a3b8);
    this.matter.add.rectangle(GAME_WIDTH / 2, GROUND_TOP_Y + GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT, {
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
      frictionAir: 0.012,
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
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.finishRace();
      });
  }

  private registerInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.beginDrag(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateDrag(pointer);
    });
    this.input.on('pointerup', () => {
      this.releaseDrag();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.finishRace();
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.scene.restart();
    });
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
    this.guideGraphics?.clear();
    this.trajectoryGraphics?.clear();
    this.airplane.setStatic(false);
    this.airplane.setAngularVelocity(0);
    this.airplane.applyForce(toPhaserVector(launch.force));
  }

  private handleLanding(): void {
    if (!this.airplane || !this.statusText) {
      return;
    }

    this.hasLanded = true;
    this.airplane.setVelocity(0, 0);
    this.airplane.setAngularVelocity(0);
    this.airplane.setStatic(true);

    const distance = Math.max(0, Math.round(this.airplane.x - LAUNCH_ANCHOR.x));
    const flightTimeMs = Math.max(0, Math.round(this.time.now - this.flightStartTime));

    this.resultData = {
      distance,
      flightTimeMs,
      summary: 'Step 3 原型验证完成：已实现拖拽发射、轨迹预览、刚体飞行与地面碰撞停止。',
    };

    this.finishButton?.setAlpha(1);
    this.statusText.setText([
      `已着陆：飞行距离 ${distance}px · 滞空 ${(flightTimeMs / 1000).toFixed(2)}s`,
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
      '发射后会实时显示攻角与查表得到的升阻力系数。',
      '目标：观察飞机飞行后碰地并停止。',
    ]);
  }
}
