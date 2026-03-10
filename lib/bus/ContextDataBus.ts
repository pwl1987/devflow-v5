/**
 * DevFlow v5 - 上下文数据总线
 *
 * 职责：项目上下文数据的唯一读写入口，提供原子操作、权限控制、资产管理
 *
 * 架构原则：
 * - 基于项目路径的实例化设计
 * - 同路径单例缓存，保证同一项目的读写一致性
 * - 严格单向依赖：只依赖 StateManager 接口
 * - 所有写操作通过 updateContext/updateAsset，禁止直接修改
 */

import * as path from 'path';
import { ProjectContext, AssetInfo } from '../../core/state/ProjectContext';

// ============ 只读视图类型 ============
export type ReadonlyProjectContext = Readonly<ProjectContext>;

// ============ 核心接口定义 ============

/**
 * 上下文数据总线接口
 *
 * 所有组件通过此接口访问项目上下文，禁止直接访问 StateManager
 */
export interface IContextDataBus {
  // ============ 上下文读写（阶段1 MVP）============

  /**
   * 获取项目上下文的只读视图
   * @returns 深度只读的 ProjectContext 对象
   */
  getContext(): Promise<ReadonlyProjectContext>;

  /**
   * 更新项目上下文
   * @param updates - 部分更新数据
   * @param source - 操作来源标识
   * @throws {Error} 当核心资产被锁定时抛出错误
   */
  updateContext(updates: Partial<ProjectContext>, source: string): Promise<void>;

  /**
   * 检查上下文是否存在（项目是否已初始化）
   */
  hasContext(): Promise<boolean>;

  // ============ 资产管理（阶段1 MVP）============

  /**
   * 获取指定资产的元数据
   * @param assetKey - 资产键（如 'prd', 'architecture'）
   * @returns 资产元数据，不存在则返回 null
   */
  getAsset(assetKey: string): Promise<AssetInfo | null>;

  /**
   * 写入资产并更新元数据
   * @param assetKey - 资产键
   * @param content - 资产内容
   * @param source - 操作来源
   * @returns 更新后的资产元数据
   */
  writeAsset(assetKey: string, content: any, source: string): Promise<AssetInfo>;

  /**
   * 锁定资产，禁止修改
   * @param assetKey - 资产键
   * @throws {Error} 当资产已被锁定时抛出错误
   */
  lockAsset(assetKey: string): Promise<void>;

  /**
   * 解锁资产
   * @param assetKey - 资产键
   */
  unlockAsset(assetKey: string): Promise<void>;

  /**
   * 检查资产是否被锁定
   */
  isAssetLocked(assetKey: string): Promise<boolean>;

  // ============ 执行日志（阶段1 MVP）============

  /**
   * 记录执行日志
   * @param skill - 执行的 Skill 名称
   * @param action - 执行的动作
   * @param status - 执行状态
   */
  logExecution(skill: string, action: string, status: 'success' | 'failure'): Promise<void>;

  /**
   * 获取执行历史
   */
  getExecutionHistory(): Promise<ProjectContext['execution_history']>;
}

// ============ StateManager 接口定义 ============

/**
 * StateManager 接口（依赖倒置）
 */
interface IStateManager {
  initialize(): Promise<void>;
  readContext(): Promise<Readonly<ProjectContext>>;
  updateContext(updates: Partial<ProjectContext>, source: string): Promise<void>;
  readAsset(assetKey: string): Promise<any>;
  writeAsset(assetKey: string, content: any, source: string): Promise<{ id: string; version: number }>;
  lockAsset(assetKey: string): Promise<void>;
  unlockAsset(assetKey: string): Promise<void>;
  logExecution(event: any): Promise<void>;
  getExecutionHistory(filters?: any): Promise<any>;
}

// ============ 实现类 ============

/**
 * 上下文数据总线实现类
 *
 * 设计模式：
 * - 基于项目路径的实例化
 * - 同路径单例缓存
 * - 依赖注入 StateManager
 */
export class ContextDataBus implements IContextDataBus {
  // 单例缓存：Map<projectRoot, ContextDataBus>
  private static readonly instanceCache = new Map<string, ContextDataBus>();

  private readonly projectRoot: string;
  private stateManager: IStateManager | null = null;

  /**
   * 私有构造函数，强制通过工厂方法获取实例
   */
  private constructor(projectRoot: string) {
    // 验证 projectRoot
    if (!projectRoot || typeof projectRoot !== 'string') {
      throw new Error('projectRoot 必须是非空绝对路径');
    }

    // 标准化路径
    this.projectRoot = path.normalize(projectRoot);

    // 检查是否为绝对路径
    if (!path.isAbsolute(this.projectRoot)) {
      throw new Error('projectRoot 必须是非空绝对路径');
    }
  }

