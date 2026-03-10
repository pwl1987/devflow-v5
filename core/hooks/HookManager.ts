/**
 * DevFlow v5 - 钩子系统
 *
 * 职责：管理生命周期钩子的注册、触发、移除
 *
 * 架构原则：
 * - 单向依赖：只读 ContextDataBus，不修改业务逻辑
 * - 依赖注入：ContextDataBus 通过构造函数注入
 * - 异步执行：支持串行和并行钩子执行
 * - 超时管控：防止钩子执行阻塞
 */

import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ProjectContext } from '../state/ProjectContext';

// ============ 钩子阶段定义 ============
export type HookPhase =
  | 'pre-project'
  | 'post-project'
  | 'pre-phase'
  | 'post-phase'
  | 'pre-story'
  | 'post-story'
  | 'pre-skill'
  | 'post-skill'
  | 'pre-commit'
  | 'post-commit';

// ============ 钩子执行条件 ============
export type HookRunCondition = 'always' | 'on_success' | 'on_failure';

// ============ 钩子执行结果 ============
export interface HookExecutionResult {
  hookId: string;
  phase: HookPhase;
  success: boolean;
  duration: number; // 执行耗时（毫秒）
  output: string; // 标准输出
  error?: string; // 错误信息（如果失败）
}

// ============ 钩子配置 ============
export interface HookConfig {
  id: string;
  phase: HookPhase;
  command: string;
  run_condition?: HookRunCondition;
  blocking?: boolean; // 是否阻塞主流程
  timeout_seconds?: number;
  enabled?: boolean;
  priority?: number; // 优先级 (1-10, 10 最高, 默认 5)
}

// ============ 钩子注册信息 ============
export interface HookRegistration extends HookConfig {
  registeredAt: string;
  lastExecuted?: string;
  executionCount: number;
  priority: number; // 必需字段，默认 5
}

// ============ 钩子执行上下文 ============
export interface HookExecutionContext {
  phase: HookPhase;
  previousResult?: 'success' | 'failure';
  projectContext?: ProjectContext;
  metadata?: Record<string, any>;
}

// ============ 钩子管理器接口 ============

/**
 * 钩子管理器接口
 */
export interface IHookManager {
  /**
   * 注册钩子
   * @param hook - 钩子配置
   * @returns 注册后的钩子ID
   */
  register(hook: HookConfig): Promise<string>;

  /**
   * 注销钩子
   * @param hookId - 钩子ID
   */
  unregister(hookId: string): Promise<void>;

  /**
   * 获取指定阶段的所有钩子
   * @param phase - 钩子阶段
   * @returns 钩子注册列表
   */
  getHooks(phase: HookPhase): Promise<HookRegistration[]>;

  /**
   * 触发指定阶段的所有钩子
   * @param phase - 钩子阶段
   * @param context - 执行上下文
   * @returns 执行结果列表
   */
  trigger(phase: HookPhase, context: HookExecutionContext): Promise<HookExecutionResult[]>;

  /**
   * 清除所有钩子
   */
  clearAll(): Promise<void>;

  /**
   * 加载项目级钩子配置
   * @param hookConfigs - 钩子配置数组
   */
  loadFromConfig(hookConfigs: HookConfig[]): Promise<void>;

  /**
   * 导出当前所有钩子配置
   */
  exportConfig(): Promise<HookConfig[]>;
}

// ============ HookManager 实现类 ============

/**
 * 钩子管理器实现
 *
 * 设计模式：
 * - 观察者模式：钩子注册与触发
 * - 责任链模式：钩子按顺序执行
 * - 单向依赖：只读 ContextDataBus
 */
export class HookManager implements IHookManager {
  private hooks: Map<HookPhase, HookRegistration[]> = new Map();
  private contextBus: IContextDataBus;

  constructor(contextBus: IContextDataBus) {
    this.contextBus = contextBus;
    this.initializePhaseMap();
  }

  /**
   * 初始化钩子阶段映射
   * @internal
   */
  private initializePhaseMap(): void {
    const phases: HookPhase[] = [
      'pre-project',
      'post-project',
      'pre-phase',
      'post-phase',
      'pre-story',
      'post-story',
      'pre-skill',
      'post-skill',
      'pre-commit',
      'post-commit'
    ];

    phases.forEach(phase => {
      if (!this.hooks.has(phase)) {
        this.hooks.set(phase, []);
      }
    });
  }

