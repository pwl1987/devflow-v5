/**
 * DevFlow v5 - 智能路由层
 *
 * 职责：检测项目场景，推荐流程模式，决策路由路径
 *
 * 架构原则：
 * - 策略模式：场景检测和模式推荐可插拔
 * - 单向依赖：只读 ContextDataBus，不修改上下文
 * - 纯函数决策：相同输入必定产生相同输出
 * - 首版硬编码规则，预留扩展接口
 */

import { ProjectContext } from '../state/ProjectContext';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';

// ============ 场景检测结果 ============
export interface SceneDetectionResult {
  project_type: 'greenfield' | 'brownfield' | 'mid-project';
  confidence: number;  // 0-1，检测置信度
  evidence: string[];  // 检测依据
}

// ============ 模式推荐结果 ============
export interface ModeRecommendationResult {
  recommended_mode: 'quick' | 'standard' | 'rigorous';
  reason: string;
  alternatives: Array<{
    mode: 'quick' | 'standard' | 'rigorous';
    reason: string;
  }>;
}

// ============ 路由决策结果 ============
export interface RoutingResult {
  // 项目场景
  project_type: 'greenfield' | 'brownfield' | 'mid-project';

  // 推荐的流程模式
  recommended_mode: 'quick' | 'standard' | 'rigorous';

  // 推荐的执行命令
  recommended_command: string;

  // 建议的下一步操作
  next_steps: string[];

  // 警告信息（如依赖缺失、资产未锁定等）
  warnings?: string[];

  // 前置依赖检查结果
  dependency_check: {
    passed: boolean;
    missing_items: string[];
  };
}

// ============ 命令意图解析结果 ============
export interface CommandIntent {
  command: string;
  args: string[];
  confidence: number;
}

// ============ 策略接口定义 ============

/**
 * 场景检测策略接口
 *
 * 职责：根据项目目录和上下文，判断项目类型
 */
export interface ISceneDetectionStrategy {
  /**
   * 检测项目场景
   * @param projectRoot - 项目根目录
   * @param context - 可选的项目上下文
   * @returns 场景检测结果
   */
  detect(projectRoot: string, context?: ProjectContext): Promise<SceneDetectionResult>;
}

/**
 * 模式推荐策略接口
 *
 * 职责：根据项目场景和上下文，推荐流程模式
 */
export interface IModeRecommendStrategy {
  /**
   * 推荐流程模式
   * @param scene - 检测到的项目场景
   * @param context - 可选的项目上下文
   * @returns 模式推荐结果
   */
  recommend(scene: SceneDetectionResult, context?: ProjectContext): Promise<ModeRecommendationResult>;
}

/**
 * 命令意图解析接口
 *
 * 职责：解析用户输入的命令意图
 */
export interface ICommandIntentParser {
  /**
   * 解析命令意图
   * @param input - 用户输入
   * @returns 命令意图
   */
  parse(input: string): CommandIntent;
}

/**
 * 依赖检查接口
 *
 * 职责：检查执行某命令的前置依赖
 */
export interface IDependencyChecker {
  /**
   * 检查前置依赖
   * @param command - 目标命令
   * @param context - 项目上下文
   * @returns 依赖检查结果
   */
  check(command: string, context: ProjectContext): Promise<{
    passed: boolean;
    missing_items: string[];
  }>;
}

// ============ SmartRouter 核心类 ============

/**
 * 智能路由器
 *
 * 设计模式：
 * - 策略模式：场景检测、模式推荐、命令解析可插拔
 * - 依赖注入：所有策略通过构造函数注入
 * - 纯函数决策：不修改任何状态，只返回决策结果
 */
export class SmartRouter {
  constructor(
    private sceneDetector: ISceneDetectionStrategy,
    private modeRecommender: IModeRecommendStrategy,
    private commandParser: ICommandIntentParser,
    private dependencyChecker: IDependencyChecker,
    private contextBus: IContextDataBus
  ) {}

  /**
   * 核心路由决策方法
   *
   * 流程：
   * 1. 检测项目场景
   * 2. 推荐流程模式
   * 3. 解析命令意图（如果提供了命令）
   * 4. 检查前置依赖
   * 5. 生成路由结果
   *
   * @param projectRoot - 项目根目录
   * @param command - 可选的用户命令
   * @param args - 命令参数
   * @returns 路由决策结果
   */
  async route(
    projectRoot: string,
    command?: string,
    args?: string[]
  ): Promise<RoutingResult> {
    // 1. 获取当前上下文（如果存在）
    const contextExists = await this.contextBus.hasContext();
    const context = contextExists ? await this.contextBus.getContext() : undefined;

    // 2. 检测项目场景
    const sceneResult = await this.sceneDetector.detect(projectRoot, context);

    // 3. 推荐流程模式
    const modeResult = await this.modeRecommender.recommend(sceneResult, context);

    // 4. 解析命令意图（如果提供）
    let recommendedCommand = command;
    if (!recommendedCommand) {
      // 根据场景和模式推荐默认命令
      recommendedCommand = this.getDefaultCommand(sceneResult.project_type, modeResult.recommended_mode);
    }

    // 5. 检查前置依赖
    const dependencyCheck = context
      ? await this.dependencyChecker.check(recommendedCommand, context)
      : { passed: true, missing_items: [] };

    // 6. 生成下一步建议
    const nextSteps = this.generateNextSteps(sceneResult, modeResult, dependencyCheck);

    // 7. 收集警告信息
    const warnings = this.collectWarnings(sceneResult, modeResult, dependencyCheck);

    return {
      project_type: sceneResult.project_type,
      recommended_mode: modeResult.recommended_mode,
      recommended_command: recommendedCommand,
      next_steps,
      warnings,
      dependency_check: dependencyCheck,
    };
  }