  /**
   * 工厂方法：获取或创建 ContextDataBus 实例
   * @param projectRoot - 项目根目录绝对路径
   * @returns 同一路径的同一实例
   */
  static getInstance(projectRoot: string): ContextDataBus {
    // 标准化路径
    const normalizedPath = path.normalize(projectRoot);

    if (!this.instanceCache.has(normalizedPath)) {
      this.instanceCache.set(normalizedPath, new ContextDataBus(normalizedPath));
    }
    return this.instanceCache.get(normalizedPath)!;
  }

  /**
   * 清除指定路径的缓存实例（测试用）
   * @internal
   */
  static _clearCache(projectRoot?: string): void {
    if (projectRoot) {
      const normalizedPath = path.normalize(projectRoot);
      this.instanceCache.delete(normalizedPath);
    } else {
      this.instanceCache.clear();
    }
  }

  /**
   * 设置 StateManager（依赖注入）
   * @internal
   */
  _setStateManager(stateManager: IStateManager): void {
    this.stateManager = stateManager;
  }

  // ============ 私有辅助方法 ============

  /**
   * 确保 StateManager 已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.stateManager) {
      // 尝试延迟加载 StateManager
      try {
        const { StateManager } = await import('../../core/state/StateManager');
        // 使用类型断言来处理接口不匹配
        this.stateManager = new StateManager(this.projectRoot) as any;
        if (this.stateManager && 'initialize' in this.stateManager) {
          await (this.stateManager as any).initialize();
        }
      } catch (error) {
        throw new Error('StateManager not available and not injected');
      }
    }
  }

  // ============ 接口方法实现 ============

  async getContext(): Promise<ReadonlyProjectContext> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    return this.stateManager.readContext();
  }

  async updateContext(updates: Partial<ProjectContext>, source: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    await this.stateManager.updateContext(updates, source);
  }

  async hasContext(): Promise<boolean> {
    if (!this.stateManager) {
      return false;
    }

    try {
      const context = await this.stateManager.readContext();
      return context !== null && context !== undefined;
    } catch {
      return false;
    }
  }

  async getAsset(assetKey: string): Promise<AssetInfo | null> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    try {
      const asset = await this.stateManager.readAsset(assetKey);
      return asset || null;
    } catch {
      return null;
    }
  }

  async writeAsset(assetKey: string, content: any, source: string): Promise<AssetInfo> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    const result = await this.stateManager.writeAsset(assetKey, content, source);

    // 读取更新后的资产信息
    const asset = await this.stateManager.readAsset(assetKey);
    return asset as AssetInfo;
  }

  async lockAsset(assetKey: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    await this.stateManager.lockAsset(assetKey);
  }

  async unlockAsset(assetKey: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    await this.stateManager.unlockAsset(assetKey);
  }

  async isAssetLocked(assetKey: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    try {
      const asset = await this.stateManager.readAsset(assetKey);
      return asset?.locked || false;
    } catch {
      return false;
    }
  }

  async logExecution(skill: string, action: string, status: 'success' | 'failure'): Promise<void> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    await this.stateManager.logExecution({
      timestamp: new Date().toISOString(),
      skill_id: skill,
      execution_id: `${Date.now()}`,
      action: action as any,
      status: status as any,
    });
  }

  async getExecutionHistory(): Promise<ProjectContext['execution_history']> {
    await this.ensureInitialized();

    if (!this.stateManager) {
      throw new Error('StateManager not initialized');
    }

    // StateManager 返回 ExecutionEvent[]，但 ContextDataBus 需要返回 execution_history
    // 这里做适配转换
    const events = await this.stateManager.getExecutionHistory();

    // 如果没有事件，返回空历史
    if (!events || !Array.isArray(events) || events.length === 0) {
      return {
        last_skill_execution: '',
        last_execution_time: '',
        execution_count: 0,
      };
    }

    // 从最后一个事件中提取信息
    const lastEvent = events[events.length - 1];
    if (!lastEvent) {
      return {
        last_skill_execution: '',
        last_execution_time: '',
        execution_count: 0,
      };
    }

    return {
      last_skill_execution: lastEvent.skill_id || '',
      last_execution_time: lastEvent.timestamp || '',
      execution_count: events.length,
    };
  }
}
