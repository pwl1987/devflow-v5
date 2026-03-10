/**
 * DevFlow v5 - Skill 执行引擎
 *
 * 职责：执行 Skill 的生命周期方法，管理 Skill 执行流程
 *
 * 架构原则：
 * - 依赖倒置：依赖 IContextDataBus 接口
 * - 单向依赖：只读 ContextDataBus
 * - 异常处理：支持 rollback 机制
 * - 执行日志：记录所有 Skill 执行事件
 */

import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ProjectContext } from '../state/ProjectContext';

// ============ Skill 执行状态 ============
export type SkillExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';

// ============ Skill 执行结果 ============
export interface SkillExecutionResult {
  skillId: string;
  status: SkillExecutionStatus;
  startTime: string;
  endTime?: string;
  duration?: number; // 毫秒
  output?: any;
  error?: Error;
  rollbackAttempted?: boolean;
  rollbackSuccess?: boolean;
}

// ============ Skill 输入 ============
export interface SkillInput {
  skillId: string;
  action: string;
  params: Record<string, any>;
  options?: {
    dryRun?: boolean;
    timeout?: number;
    retryOnError?: boolean;
  };
}

// ============ Skill 元数据 ============
export interface SkillMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
}

// ============ Skill 执行器接口 ============

/**
 * Skill 执行器接口
 *
 * 负责 Skill 生命周期方法的执行和管理
 */
export interface ISkillExecutor {
  /**
   * 执行 Skill
   * @param input - Skill 输入参数
   * @returns 执行结果
   */
  execute(input: SkillInput): Promise<SkillExecutionResult>;

  /**
   * 前置检查
   * @param input - Skill 输入参数
   * @returns 检查是否通过
   */
  preCheck(input: SkillInput): Promise<boolean>;

  /**
   * 后处理
   * @param result - 执行结果
   * @param context - 项目上下文
   */
  postProcess(result: SkillExecutionResult, context: ProjectContext): Promise<void>;

  /**
   * 回滚操作
   * @param skillId - Skill ID
   * @returns 回滚是否成功
   */
  rollback(skillId: string): Promise<boolean>;

  /**
   * Dry Run 模式
   * @param input - Skill 输入参数
   * @returns 预期执行结果（不实际执行）
   */
  dryRun(input: SkillInput): Promise<SkillExecutionResult>;

  /**
   * 获取 Skill 元数据
   * @param skillId - Skill ID
   * @returns Skill 元数据
   */
  getSkillMetadata(skillId: string): Promise<SkillMetadata | null>;

  /**
   * 获取执行历史
   * @param skillId - Skill ID（可选）
   * @returns 执行历史记录
   */
  getExecutionHistory(skillId?: string): Promise<SkillExecutionResult[]>;
}

// ============ Skill 生命周期钩子接口 ============

/**
 * Skill 生命周期钩子接口
 *
 * Skill 实现类需要实现这些方法
 */
export interface ISkillLifecycle {
  /**
   * 前置检查 - 验证执行条件
   */
  preCheck?(input: SkillInput): Promise<boolean>;

  /**
   * 执行 - 主要逻辑
   */
  execute(input: SkillInput): Promise<any>;

  /**
   * 后处理 - 清理和后续操作
   */
  postProcess?(result: any, input: SkillInput): Promise<void>;

  /**
   * 回滚 - 撤销操作
   */
  rollback?(input: SkillInput): Promise<boolean>;

  /**
   * Dry Run - 模拟执行
   */
  dryRun?(input: SkillInput): Promise<any>;

  /**
   * Skill 元数据
   */
  metadata?: SkillMetadata;
}

// ============ SkillExecutor 实现类 ============

/**
 * Skill 执行器实现
 *
 * 设计模式：
 * - 依赖注入：接收 IContextDataBus
 * - 注册表模式：通过 Map 管理 Skill 实例
 * - 生命周期管理：按顺序执行 preCheck → execute → postProcess
 */
export class SkillExecutor implements ISkillExecutor {
  private contextBus: IContextDataBus;
  private skillRegistry: Map<string, ISkillLifecycle>;
  private executionHistory: SkillExecutionResult[] = [];

  constructor(contextBus: IContextDataBus, skillRegistry: Map<string, ISkillLifecycle>) {
    this.contextBus = contextBus;
    this.skillRegistry = skillRegistry;
  }

