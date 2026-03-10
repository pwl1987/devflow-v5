/**
 * DevFlow v5 - 绿地项目流程编排器
 *
 * 职责：完整的绿地项目开发流程
 */

import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ISkillExecutor } from '../skill/SkillExecutor';
import { IBatchManager, BatchManager } from '../batch/BatchManager';

// ============ 流程阶段 ============
export type FlowPhase = 'init' | 'research' | 'design' | 'develop' | 'test' | 'deploy';

// ============ 流程配置 ============
export interface FlowConfig {
  projectRoot: string;
  projectName: string;
  projectType: 'greenfield' | 'brownfield';
  skipTests?: boolean;
}

// ============ 流程状态 ============
export interface FlowState {
  currentPhase: FlowPhase;
  progress: number;
  completedStories: string[];
  errors: Error[];
}

// ============ IGreenfieldFlow 接口 ============
export interface IGreenfieldFlow {
  start(config: FlowConfig): Promise<FlowState>;
  getState(): Promise<FlowState>;
}

// ============ GreenfieldFlow 实现 ============
export class GreenfieldFlow implements IGreenfieldFlow {
  private contextBus: IContextDataBus;
  private skillExecutor: ISkillExecutor;
  private batchManager: IBatchManager;
  private currentState: FlowState;

  constructor(contextBus: IContextDataBus, skillExecutor: ISkillExecutor) {
    this.contextBus = contextBus;
    this.skillExecutor = skillExecutor;
    this.batchManager = new BatchManager(contextBus, skillExecutor);
    this.currentState = {
      currentPhase: 'init',
      progress: 0,
      completedStories: [],
      errors: [],
    };
  }

  async start(config: FlowConfig): Promise<FlowState> {
    // 1. 初始化阶段
    this.currentState.currentPhase = 'init';
    this.currentState.progress = 10;

    // 2. 研究阶段
    this.currentState.currentPhase = 'research';
    this.currentState.progress = 30;

    // 3. 设计阶段
    this.currentState.currentPhase = 'design';
    this.currentState.progress = 50;

    // 4. 开发阶段
    this.currentState.currentPhase = 'develop';
    this.currentState.progress = 70;

    // 5. 测试阶段
    if (!config.skipTests) {
      this.currentState.currentPhase = 'test';
      this.currentState.progress = 90;
    }

    // 6. 部署阶段
    this.currentState.currentPhase = 'deploy';
    this.currentState.progress = 100;

    return this.currentState;
  }

  async getState(): Promise<FlowState> {
    return { ...this.currentState };
  }
}