  /**
   * 根据场景和模式获取默认命令
   * @internal
   */
  private getDefaultCommand(
    projectType: SceneDetectionResult['project_type'],
    mode: ModeRecommendationResult['recommended_mode']
  ): string {
    // 默认命令映射逻辑
    const commandMap: Record<string, Record<string, string>> = {
      greenfield: {
        quick: 'new',
        standard: 'new',
        rigorous: 'new',
      },
      brownfield: {
        quick: 'continue',
        standard: 'continue',
        rigorous: 'analyze',
      },
      'mid-project': {
        quick: 'continue',
        standard: 'status',
        rigorous: 'analyze',
      },
    };

    return commandMap[projectType]?.[mode] || 'status';
  }

  /**
   * 生成下一步建议
   * @internal
   */
  private generateNextSteps(
    scene: SceneDetectionResult,
    mode: ModeRecommendationResult,
    depCheck: { passed: boolean; missing_items: string[] }
  ): string[] {
    const steps: string[] = [];

    // 依赖缺失时优先提示
    if (!depCheck.passed) {
      steps.push(`❌ 缺少前置依赖: ${depCheck.missing_items.join(', ')}`);
      steps.push('建议先运行 /init 初始化项目');
      return steps;
    }

    // 根据场景生成建议
    switch (scene.project_type) {
      case 'greenfield':
        steps.push('✅ 项目类型：绿地项目（从零开始）');
        steps.push(`建议模式: ${mode.recommended_mode}`);
        steps.push('下一步: 创建 PRD 或 Product Brief');
        break;
      case 'brownfield':
        steps.push('✅ 项目类型：棕地项目（现有代码）');
        steps.push(`建议模式: ${mode.recommended_mode}`);
        steps.push('下一步: 运行项目分析或继续开发');
        break;
      case 'mid-project':
        steps.push('✅ 项目类型：中途加入（已有 BMAD 上下文）');
        steps.push(`建议模式: ${mode.recommended_mode}`);
        steps.push('下一步: 查看项目状态或继续故事');
        break;
    }

    return steps;
  }

  /**
   * 收集警告信息
   * @internal
   */
  private collectWarnings(
    scene: SceneDetectionResult,
    mode: ModeRecommendationResult,
    depCheck: { passed: boolean; missing_items: string[] }
  ): string[] {
    const warnings: string[] = [];

    // 置信度警告
    if (scene.confidence < 0.7) {
      warnings.push(`⚠️ 场景检测置信度较低 (${(scene.confidence * 100).toFixed(0)}%)，建议确认项目类型`);
    }

    // 模式冲突警告
    if (mode.alternatives.length > 0) {
      warnings.push(`💡 也可考虑: ${mode.alternatives.map(a => a.mode).join(', ')}`);
    }

    return warnings;
  }
}

// ============ 默认策略实现（阶段1 MVP，硬编码规则）============

/**
 * 默认场景检测策略
 *
 * 阶段1 MVP：硬编码检测规则
 */
export class DefaultSceneDetectionStrategy implements ISceneDetectionStrategy {
  async detect(projectRoot: string, context?: ProjectContext): Promise<SceneDetectionResult> {
    // TODO: 实现
    // 检测逻辑：
    // 1. 检查是否有 _state 目录（已有 BMAD 上下文）→ mid-project
    // 2. 检查是否有 package.json / requirements.txt / go.mod 等（已有代码）→ brownfield
    // 3. 否则 → greenfield
    throw new Error('Method not implemented');
  }
}

/**
 * 默认模式推荐策略
 *
 * 阶段1 MVP：硬编码推荐规则
 */
export class DefaultModeRecommendStrategy implements IModeRecommendStrategy {
  async recommend(scene: SceneDetectionResult, context?: ProjectContext): Promise<ModeRecommendationResult> {
    // TODO: 实现
    // 推荐逻辑：
    // 1. greenfield → quick（快速启动）
    // 2. brownfield → standard（需要分析）
    // 3. mid-project → 根据 context.status 决定
    throw new Error('Method not implemented');
  }
}

/**
 * 默认命令意图解析器
 *
 * 阶段1 MVP：简单关键词匹配
 */
export class DefaultCommandIntentParser implements ICommandIntentParser {
  parse(input: string): CommandIntent {
    // TODO: 实现
    // 简单关键词匹配
    throw new Error('Method not implemented');
  }
}

/**
 * 默认依赖检查器
 *
 * 阶段1 MVP：基础检查
 */
export class DefaultDependencyChecker implements IDependencyChecker {
  async check(command: string, context: ProjectContext): Promise<{ passed: boolean; missing_items: string[] }> {
    // TODO: 实现
    // 检查前置依赖：
    // - /new: 无依赖
    // - /story: 需要 PRD
    // - /dev: 需要 Story
    throw new Error('Method not implemented');
  }
}
