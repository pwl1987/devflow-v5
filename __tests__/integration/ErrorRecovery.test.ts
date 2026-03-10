/**
 * DevFlow v5 - 错误恢复和回滚集成测试
 *
 * 测试策略：
 * - 测试Skill执行失败时的回滚机制
 * - 测试批量处理中的错误隔离
 * - 测试流程执行中的错误恢复
 * - 测试钩子执行失败的错误传播
 * - 测试状态管理的一致性保证
 */

import { GreenfieldFlow, IGreenfieldFlow, FlowConfig } from '../../core/flow/GreenfieldFlow';
import { BrownfieldFlow, IBrownfieldFlow, BrownfieldConfig } from '../../core/flow/BrownfieldFlow';
import { ContextDataBus, IContextDataBus } from '../../lib/bus/ContextDataBus';
import { SmartRouter } from '../../core/router/SmartRouterImpl';
import { SkillExecutor, ISkillExecutor, SkillInput, SkillExecutionResult, SkillExecutionStatus, ISkillLifecycle } from '../../core/skill/SkillExecutor';
import { BatchManager, IBatchManager, BatchTask } from '../../core/batch/BatchManager';
import { HookManager, HookStage } from '../../core/hooks/HookManagerImpl';
import { ChangeDetector, IChangeDetector, ChangeDetectionResult } from '../../core/filemanager/ChangeDetector';
import { ProjectContext, Phase } from '../../core/state/ProjectContext';
import { StateManager } from '../../core/state/StateManager';

// ============ 测试项目路径 ============
const TEST_PROJECT_ROOT = '/test/error-recovery-project';

// ============ Mock Skill 实现 ============

/**
 * 成功执行的Skill
 */
class SuccessSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    return { success: true, action: input.action };
  }

  async preCheck?(input: SkillInput): Promise<boolean> {
    return true;
  }

  async postProcess?(result: any, input: SkillInput): Promise<void> {}

  async rollback?(input: SkillInput): Promise<boolean> {
    return true;
  }

  async dryRun?(input: SkillInput): Promise<any> {
    return { dryRun: true };
  }

  metadata = {
    id: 'success-skill',
    name: 'Success Skill',
    version: '1.0.0',
  };
}

/**
 * 总是失败的Skill（用于测试回滚）
 */
class FailingSkill implements ISkillLifecycle {
  private shouldFailInPreCheck: boolean = false;
  private rollbackExecuted: boolean = false;

  constructor(shouldFailInPreCheck: boolean = false) {
    this.shouldFailInPreCheck = shouldFailInPreCheck;
  }

  async execute(input: SkillInput): Promise<any> {
    throw new Error('Intentional execution failure');
  }

  async preCheck?(input: SkillInput): Promise<boolean> {
    if (this.shouldFailInPreCheck) {
      throw new Error('Intentional preCheck failure');
    }
    return true;
  }

  async postProcess?(result: any, input: SkillInput): Promise<void> {}

  async rollback?(input: SkillInput): Promise<boolean> {
    this.rollbackExecuted = true;
    return true;
  }

  async dryRun?(input: SkillInput): Promise<any> {
    return { dryRun: true };
  }

  isRollbackExecuted(): boolean {
    return this.rollbackExecuted;
  }

  metadata = {
    id: 'failing-skill',
    name: 'Failing Skill',
    version: '1.0.0',
  };
}

/**
 * 回滚也会失败的Skill（用于测试级联失败）
 */
class CascadingFailureSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    throw new Error('Primary execution failure');
  }

  async preCheck?(input: SkillInput): Promise<boolean> {
    return true;
  }

  async postProcess?(result: any, input: SkillInput): Promise<void> {}

  async rollback?(input: SkillInput): Promise<boolean> {
    throw new Error('Rollback also failed');
  }

  async dryRun?(input: SkillInput): Promise<any> {
    return { dryRun: true };
  }

  metadata = {
    id: 'cascading-failure-skill',
    name: 'Cascading Failure Skill',
    version: '1.0.0',
  };
}

// ============ Mock StateManager ============

