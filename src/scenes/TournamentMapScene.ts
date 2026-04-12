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
  abandonRun,
  createTournamentRun,
  getAvailableNodes,
  getNodeById,
  selectNode,
  startRace,
} from '@/systems/TournamentSystem';
import type { SceneNavigationButton, TournamentMapSceneData, TournamentNode, TournamentNodeType, TournamentRun } from '@/types';
import { persistGameState } from '@/utils/gamePersistence';
import { GameState } from '@/utils/GameState';

const NODE_COLORS: Record<TournamentNodeType, number> = {
  race: 0x38bdf8,
  elite: 0xf97316,
  shop: 0xfacc15,
  rest: 0x34d399,
  event: 0xa78bfa,
  boss: 0xef4444,
};

const NODE_LABELS: Record<TournamentNodeType, string> = {
  race: '赛',
  elite: '精',
  shop: '店',
  rest: '休',
  event: '?',
  boss: '冠',
};

const MAP_PANEL_STYLE = {
  ...SCENE_SUBTITLE_STYLE,
  backgroundColor: '#162033',
  padding: {
    x: 8,
    y: 6,
  },
} as const;

const ABANDON_BUTTON: SceneNavigationButton = {
  label: '放弃 Run',
  target: SCENE_KEYS.MAIN_MENU,
};
const NODE_CENTER_X_OFFSET = 24;
const NODE_CENTER_Y_OFFSET = 12;
const NODE_LABEL_Y_OFFSET = 34;
const CONNECTION_Y_OFFSET = 52;

function formatNodeTypeLabel(type: TournamentNodeType): string {
  switch (type) {
    case 'race':
      return '普通比赛';
    case 'elite':
      return '精英挑战';
    case 'shop':
      return '商店';
    case 'rest':
      return '休息站';
    case 'event':
      return '随机事件';
    case 'boss':
      return '馆主决战';
  }
}

function describeNode(node: TournamentNode): string {
  if (node.opponent) {
    return [
      `对手：${node.opponent.name} · ${node.opponent.title}`,
      `难度：${node.difficulty}`,
      `开场对白：${node.opponent.dialogues.greeting}`,
      `奖励：${node.rewards.map((reward) => reward.type).join(' / ') || '无'}`,
    ].join('\n');
  }

  if (node.type === 'shop') {
    return buildShopNodeDescription(node);
  }

  if (node.type === 'event') {
    return node.eventData?.description ?? '未知事件，等待展开。';
  }

  return '短暂整理纸翼状态后继续推进。';
}

function buildShopNodeDescription(node: TournamentNode): string {
  const inventorySummary =
    node.shopInventory && node.shopInventory.length > 0 ? node.shopInventory.map((part) => part.name).join('、') : '待补货';
  return `补给橱窗：${inventorySummary}\n先记录本层补给信息，再继续前往下一层路径。`;
}