  async register(hook: HookConfig): Promise<string> {
    const hookId = hook.id || this.generateHookId(hook.phase, hook.command);

    const registration: HookRegistration = {
      ...hook,
      id: hookId,
      enabled: hook.enabled !== false,
      priority: hook.priority ?? 5, // 默认优先级 5
      registeredAt: new Date().toISOString(),
      executionCount: 0
    };

    const phaseHooks = this.hooks.get(hook.phase) || [];
    phaseHooks.push(registration);

    // 按优先级排序（高到低），同优先级按注册时间排序
    phaseHooks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // 优先级降序
      }
      // 同优先级按注册时间升序（先注册的先执行）
      return a.registeredAt.localeCompare(b.registeredAt);
    });

    this.hooks.set(hook.phase, phaseHooks);

    return hookId;
  }

  async unregister(hookId: string): Promise<void> {
    for (const [phase, hooks] of this.hooks.entries()) {
      const filtered = hooks.filter(h => h.id !== hookId);
      this.hooks.set(phase, filtered);
    }
  }

  async getHooks(phase: HookPhase): Promise<HookRegistration[]> {
    return this.hooks.get(phase) || [];
  }

  async trigger(phase: HookPhase, context: HookExecutionContext): Promise<HookExecutionResult[]> {
    const hooks = this.hooks.get(phase) || [];
    const enabledHooks = hooks.filter(h => h.enabled !== false);

    const results: HookExecutionResult[] = [];

    for (const hook of enabledHooks) {
      // 检查执行条件
      if (hook.run_condition && hook.run_condition !== 'always') {
        if (hook.run_condition === 'on_success' && context.previousResult !== 'success') {
          continue;
        }
        if (hook.run_condition === 'on_failure' && context.previousResult !== 'failure') {
          continue;
        }
      }

      const result = await this.executeHook(hook, context);
      results.push(result);

      // 更新执行统计
      hook.executionCount++;
      hook.lastExecuted = new Date().toISOString();

      // 如果是阻塞钩子且执行失败，停止后续钩子
      if (hook.blocking && !result.success) {
        break;
      }
    }

    return results;
  }

  async clearAll(): Promise<void> {
    this.hooks.clear();
    this.initializePhaseMap();
  }

  async loadFromConfig(hookConfigs: HookConfig[]): Promise<void> {
    for (const config of hookConfigs) {
      await this.register(config);
    }
  }

  async exportConfig(): Promise<HookConfig[]> {
    const allHooks: HookConfig[] = [];

    for (const [, hooks] of this.hooks.entries()) {
      for (const hook of hooks) {
        allHooks.push({
          id: hook.id,
          phase: hook.phase,
          command: hook.command,
          run_condition: hook.run_condition,
          blocking: hook.blocking,
          timeout_seconds: hook.timeout_seconds,
          enabled: hook.enabled,
          priority: hook.priority
        });
      }
    }

    return allHooks;
  }

  /**
   * 执行单个钩子
   * @internal
   */
  private async executeHook(
    hook: HookRegistration,
    context: HookExecutionContext
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();
    const timeout = hook.timeout_seconds || 30; // 默认30秒超时

    try {
      // TODO: 实现钩子执行逻辑
      // 需要使用 Bash 工具执行 hook.command
      // 并设置超时控制

      throw new Error('Hook execution not implemented');
    } catch (error) {
      return {
        hookId: hook.id,
        phase: hook.phase,
        success: false,
        duration: Date.now() - startTime,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 生成钩子ID
   * @internal
   */
  private generateHookId(phase: HookPhase, command: string): string {
    const hash = this.simpleHash(command);
    return `${phase}-${hash}-${Date.now()}`;
  }

  /**
   * 简单哈希函数
   * @internal
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// ============ 内置钩子模板（阶段1 MVP）============

/**
 * 内置钩子模板集合
 */
export const BuiltinHookTemplates: Record<string, Omit<HookConfig, 'id'>> = {
  // 代码质量检查（pre-commit）
  'code-quality-pre-commit': {
    phase: 'pre-commit',
    command: 'npm run lint && npm run test',
    run_condition: 'always',
    blocking: true,
    timeout_seconds: 60
  },

  // 文档生成（post-story）
  'docs-post-story': {
    phase: 'post-story',
    command: 'npm run docs:generate',
    run_condition: 'on_success',
    blocking: false,
    timeout_seconds: 30
  },

  // 测试执行（post-skill）
  'test-post-skill': {
    phase: 'post-skill',
    command: 'npm run test -- --coverage',
    run_condition: 'always',
    blocking: false,
    timeout_seconds: 120
  },

  // 通知发送（post-phase）
  'notify-post-phase': {
    phase: 'post-phase',
    command: 'echo "Phase completed: $(date)"',
    run_condition: 'on_success',
    blocking: false,
    timeout_seconds: 10
  }
};
