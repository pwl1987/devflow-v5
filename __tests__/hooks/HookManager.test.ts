/**
 * HookManager 测试用例
 * 覆盖：钩子注册/注销、异步触发、阶段隔离、单例隔离
 */
import { HookManager, HookStage } from '../../core/hooks/HookManagerImpl';
import { ProjectContext } from '../../core/state/ProjectContext';

function createTestProjectContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  const now = new Date().toISOString();
  return {
    meta: {
      project_name: 'test-project',
      project_type: 'greenfield',
      flow_mode: 'standard',
      created_at: now,
      updated_at: now,
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
    ...overrides,
  };
}

describe('HookManager', () => {
  let mockBeforeHook: jest.Mock;
  let mockAfterHook: jest.Mock;

  beforeEach(() => {
    HookManager._clearCache();
    jest.clearAllMocks();

    mockBeforeHook = jest.fn().mockResolvedValue(undefined);
    mockAfterHook = jest.fn().mockResolvedValue(undefined);
  });

  describe('单例模式', () => {
    test('相同项目根路径返回同一实例', () => {
      const instance1 = HookManager.getInstance('/test-root');
      const instance2 = HookManager.getInstance('/test-root');
      expect(instance1).toBe(instance2);
    });

    test('不同项目根路径返回不同实例', () => {
      const instance1 = HookManager.getInstance('/test-root-1');
      const instance2 = HookManager.getInstance('/test-root-2');
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('钩子管理', () => {
    test('注册钩子 - 触发对应阶段钩子', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'test-hook', mockBeforeHook);

      await hookManager.triggerHooks(HookStage.BeforeContextUpdate, testContext);

      expect(mockBeforeHook).toHaveBeenCalledWith(testContext);
    });

    test('异步钩子 - 按注册顺序执行', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      const executionOrder: string[] = [];
      const hook1 = jest.fn().mockImplementation(async () => {
        executionOrder.push('hook1');
      });
      const hook2 = jest.fn().mockImplementation(async () => {
        executionOrder.push('hook2');
      });

      hookManager.registerHook(HookStage.AfterSkillExecution, 'hook1', hook1);
      hookManager.registerHook(HookStage.AfterSkillExecution, 'hook2', hook2);

      await hookManager.triggerHooks(HookStage.AfterSkillExecution, testContext);

      expect(executionOrder).toEqual(['hook1', 'hook2']);
    });

    test('注销钩子 - 钩子不再触发', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'test-hook', mockBeforeHook);
      hookManager.unregisterHook(HookStage.BeforeContextUpdate, 'test-hook');

      await hookManager.triggerHooks(HookStage.BeforeContextUpdate, testContext);

      expect(mockBeforeHook).not.toHaveBeenCalled();
    });

    test('触发不存在的阶段钩子 - 无异常', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      await expect(
        hookManager.triggerHooks('unknown-stage' as HookStage, testContext)
      ).resolves.not.toThrow();
    });
  });

  describe('边界情况', () => {
    test('钩子抛出异常 - 继续执行后续钩子', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      const errorHook = jest.fn().mockRejectedValue(new Error('Hook error'));
      const successHook = jest.fn().mockResolvedValue(undefined);

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'error-hook', errorHook);
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'success-hook', successHook);

      // 即使第一个钩子抛出异常，第二个钩子仍应执行
      await expect(
        hookManager.triggerHooks(HookStage.BeforeContextUpdate, testContext)
      ).rejects.toThrow('Hook error');

      expect(successHook).toHaveBeenCalled();
    });

    test('空钩子列表 - 无异常', async () => {
      const hookManager = HookManager.getInstance('/test-root');
      const testContext = createTestProjectContext();

      await expect(
        hookManager.triggerHooks(HookStage.BeforeContextUpdate, testContext)
      ).resolves.not.toThrow();
    });
  });
});