export class TournamentMapScene extends Phaser.Scene {
  private currentRun!: TournamentRun;
  private preferredAirplaneId?: string;
  private selectedNodeId?: string;
  private feedbackMessage = '';
  private abandonArmed = false;
  private infoTitleText?: Phaser.GameObjects.Text;
  private infoBodyText?: Phaser.GameObjects.Text;
  private confirmButton?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private abandonButton?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.TOURNAMENT_MAP);
  }

  create(data?: TournamentMapSceneData): void {
    this.currentRun = data?.run ?? GameState.getInstance().getCurrentRun() ?? createTournamentRun(Date.now());
    this.preferredAirplaneId = data?.airplaneId;
    this.feedbackMessage = data?.message ?? '';
    this.selectedNodeId = getAvailableNodes(this.currentRun)[0]?.id;
    this.abandonArmed = false;

    this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
    this.add.text(GAME_WIDTH / 2, 18, '锦标赛路径地图', SCENE_TITLE_STYLE).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 38, '选择当前可达节点，推进本次 Roguelike Run', SCENE_SUBTITLE_STYLE)
      .setOrigin(0.5);

    this.createProgressPanel();
    this.drawConnections();
    this.drawNodes();
    this.createInfoPanel();
    this.createActionButtons();
    this.refreshSelectionPanel();
  }

  private createProgressPanel(): void {
    const clearedLayers = Math.max(0, this.currentRun.currentLayer + 1);
    this.add
      .text(
        20,
        56,
        `进度 ${clearedLayers}/${this.currentRun.map.totalLayers} · 金币 ${this.currentRun.runCoins} · 零件 ${this.currentRun.collectedParts.length}`,
        MAP_PANEL_STYLE,
      )
      .setOrigin(0, 0);
    this.add
      .text(
        20,
        82,
        this.currentRun.currentNodeId
          ? `当前节点：${formatNodeTypeLabel(getNodeById(this.currentRun.map, this.currentRun.currentNodeId)?.type ?? 'race')}`
          : '当前节点：起点',
        SCENE_HINT_STYLE,
      )
      .setOrigin(0, 0);
  }

  private drawConnections(): void {
    const graphics = this.add.graphics();
    const visitedNodeIds = new Set(this.currentRun.visitedNodeIds);

    for (const layer of this.currentRun.map.layers) {
      for (const node of layer) {
        for (const connectionId of node.connections) {
          const targetNode = getNodeById(this.currentRun.map, connectionId);

          if (!targetNode) {
            continue;
          }

          const isVisitedPath = visitedNodeIds.has(node.id) && visitedNodeIds.has(targetNode.id);
          graphics.lineStyle(2, isVisitedPath ? 0x64748b : 0x334155, isVisitedPath ? 0.9 : 0.55);
          graphics.beginPath();
          graphics.moveTo(node.position.x + NODE_CENTER_X_OFFSET, node.position.y + CONNECTION_Y_OFFSET);
          graphics.lineTo(targetNode.position.x + NODE_CENTER_X_OFFSET, targetNode.position.y + CONNECTION_Y_OFFSET);
          graphics.strokePath();
        }
      }
    }
  }

  private drawNodes(): void {
    const availableNodeIds = new Set(getAvailableNodes(this.currentRun).map((node) => node.id));
    const visitedNodeIds = new Set(this.currentRun.visitedNodeIds);

    for (const layer of this.currentRun.map.layers) {
      for (const node of layer) {
        const isAvailable = availableNodeIds.has(node.id);
        const isVisited = visitedNodeIds.has(node.id);
        const container = this.add.container(node.position.x, node.position.y + 40);
        const nodeBadge = this.add.circle(
          NODE_CENTER_X_OFFSET,
          NODE_CENTER_Y_OFFSET,
          13,
          NODE_COLORS[node.type],
          isVisited ? 0.4 : isAvailable ? 1 : 0.72,
        );
        const nodeLabel = this.add
          .text(NODE_CENTER_X_OFFSET, NODE_CENTER_Y_OFFSET, NODE_LABELS[node.type], SCENE_SUBTITLE_STYLE)
          .setOrigin(0.5);

        if (isAvailable) {
          const highlight = this.add
            .circle(NODE_CENTER_X_OFFSET, NODE_CENTER_Y_OFFSET, 18)
            .setStrokeStyle(2, 0xf8fafc, 0.85);
          this.tweens.add({
            targets: highlight,
            alpha: { from: 0.4, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1,
          });
          container.add(highlight);
        }

        if (this.currentRun.currentNodeId === node.id) {
          container.add(this.add.circle(NODE_CENTER_X_OFFSET, NODE_CENTER_Y_OFFSET, 22).setStrokeStyle(2, 0xf8fafc, 1));
        }

        container.add([nodeBadge, nodeLabel]);
        container.add(this.add.text(NODE_CENTER_X_OFFSET, NODE_LABEL_Y_OFFSET, formatNodeTypeLabel(node.type), SCENE_HINT_STYLE).setOrigin(0.5));
        container.setSize(48, 48);
        container.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, 48, 48),
          Phaser.Geom.Rectangle.Contains,
        );
        container.on('pointerdown', () => {
          this.selectedNodeId = node.id;
          this.abandonArmed = false;
          this.refreshAbandonButton();
          this.refreshSelectionPanel();
        });
      }
    }
  }

  private createInfoPanel(): void {
    this.add.rectangle(GAME_WIDTH - 128, GAME_HEIGHT / 2, 192, 150, 0x0f172a, 0.96).setStrokeStyle(2, 0x334155);
    this.infoTitleText = this.add.text(GAME_WIDTH - 214, 82, '', SCENE_SUBTITLE_STYLE);
    this.infoBodyText = this.add.text(GAME_WIDTH - 214, 104, '', SCENE_HINT_STYLE).setWordWrapWidth(164);
    this.feedbackText = this.add.text(GAME_WIDTH - 214, 222, this.feedbackMessage, SCENE_HINT_STYLE).setWordWrapWidth(164);
    this.confirmButton = this.add
      .text(GAME_WIDTH - 128, 196, '确认选择', SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        void this.confirmSelection();
      });
  }

  private createActionButtons(): void {
    this.abandonButton = this.add
      .text(72, GAME_HEIGHT - 26, ABANDON_BUTTON.label, SCENE_BUTTON_STYLE)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.abandonArmed) {
          this.abandonArmed = true;
          this.refreshAbandonButton();
          this.feedbackText?.setText('再次点击“放弃 Run”将结束本次进度并返回主菜单。');
          return;
        }

        void this.abandonCurrentRun();
      });
  }

  private refreshSelectionPanel(): void {
    const node = this.selectedNodeId ? getNodeById(this.currentRun.map, this.selectedNodeId) : undefined;
    const availableNodeIds = new Set(getAvailableNodes(this.currentRun).map((availableNode) => availableNode.id));

    if (!node) {
      this.infoTitleText?.setText('暂无可选节点');
      this.infoBodyText?.setText('当前 Run 已结束，请返回主菜单。');
      this.confirmButton?.setAlpha(0.45);
      return;
    }

    const isAvailable = availableNodeIds.has(node.id);
    this.infoTitleText?.setText(`${formatNodeTypeLabel(node.type)} · ${isAvailable ? '可前往' : '暂不可达'}`);
    this.infoBodyText?.setText(describeNode(node));
    this.feedbackText?.setText(this.feedbackMessage);
    this.confirmButton?.setText(node.type === 'race' || node.type === 'elite' || node.type === 'boss' ? '前往构建' : '确认前往');
    this.confirmButton?.setAlpha(isAvailable ? 1 : 0.45);
  }

  private refreshAbandonButton(): void {
    if (!this.abandonButton) {
      return;
    }

    this.abandonButton.setText(this.abandonArmed ? '确认放弃？' : ABANDON_BUTTON.label);
    this.abandonButton.setStyle({
      ...SCENE_BUTTON_STYLE,
      backgroundColor: this.abandonArmed ? '#b91c1c' : SCENE_BUTTON_STYLE.backgroundColor,
    });
  }

  private async abandonCurrentRun(): Promise<void> {
    const currentSaveData = GameState.getInstance().getSaveData();

    if (currentSaveData) {
      const abandonedTournamentRun = abandonRun(this.currentRun);
      GameState.getInstance().updateSaveData((saveData) => {
        const saveWithoutRun = { ...saveData };
        Reflect.deleteProperty(saveWithoutRun, 'activeTournamentRun');

        return {
          ...saveWithoutRun,
          lastSavedAt: Date.now(),
        };
      });
      await persistGameState();
      this.scene.start(ABANDON_BUTTON.target, {
        message: `已放弃本次 Run（状态：${abandonedTournamentRun.status}），现在可以开始新的锦标赛。`,
      });
      return;
    }

    this.scene.start(ABANDON_BUTTON.target);
  }

  private async confirmSelection(): Promise<void> {
    const availableNodes = getAvailableNodes(this.currentRun);
    const selectedNode = availableNodes.find((node) => node.id === this.selectedNodeId);

    if (!selectedNode) {
      this.feedbackText?.setText('请先选择一个当前高亮可达的节点。');
      return;
    }

    const nextRun = selectNode(this.currentRun, selectedNode.id);

    if (GameState.getInstance().getSaveData()) {
      GameState.getInstance().updateSaveData((saveData) => ({
        ...saveData,
        equippedLoadout: {
          ...saveData.equippedLoadout,
          airplaneId: this.preferredAirplaneId ?? saveData.equippedLoadout.airplaneId,
        },
        activeTournamentRun: nextRun,
        lastSavedAt: Date.now(),
      }));
      await persistGameState({
        auto: true,
      });
    }

    if (selectedNode.type === 'race' || selectedNode.type === 'elite' || selectedNode.type === 'boss') {
      this.scene.start(SCENE_KEYS.BUILD, {
        airplaneId: this.preferredAirplaneId,
        tournamentRun: nextRun,
        raceConfig: startRace(nextRun, selectedNode),
      });
      return;
    }

    this.scene.restart({
      run: nextRun,
      airplaneId: this.preferredAirplaneId,
      message:
        selectedNode.type === 'shop'
          ? '已记录本层商店补给信息，可以继续前往下一层。'
          : selectedNode.type === 'event'
            ? `事件记录：${selectedNode.eventData?.description ?? '神秘事件'}`
            : '已在休整节点短暂停留，准备继续前进。',
    });
  }
}
