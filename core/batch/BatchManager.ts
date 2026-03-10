/**
 * DevFlow v5 - 批量处理管理器
 *
 * 职责：批量 Story 处理、进度跟踪、失败重试
 */

import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ISkillExecutor, SkillInput } from '../skill/SkillExecutor';

// ============ 批量处理状态 ============
export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';

// ============ 批量任务 ============
export interface BatchTask {
  storyId: string;
  skillId: string;
  action: string;
  params: Record<string, any>;
  status: BatchStatus;
  result?: any;
  error?: Error;
  retryCount: number;
}

// ============ 批量处理结果 ============
export interface BatchResult {
  batchId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  status: BatchStatus;
  results: Map<string, BatchTask>;
  startTime: string;
  endTime?: string;
}

// ============ IBatchManager 接口 ============
export interface IBatchManager {
  executeBatch(tasks: BatchTask[]): Promise<BatchResult>;
  getProgress(batchId: string): Promise<BatchResult>;
}

// ============ BatchManager 实现 ============
export class BatchManager implements IBatchManager {
  private contextBus: IContextDataBus;
  private skillExecutor: ISkillExecutor;
  private batchHistory: Map<string, BatchResult> = new Map();

  constructor(contextBus: IContextDataBus, skillExecutor: ISkillExecutor) {
    this.contextBus = contextBus;
    this.skillExecutor = skillExecutor;
  }

  async executeBatch(tasks: BatchTask[]): Promise<BatchResult> {
    const batchId = `batch-${Date.now()}`;
    const startTime = new Date().toISOString();
    const results = new Map<string, BatchTask>();

    let completedTasks = 0;
    let failedTasks = 0;

    for (const task of tasks) {
      results.set(task.storyId, { ...task, status: 'running' });

      try {
        const input: SkillInput = {
          skillId: task.skillId,
          action: task.action,
          params: task.params,
        };

        const result = await this.skillExecutor.execute(input);

        if (result.status === 'success') {
          results.set(task.storyId, { ...task, status: 'completed', result: result.output });
          completedTasks++;
        } else {
          // 重试逻辑
          if (task.retryCount > 0) {
            results.set(task.storyId, { ...task, retryCount: task.retryCount - 1, status: 'pending' });
          } else {
            results.set(task.storyId, { ...task, status: 'failed', error: result.error });
            failedTasks++;
          }
        }
      } catch (error) {
        results.set(task.storyId, { ...task, status: 'failed', error: error as Error });
        failedTasks++;
      }
    }

    const batchResult: BatchResult = {
      batchId,
      totalTasks: tasks.length,
      completedTasks,
      failedTasks,
      status: failedTasks === 0 ? 'completed' : completedTasks > 0 ? 'partial' : 'failed',
      results,
      startTime,
      endTime: new Date().toISOString(),
    };

    this.batchHistory.set(batchId, batchResult);
    return batchResult;
  }

  async getProgress(batchId: string): Promise<BatchResult> {
    return this.batchHistory.get(batchId) || {
      batchId,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      status: 'pending',
      results: new Map(),
      startTime: new Date().toISOString(),
    };
  }
}
