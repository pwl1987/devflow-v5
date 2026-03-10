/**
 * DevFlow v5 - 流程并发控制管理器
 *
 * 职责：管理同时运行的流程数量，防止资源过载
 */

import { DevFlowBaseError, ErrorCategory, ErrorSeverity } from '../errors/DevFlowBaseError';

/**
 * 流程并发控制错误
 */
export class FlowConcurrencyLimitError extends DevFlowBaseError {
  constructor(currentRunning: number, maxAllowed: number) {
    super(
      'FLOW_CONCURRENCY_LIMIT',
      `并发流程数量已达上限 (${currentRunning}/${maxAllowed})，请等待当前流程完成后再试`,
      ErrorCategory.EXECUTION,
      ErrorSeverity.WARNING,
      { currentRunning, maxAllowed }
    );
    Object.setPrototypeOf(this, FlowConcurrencyLimitError.prototype);
  }
}

/**
 * 流程执行记录
 */
export interface FlowExecutionRecord {
  /** 流程 ID */
  flowId: string;
  /** 流程类型（greenfield/brownfield） */
  flowType: 'greenfield' | 'brownfield';
  /** 开始时间 */
  startTime: number;
  /** 状态 */
  status: 'running' | 'completed' | 'failed';
}

/**
 * 并发控制配置
 */
export interface ConcurrencyConfig {
  /** 最大并发流程数 */
  maxConcurrentFlows: number;
  /** 流程超时时间（毫秒） */
  flowTimeout: number;
  /** 是否启用等待队列 */
  enableWaitQueue: boolean;
  /** 等待队列最大长度 */
  maxWaitQueueSize: number;
}

/**
 * 并发控制统计信息
 */
export interface ConcurrencyStats {
  /** 当前运行的流程数 */
  currentRunning: number;
  /** 当前等待的流程数 */
  currentWaiting: number;
  /** 最大并发数 */
  maxConcurrent: number;
  /** 总完成的流程数 */
  totalCompleted: number;
  /** 总失败的流程数 */
  totalFailed: number;
}

/**
 * 流程并发控制管理器
 */
