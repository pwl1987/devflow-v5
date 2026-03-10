/**
 * DevFlow v5 - SmartRouter 简化实现
 *
 * 基于 TDD 测试用例的路由器实现
 * 核心能力：基于 ProjectContext 分发到对应处理器
 */

import { ProjectContext } from '../state/ProjectContext';

// ============ 类型定义 ============

/**
 * 路由匹配函数
 */
export type RouteMatcher = (ctx: ProjectContext) => boolean;

/**
 * 路由处理函数
 */
export type RouteHandler = (ctx: ProjectContext) => Promise<any>;

/**
 * 路由规则
 */
export interface RouterRule {
  match: RouteMatcher;
  handler: RouteHandler;
}

// ============ SmartRouter 核心类 ============

/**
 * 智能路由器
 * 单例模式：按项目根路径隔离实例
 */
export class SmartRouter {
  // 单例缓存
  private static readonly _instanceCache = new Map<string, SmartRouter>();

  // 路由规则缓存
  private readonly _rules = new Map<string, RouterRule>();

  // 兜底处理器
  private _fallbackHandler?: RouteHandler;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(projectRoot: string): SmartRouter {
    if (!this._instanceCache.has(projectRoot)) {
      this._instanceCache.set(projectRoot, new SmartRouter());
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

  // ============ 路由规则管理 ============

  /**
   * 注册路由规则
   */
  public registerRule(ruleId: string, rule: RouterRule): void {
    if (this._rules.has(ruleId)) {
      console.warn(`路由规则 ${ruleId} 已存在，将覆盖`);
    }
    this._rules.set(ruleId, rule);
  }

  /**
   * 注销路由规则
   */
  public unregisterRule(ruleId: string): void {
    this._rules.delete(ruleId);
  }

  /**
   * 设置兜底处理器
   */
  public setFallbackHandler(handler: RouteHandler): void {
    this._fallbackHandler = handler;
  }

  // ============ 路由执行 ============

  /**
   * 执行路由匹配并分发
   */
  public async route(ctx: ProjectContext): Promise<any> {
    // 1. 遍历规则，匹配第一个符合条件的
    for (const [_, rule] of this._rules) {
      try {
        // 先检查匹配条件
        if (rule.match(ctx)) {
          // 匹配成功，执行处理器
          return await rule.handler(ctx);
        }
      } catch (error) {
        // handler 抛出的异常需要向上传播
        throw error;
      }
    }

    // 2. 无匹配规则，执行兜底处理器
    if (this._fallbackHandler) {
      return await this._fallbackHandler(ctx);
    }

    // 3. 无兜底处理器，抛出异常
    throw new Error('无匹配的路由规则，且未设置兜底处理器');
  }
}