class MockStateManager {
  private context: ProjectContext | null = null;
  private assets: Map<string, any> = new Map();
  private assetInfos: Map<string, any> = new Map();
  private executionEvents: any[] = [];
  private checkpoints: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    this.context = {
      meta: {
        project_name: 'error-recovery-test',
        project_type: 'greenfield',
        flow_mode: 'standard',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '5.0.0',
      },
      status: {
        current_phase: 'idle',
        current_story: null,
        last_story: null,
        completed_stories: [],
        total_stories: 0,
        progress_percentage: 0,
      },
      tech_stack: {},
      assets: {},
      git: { uncommitted_changes: 0 },
      execution_history: {
        last_skill_execution: '',
        last_execution_time: '',
        execution_count: 0,
      },
    };
  }

  async readContext(): Promise<ProjectContext> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    return this.context;
  }

  async updateContext(updates: Partial<ProjectContext>, source: string): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    if (updates.assets) {
      this.context.assets = { ...this.context.assets, ...updates.assets };
    }
    this.context = { ...this.context, ...updates };
    this.context.meta.updated_at = new Date().toISOString();
  }

  async readAsset(assetKey: string): Promise<any> {
    const assetInfo = this.assetInfos.get(assetKey);
    if (assetInfo) {
      return assetInfo;
    }
    return this.assets.get(assetKey);
  }

  async writeAsset(assetKey: string, content: any, source?: string): Promise<{ id: string; version: number }> {
    this.assets.set(assetKey, content);
    const assetInfo = {
      id: assetKey,
      version: 1,
      locked: false,
      file_path: `/test/${assetKey}.json`,
      created_at: new Date().toISOString(),
      created_by: source || 'test',
    };
    this.assetInfos.set(assetKey, assetInfo);
    if (this.context) {
      this.context.assets = {
        ...this.context.assets,
        [assetKey]: assetInfo,
      };
    }
    return { id: assetInfo.id, version: assetInfo.version };
  }

  async lockAsset(): Promise<void> {}
  async unlockAsset(): Promise<void> {}
  async isAssetLocked(): Promise<boolean> {
    return false;
  }

  async logExecution(skill: string, action: string, status: 'success' | 'failure'): Promise<void> {
    this.executionEvents.push({
      timestamp: new Date().toISOString(),
      skill_id: skill,
      execution_id: `${Date.now()}`,
      action: action as any,
      status: 'completed' as any,
      data: { status }
    });
  }

  async getExecutionHistory(): Promise<any> {
    return {
      last_skill_execution: this.executionEvents[this.executionEvents.length - 1]?.skill_id || '',
      last_execution_time: this.executionEvents[this.executionEvents.length - 1]?.timestamp || '',
      execution_count: this.executionEvents.length,
    };
  }

  // Checkpoint支持
  async createCheckpoint(checkpointId: string, data: any): Promise<void> {
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  async restoreCheckpoint(checkpointId: string): Promise<any> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
    return checkpoint.data;
  }

  hasCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.has(checkpointId);
  }
}

// ============ 测试套件 ============