  async execute(input: SkillInput): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const result: SkillExecutionResult = {
      skillId: input.skillId,
      status: 'running',
      startTime: new Date(startTime).toISOString(),
    };

    try {
      // 1. 获取 Skill 实例
      const skill = this.skillRegistry.get(input.skillId);
      if (!skill) {
        throw new Error(`Skill '${input.skillId}' not found in registry`);
      }

      // 2. 前置检查
      if (skill.preCheck) {
        const preCheckPassed = await skill.preCheck(input);
        if (!preCheckPassed) {
          throw new Error('Skill preCheck failed');
        }
      }

      // 3. 执行主要逻辑
      const output = await skill.execute(input);
      result.output = output;
      result.status = 'success';

      // 4. 后处理
      if (skill.postProcess) {
        const context = await this.contextBus.getContext();
        await skill.postProcess(output, input);
      }

      // 5. 记录执行日志
      await this.contextBus.logExecution(input.skillId, input.action, 'success');

    } catch (error) {
      result.status = 'failed';
      result.error = error as Error;

      // 尝试回滚
      if (this.skillRegistry.has(input.skillId)) {
        result.rollbackAttempted = true;
        const rollbackSuccess = await this.rollback(input.skillId);
        result.rollbackSuccess = rollbackSuccess;

        // 记录失败日志
        await this.contextBus.logExecution(input.skillId, input.action, 'failure');
      }
    } finally {
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - startTime;
      this.executionHistory.push(result);
    }

    return result;
  }

  async preCheck(input: SkillInput): Promise<boolean> {
    const skill = this.skillRegistry.get(input.skillId);
    if (!skill) {
      throw new Error(`Skill '${input.skillId}' not found in registry`);
    }

    if (skill.preCheck) {
      return await skill.preCheck(input);
    }

    return true;
  }

  async postProcess(result: SkillExecutionResult, context: ProjectContext): Promise<void> {
    const skill = this.skillRegistry.get(result.skillId);
    if (!skill) {
      return;
    }

    if (skill.postProcess) {
      await skill.postProcess(result.output, { skillId: result.skillId, action: '', params: {} });
    }
  }

  async rollback(skillId: string): Promise<boolean> {
    const skill = this.skillRegistry.get(skillId);
    if (!skill) {
      return false;
    }

    if (skill.rollback) {
      try {
        return await skill.rollback({ skillId, action: 'rollback', params: {} });
      } catch {
        return false;
      }
    }

    return true;
  }

  async dryRun(input: SkillInput): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const result: SkillExecutionResult = {
      skillId: input.skillId,
      status: 'success',
      startTime: new Date(startTime).toISOString(),
    };

    try {
      const skill = this.skillRegistry.get(input.skillId);
      if (!skill) {
        throw new Error(`Skill '${input.skillId}' not found in registry`);
      }

      if (skill.dryRun) {
        result.output = await skill.dryRun(input);
      } else {
        // 如果没有 dryRun 方法，模拟成功执行
        result.output = { dryRun: true, message: 'Dry run simulation' };
      }

      result.endTime = new Date().toISOString();
      result.duration = Date.now() - startTime;

    } catch (error) {
      result.status = 'failed';
      result.error = error as Error;
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  async getSkillMetadata(skillId: string): Promise<SkillMetadata | null> {
    const skill = this.skillRegistry.get(skillId);
    if (!skill) {
      return null;
    }

    // 从 Skill 类的静态属性获取元数据
    const SkillClass = Object.getPrototypeOf(skill).constructor;
    if ('metadata' in SkillClass) {
      return (SkillClass as any).metadata;
    }

    // 如果没有元数据，返回基本信息
    return {
      id: skillId,
      name: skillId,
      version: '1.0.0',
    };
  }

  async getExecutionHistory(skillId?: string): Promise<SkillExecutionResult[]> {
    if (skillId) {
      return this.executionHistory.filter(r => r.skillId === skillId);
    }
    return [...this.executionHistory];
  }

  /**
   * 注册 Skill
   * @internal
   */
  registerSkill(skillId: string, skill: ISkillLifecycle): void {
    this.skillRegistry.set(skillId, skill);
  }

  /**
   * 清除执行历史
   * @internal
   */
  clearHistory(): void {
    this.executionHistory = [];
  }
}
