/**
 * HookManager - 生命周期钩子系统
 * 支持：上下文更新/技能执行等阶段的钩子注册、触发
 */
import { ProjectContext } from '../state/ProjectContext';

// ============ 类型定义 ============

/**
 * 钩子执行阶段
 */
export enum HookStage {
  // 上下文更新前
  BeforeContextUpdate = 'beforeContextUpdate',
  // 上下文更新后
  AfterContextUpdate = 'afterContextUpdate',
  // 技能执行前
  BeforeSkillExecution = 'beforeSkillExecution',
  // 技能执行后
  AfterSkillExecution = 'afterSkillExecution',
}

/**
 * 钩子处理函数
 */
export type HookHandler = (ctx: ProjectContext) => Promise<void>;

// ============ 单例实现 ============

export class HookManager {
  // 单例缓存
  private static readonly _instanceCache = new Map<string, HookManager>();

  // 钩子缓存：Map<阶段, Map<钩子ID, 处理器>>
  private readonly _hooks = new Map<HookStage, Map<string, HookHandler>>();

  private constructor() {
    // 初始化所有阶段的钩子容器
    Object.values(HookStage).forEach((stage) => {
      this._hooks.set(stage as HookStage, new Map<string, HookHandler>());
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(projectRoot: string): HookManager {
    if (!this._instanceCache.has(projectRoot)) {
      this._instanceCache.set(projectRoot, new HookManager());
    }
    return this._instanceCache.get(projectRoot)!;
  }

  /**
   * 清除单例缓存（仅测试环境使用）
   */
  public static _clearCache(projectRoot?: string): void {
    if (projectRoot) {
      this._instanceCache.delete(projectRoot);
    } else {
      this._instanceCache.clear();
    }
  }

  // ============ 钩子管理 ============

  /**
   * 注册生命周期钩子
   */
  public registerHook(
    stage: HookStage,
    hookId: string,
    handler: HookHandler
  ): void {
    const stageHooks = this._hooks.get(stage);
    if (!stageHooks) {
      throw new Error(`未知的钩子阶段：${stage}`);
    }

    if (stageHooks.has(hookId)) {
      console.warn(`钩子 ${hookId} 在阶段 ${stage} 已存在，将覆盖`);
    }
    stageHooks.set(hookId, handler);
  }

  /**
   * 注销生命周期钩子
   */
  public unregisterHook(stage: HookStage, hookId: string): void {
    const stageHooks = this._hooks.get(stage);
    if (stageHooks) {
      stageHooks.delete(hookId);
    }
  }

  /**
   * 触发指定阶段的所有钩子
   */
  public async triggerHooks(stage: HookStage, ctx: ProjectContext): Promise<void> {
    const stageHooks = this._hooks.get(stage);
    if (!stageHooks) return;

    // 按注册顺序执行所有钩子
    const errors: Error[] = [];
    for (const [_, handler] of stageHooks) {
      try {
        await handler(ctx);
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // 如果有任何钩子失败，抛出第一个错误
    if (errors.length > 0) {
      throw errors[0];
    }
  }
}