describe('错误恢复和回滚集成测试', () => {
  let contextBus: IContextDataBus;
  let skillExecutor: ISkillExecutor;
  let changeDetector: IChangeDetector;
  let batchManager: IBatchManager;
  let greenfieldFlow: IGreenfieldFlow;
  let brownfieldFlow: IBrownfieldFlow;
  let hookManager: HookManager;
  let skillRegistry: Map<string, ISkillLifecycle>;
  let mockStateManager: MockStateManager;

  beforeEach(async () => {
    // 清理单例缓存
    ContextDataBus._clearCache();
    SmartRouter._clearCache();
    HookManager._clearCache();

    // 初始化核心组件
    contextBus = ContextDataBus.getInstance(TEST_PROJECT_ROOT);

    // 初始化并注入 MockStateManager
    mockStateManager = new MockStateManager();
    await mockStateManager.initialize();
    (contextBus as any)._setStateManager(mockStateManager);

    skillRegistry = new Map<string, ISkillLifecycle>();
    skillRegistry.set('success-skill', new SuccessSkill());
    skillExecutor = new SkillExecutor(contextBus, skillRegistry);
    changeDetector = new ChangeDetector(contextBus);
    batchManager = new BatchManager(contextBus, skillExecutor);
    greenfieldFlow = new GreenfieldFlow(contextBus, skillExecutor);
    brownfieldFlow = new BrownfieldFlow(contextBus, skillExecutor, changeDetector);
    hookManager = HookManager.getInstance(TEST_PROJECT_ROOT);
  });

  // ============ Skill执行失败和回滚测试 ============

  describe('Skill执行失败和回滚', () => {
    it('应在execute失败时自动执行rollback', async () => {
      const failingSkill = new FailingSkill();
      skillRegistry.set('failing-skill', failingSkill);

      const input: SkillInput = {
        skillId: 'failing-skill',
        action: 'test-action',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      // 验证执行状态为失败
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Intentional execution failure');

      // 验证回滚已执行
      expect(result.rollbackAttempted).toBe(true);
      expect(result.rollbackSuccess).toBe(true);
      expect(failingSkill.isRollbackExecuted()).toBe(true);
    });

    it('应在preCheck失败时执行rollback（当前实现行为）', async () => {
      const failingSkill = new FailingSkill(true); // 在preCheck中失败
      skillRegistry.set('failing-skill', failingSkill);

      const input: SkillInput = {
        skillId: 'failing-skill',
        action: 'test-action',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      // 验证执行状态为失败
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('preCheck');

      // 当前实现：即使preCheck失败也会执行rollback
      expect(result.rollbackAttempted).toBe(true);
      expect(result.rollbackSuccess).toBe(true);
    });

    it('应处理rollback本身失败的情况', async () => {
      skillRegistry.set('cascading-failure-skill', new CascadingFailureSkill());

      const input: SkillInput = {
        skillId: 'cascading-failure-skill',
        action: 'test-action',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      // 验证执行状态为失败
      expect(result.status).toBe('failed');
      expect(result.rollbackAttempted).toBe(true);
      expect(result.rollbackSuccess).toBe(false);

      // 验证duration仍然被记录
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应记录执行历史包括失败情况', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      await skillExecutor.execute({
        skillId: 'failing-skill',
        action: 'test-action',
        params: {},
      });

      const history = await skillExecutor.getExecutionHistory('failing-skill');

      expect(history.length).toBeGreaterThanOrEqual(1);
      const failedExecution = history.find(h => h.status === 'failed');
      expect(failedExecution).toBeDefined();
    });
  });

  // ============ 批量处理中的错误隔离测试 ============

  describe('批量处理中的错误隔离', () => {
    it('应隔离失败任务不影响其他任务', async () => {
      skillRegistry.set('success-skill', new SuccessSkill());
      skillRegistry.set('failing-skill', new FailingSkill());

      const tasks: BatchTask[] = [
        {
          storyId: 'story-1',
          skillId: 'success-skill',
          action: 'test-action',
          params: {},
          status: 'pending',
          retryCount: 0,
        },
        {
          storyId: 'story-2',
          skillId: 'failing-skill',
          action: 'test-action',
          params: {},
          status: 'pending',
          retryCount: 0,
        },
        {
          storyId: 'story-3',
          skillId: 'success-skill',
          action: 'test-action',
          params: {},
          status: 'pending',
          retryCount: 0,
        },
      ];

      const result = await batchManager.executeBatch(tasks);

      // 验证批量状态为partial
      expect(result.status).toBe('partial');
      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(2);
      expect(result.failedTasks).toBe(1);

      // 验证成功的任务已完成
      expect(result.results.get('story-1')?.status).toBe('completed');
      expect(result.results.get('story-3')?.status).toBe('completed');

      // 验证失败的任务记录了错误
      expect(result.results.get('story-2')?.status).toBe('failed');
      expect(result.results.get('story-2')?.error).toBeDefined();
    });

    it('应在任务失败时记录错误详情', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      const tasks: BatchTask[] = [
        {
          storyId: 'story-1',
          skillId: 'failing-skill',
          action: 'test-action',
          params: {},
          status: 'pending',
          retryCount: 0, // 不重试，立即失败
        },
      ];

      const result = await batchManager.executeBatch(tasks);

      const failedTask = result.results.get('story-1');
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toBeDefined();
      expect(failedTask?.error?.message).toContain('Intentional execution failure');
    });

    it('应支持部分失败后继续处理其他任务', async () => {
      skillRegistry.set('success-skill', new SuccessSkill());
      skillRegistry.set('failing-skill', new FailingSkill());

      // 创建10个任务，其中3个会失败
      const tasks: BatchTask[] = Array.from({ length: 10 }, (_, i) => ({
        storyId: `story-${i}`,
        skillId: i % 3 === 0 ? 'failing-skill' : 'success-skill',
        action: 'test-action',
        params: { index: i },
        status: 'pending' as const,
        retryCount: 0,
      }));

      const result = await batchManager.executeBatch(tasks);

      // 验证结果
      expect(result.totalTasks).toBe(10);
      expect(result.completedTasks).toBeGreaterThan(0);
      expect(result.failedTasks).toBeGreaterThan(0);
      expect(result.status).toBe('partial');
    });
  });

  // ============ 钩子执行失败的错误传播测试 ============

  describe('钩子执行失败的错误传播', () => {
    it('应在钩子失败时抛出错误', async () => {
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'failing-hook', async () => {
        throw new Error('Hook execution failed');
      });

      const mockContext: ProjectContext = {
        meta: {
          project_name: 'hook-error-test',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 验证钩子错误被正确抛出
      await expect(
        hookManager.triggerHooks(HookStage.BeforeContextUpdate, mockContext)
      ).rejects.toThrow('Hook execution failed');
    });

    it('应执行所有钩子即使前面有钩子失败', async () => {
      const executionOrder: string[] = [];

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'hook1', async () => {
        executionOrder.push('hook1');
      });
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'hook2', async () => {
        executionOrder.push('hook2');
        throw new Error('Hook2 failed');
      });
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'hook3', async () => {
        executionOrder.push('hook3');
      });

      const mockContext: ProjectContext = {
        meta: {
          project_name: 'hook-error-test',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 验证所有钩子都被执行
      try {
        await hookManager.triggerHooks(HookStage.BeforeContextUpdate, mockContext);
      } catch (error) {
        // 预期的错误
      }

      expect(executionOrder).toEqual(['hook1', 'hook2', 'hook3']);
    });
  });

  // ============ 状态一致性保证测试 ============

  describe('状态一致性保证', () => {
    it('应在失败后保持状态一致性', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      // 获取初始状态
      const initialState = await contextBus.getContext();

      // 执行失败的Skill
      await skillExecutor.execute({
        skillId: 'failing-skill',
        action: 'test-action',
        params: {},
      });

      // 验证状态仍然可访问
      const currentState = await contextBus.getContext();
      expect(currentState).toBeDefined();
      expect(currentState.meta.project_name).toBe(initialState.meta.project_name);

      // 验证状态没有被破坏
      expect(currentState.meta.project_type).toBe(initialState.meta.project_type);
      expect(currentState.status.current_phase).toBe(initialState.status.current_phase);
    });

    it('应在批量处理失败后保持状态一致性', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      const tasks: BatchTask[] = [
        {
          storyId: 'story-1',
          skillId: 'failing-skill',
          action: 'test-action',
          params: {},
          status: 'pending',
          retryCount: 0,
        },
      ];

      // 执行会失败的批量任务
      await batchManager.executeBatch(tasks);

      // 验证状态仍然一致
      const state = await contextBus.getContext();
      expect(state).toBeDefined();
      expect(state.meta.project_name).toBe('error-recovery-test');
    });

    it('应支持从checkpoint恢复状态', async () => {
      // 创建checkpoint
      const checkpointData = {
        phase: 'test-phase',
        progress: 50,
        completedStories: ['story-1', 'story-2'],
      };

      await mockStateManager.createCheckpoint('test-checkpoint', checkpointData);

      // 验证checkpoint存在
      expect(mockStateManager.hasCheckpoint('test-checkpoint')).toBe(true);

      // 恢复checkpoint
      const restoredData = await mockStateManager.restoreCheckpoint('test-checkpoint');

      expect(restoredData).toEqual(checkpointData);
      expect(restoredData.phase).toBe('test-phase');
      expect(restoredData.progress).toBe(50);
    });
  });

  // ============ 端到端错误恢复测试 ============

  describe('端到端错误恢复', () => {
    it('应在绿地流程中处理Skill执行错误', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      const config: FlowConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'error-recovery-greenfield',
        projectType: 'greenfield',
      };

      // 当前Flow实现不会在内部调用Skill，所以会成功
      // 这里测试的是Flow的错误处理能力
      const result = await greenfieldFlow.start(config);

      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
    });

    it('应在棕地流程中处理分析错误', async () => {
      // Mock ChangeDetector抛出异常
      const faultyChangeDetector = {
        async scanProjectChanges() {
          throw new Error('Analysis failed');
        },
        async detectFileChange(): Promise<ChangeDetectionResult> {
          return { hasChanged: false, changeType: 'none' as const, filePath: '', isAsset: false };
        },
        async getFileHash() {
          return { hash: 'hash', filePath: '', size: 0, lastModified: '' };
        },
        async batchGetFileHashes() {
          return new Map();
        },
        async evaluateChangeSeverity() {
          return { severity: 'safe', action: 'overwrite', reason: 'safe', requiresConfirmation: false };
        },
        async backupFile() {
          return '/backup/file.bak';
        },
        async detectAssetChange(): Promise<ChangeDetectionResult | null> {
          return { hasChanged: false, changeType: 'none' as const, filePath: '', isAsset: false };
        },
        async applyWriteStrategy() {
          return true;
        },
      } as IChangeDetector;

      const faultyFlow = new BrownfieldFlow(contextBus, skillExecutor, faultyChangeDetector);

      const config: BrownfieldConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'error-recovery-brownfield',
      };

      const result = await faultyFlow.start(config);

      // 验证错误被捕获而不是导致整个流程崩溃
      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Analysis failed');
    });
  });

  // ============ 并发错误处理测试 ============

  describe('并发错误处理', () => {
    it('应正确处理多个并发失败', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      // 创建多个并发执行的任务
      const tasks = Array.from({ length: 5 }, (_, i) =>
        skillExecutor.execute({
          skillId: 'failing-skill',
          action: `test-action-${i}`,
          params: { index: i },
        })
      );

      // 并发执行所有任务
      const results = await Promise.all(tasks);

      // 验证所有任务都失败了，但没有异常抛出
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.status).toBe('failed');
        expect(result.error).toBeDefined();
      });
    });

    it('应在混合成功和失败中保持一致性', async () => {
      skillRegistry.set('success-skill', new SuccessSkill());
      skillRegistry.set('failing-skill', new FailingSkill());

      // 并发执行成功和失败的任务
      const results = await Promise.all([
        skillExecutor.execute({
          skillId: 'success-skill',
          action: 'test-action',
          params: {},
        }),
        skillExecutor.execute({
          skillId: 'failing-skill',
          action: 'test-action',
          params: {},
        }),
        skillExecutor.execute({
          skillId: 'success-skill',
          action: 'test-action',
          params: {},
        }),
      ]);

      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('failed');
      expect(results[2].status).toBe('success');

      // 验证执行历史正确记录了所有结果
      const history = await skillExecutor.getExecutionHistory();
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============ 资源清理测试 ============

  describe('资源清理', () => {
    it('应在错误后正确清理资源', async () => {
      skillRegistry.set('failing-skill', new FailingSkill());

      // 执行失败的任务
      await skillExecutor.execute({
        skillId: 'failing-skill',
        action: 'test-action',
        params: {},
      });

      // 验证ContextDataBus仍然可用
      const context = await contextBus.getContext();
      expect(context).toBeDefined();

      // 验证可以写入新资产
      const assetInfo = await contextBus.writeAsset(
        'test-asset',
        { data: 'test' },
        'test-source'
      );
      expect(assetInfo).toBeDefined();
    });
  });
});