export class FlowConcurrencyManager {
  private static instance: FlowConcurrencyManager | null = null;
  private config: ConcurrencyConfig;
  private runningFlows: Map<string, FlowExecutionRecord>;
  private waitQueue: Array<{
    flowId: string;
    flowType: 'greenfield' | 'brownfield';
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
  private stats: {
    totalCompleted: number;
    totalFailed: number;
    maxConcurrentReached: number;
  };

  private constructor(config: Partial<ConcurrencyConfig> = {}) {
    this.config = {
      maxConcurrentFlows: config.maxConcurrentFlows ?? 5,
      flowTimeout: config.flowTimeout ?? 300000, // 5分钟
      enableWaitQueue: config.enableWaitQueue ?? true,
      maxWaitQueueSize: config.maxWaitQueueSize ?? 20
    };
    this.runningFlows = new Map();
    this.waitQueue = [];
    this.stats = {
      totalCompleted: 0,
      totalFailed: 0,
      maxConcurrentReached: 0
    };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<ConcurrencyConfig>): FlowConcurrencyManager {
    if (FlowConcurrencyManager.instance === null) {
      FlowConcurrencyManager.instance = new FlowConcurrencyManager(config);
    }
    return FlowConcurrencyManager.instance;
  }

  /**
   * 请求开始执行流程
   * @param flowId 流程 ID
   * @param flowType 流程类型
   * @returns Promise，当可以开始执行时 resolve
   */
  public async acquireFlowSlot(
    flowId: string,
    flowType: 'greenfield' | 'brownfield'
  ): Promise<void> {
    // 检查是否已经在运行
    if (this.runningFlows.has(flowId)) {
      return Promise.resolve(); // 已经在运行，直接返回
    }

    // 检查并发限制（零限制意味着不允许任何流程）
    if (this.config.maxConcurrentFlows <= 0) {
      return Promise.reject(
        new FlowConcurrencyLimitError(this.runningFlows.size, this.config.maxConcurrentFlows)
      );
    }

    // 检查并发限制
    if (this.runningFlows.size >= this.config.maxConcurrentFlows) {
      if (!this.config.enableWaitQueue) {
        return Promise.reject(
          new FlowConcurrencyLimitError(this.runningFlows.size, this.config.maxConcurrentFlows)
        );
      }

      // 检查等待队列是否已满
      if (this.waitQueue.length >= this.config.maxWaitQueueSize) {
        return Promise.reject(
          new FlowConcurrencyLimitError(this.runningFlows.size, this.config.maxConcurrentFlows)
        );
      }

      // 加入等待队列
      return new Promise((resolve, reject) => {
        this.waitQueue.push({ flowId, flowType, resolve, reject });
      });
    }

    // 可以开始执行
    this.startFlow(flowId, flowType);
    return Promise.resolve();
  }

  /**
   * 开始执行流程
   */
  private startFlow(flowId: string, flowType: 'greenfield' | 'brownfield'): void {
    const record: FlowExecutionRecord = {
      flowId,
      flowType,
      startTime: Date.now(),
      status: 'running'
    };

    this.runningFlows.set(flowId, record);

    // 更新统计
    if (this.runningFlows.size > this.stats.maxConcurrentReached) {
      this.stats.maxConcurrentReached = this.runningFlows.size;
    }

    // 设置超时
    setTimeout(() => {
      if (this.runningFlows.has(flowId)) {
        this.completeFlow(flowId, 'failed');
      }
    }, this.config.flowTimeout);
  }

  /**
   * 释放流程槽位
   * @param flowId 流程 ID
   * @param status 完成状态
   */
  public releaseFlowSlot(flowId: string, status: 'completed' | 'failed'): void {
    if (!this.runningFlows.has(flowId)) {
      return; // 不在运行中
    }

    this.completeFlow(flowId, status);

    // 处理等待队列
    this.processWaitQueue();
  }

  /**
   * 完成流程
   */
  private completeFlow(flowId: string, status: 'completed' | 'failed'): void {
    const record = this.runningFlows.get(flowId);
    if (record) {
      record.status = status;
      this.runningFlows.delete(flowId);

      // 更新统计
      if (status === 'completed') {
        this.stats.totalCompleted++;
      } else {
        this.stats.totalFailed++;
      }
    }
  }

  /**
   * 处理等待队列
   */
  private processWaitQueue(): void {
    while (this.waitQueue.length > 0 && this.runningFlows.size < this.config.maxConcurrentFlows) {
      const next = this.waitQueue.shift();
      if (next) {
        this.startFlow(next.flowId, next.flowType);
        next.resolve();
      }
    }
  }

  /**
   * 取消等待中的流程
   * @param flowId 流程 ID
   * @returns 是否成功取消
   */
  public cancelWaitingFlow(flowId: string): boolean {
    const index = this.waitQueue.findIndex(item => item.flowId === flowId);
    if (index !== -1) {
      const item = this.waitQueue.splice(index, 1)[0];
      item.reject(new Error('流程已取消'));
      return true;
    }
    return false;
  }

  /**
   * 获取当前统计信息
   */
  public getStats(): ConcurrencyStats {
    return {
      currentRunning: this.runningFlows.size,
      currentWaiting: this.waitQueue.length,
      maxConcurrent: this.config.maxConcurrentFlows,
      totalCompleted: this.stats.totalCompleted,
      totalFailed: this.stats.totalFailed
    };
  }

  /**
   * 获取正在运行的流程列表
   */
  public getRunningFlows(): FlowExecutionRecord[] {
    return Array.from(this.runningFlows.values());
  }

  /**
   * 获取等待队列中的流程列表
   */
  public getWaitingFlows(): string[] {
    return this.waitQueue.map(item => item.flowId);
  }

  /**
   * 检查是否可以立即开始流程
   */
  public canStartImmediately(): boolean {
    return this.runningFlows.size < this.config.maxConcurrentFlows;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<ConcurrencyConfig>): void {
    const oldMaxConcurrent = this.config.maxConcurrentFlows;
    this.config = { ...this.config, ...newConfig };

    // 如果新的最大并发数增加，处理等待队列
    if (newConfig.maxConcurrentFlows && newConfig.maxConcurrentFlows > oldMaxConcurrent) {
      this.processWaitQueue();
    }
  }

  /**
   * 清除单例实例（用于测试）
   */
  public static clearInstance(): void {
    FlowConcurrencyManager.instance = null;
  }

  /**
   * 重置管理器状态（用于测试）
   */
  public reset(): void {
    this.runningFlows.clear();
    this.waitQueue = [];
    this.stats = {
      totalCompleted: 0,
      totalFailed: 0,
      maxConcurrentReached: 0
    };
  }
}
