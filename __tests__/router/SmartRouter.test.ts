/**
 * SmartRouter 测试用例
 * 覆盖：单例隔离、路由规则注册、上下文匹配、执行历史路由
 */
import { SmartRouter } from '../../core/router/SmartRouterImpl';
import { ProjectContext } from '../../core/state/ProjectContext';

// ============ 测试数据生成 ============

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
    git: {
      uncommitted_changes: 0,
    },
    execution_history: {
      last_skill_execution: '',
      last_execution_time: '',
      execution_count: 0,
    },
    ...overrides,
  };
}

describe('SmartRouter', () => {
  // 在 beforeEach 之后重新创建 mock
  let mockHandler: jest.Mock;
  let mockFallbackHandler: jest.Mock;

  beforeEach(() => {
    // 清除单例缓存，保证测试隔离
    SmartRouter._clearCache();
    jest.clearAllMocks();

    // 重新创建 mock
    mockHandler = jest.fn().mockResolvedValue('handler-result');
    mockFallbackHandler = jest.fn().mockResolvedValue('fallback-result');
  });

  describe('单例模式', () => {
    test('相同项目根路径返回同一实例', () => {
      const instance1 = SmartRouter.getInstance('/test-root');
      const instance2 = SmartRouter.getInstance('/test-root');
      expect(instance1).toBe(instance2);
    });

    test('不同项目根路径返回不同实例', () => {
      const instance1 = SmartRouter.getInstance('/test-root-1');
      const instance2 = SmartRouter.getInstance('/test-root-2');
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('路由规则管理', () => {
    test('注册路由规则 - 能匹配上下文并执行对应处理器', async () => {
      // 每个测试用例重新创建 mock
      const mockHandler = jest.fn().mockResolvedValue('handler-result');
      const mockFallbackHandler = jest.fn().mockResolvedValue('fallback-result');

      // 1. 准备测试上下文
      const testContext = createTestProjectContext({
        status: {
          current_phase: 'implementation' as const,
          current_story: 'E001-S001',
          last_story: null,
          completed_stories: [],
          total_stories: 10,
          progress_percentage: 10,
        },
      });

      // 2. 定义路由规则
      const rule = {
        match: (ctx: ProjectContext) => ctx.status?.current_phase === 'implementation',
        handler: mockHandler,
      };

      // 3. 注册规则并执行路由
      const router = SmartRouter.getInstance('/test-root');
      router.registerRule('dev-rule', rule);
      router.setFallbackHandler(mockFallbackHandler);

      // 4. 执行路由并验证
      const result = await router.route(testContext);
      expect(mockHandler).toHaveBeenCalledWith(testContext);
      expect(result).toBe('handler-result');
      expect(mockFallbackHandler).not.toHaveBeenCalled();
    });

    test('路由匹配失败 - 执行兜底处理器', async () => {
      const mockFallbackHandler = jest.fn().mockResolvedValue('fallback-result');

      const testContext = createTestProjectContext({
        status: {
          current_phase: 'idle' as const,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
      });

      const router = SmartRouter.getInstance('/test-root');
      router.setFallbackHandler(mockFallbackHandler);

      const result = await router.route(testContext);
      expect(mockFallbackHandler).toHaveBeenCalledWith(testContext);
      expect(result).toBe('fallback-result');
    });

    test('注销路由规则 - 规则不再生效', async () => {
      const testContext = createTestProjectContext({
        status: {
          current_phase: 'implementation' as const,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
      });

      const rule = {
        match: (ctx: ProjectContext) => ctx.status?.current_phase === 'implementation',
        handler: mockHandler,
      };

      const router = SmartRouter.getInstance('/test-root');
      router.registerRule('test-rule', rule);
      router.unregisterRule('test-rule');

      router.setFallbackHandler(mockFallbackHandler);
      const result = await router.route(testContext);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockFallbackHandler).toHaveBeenCalled();
    });

    test('无匹配规则且无兜底处理器 - 抛出异常', async () => {
      const testContext = createTestProjectContext();
      const router = SmartRouter.getInstance('/test-root');

      await expect(router.route(testContext)).rejects.toThrow(
        '无匹配的路由规则，且未设置兜底处理器'
      );
    });

    test('多个规则 - 按注册顺序匹配第一个', async () => {
      const testContext = createTestProjectContext({
        status: {
          current_phase: 'implementation' as const,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
      });

      const handler1 = jest.fn().mockResolvedValue('handler1');
      const handler2 = jest.fn().mockResolvedValue('handler2');

      const router = SmartRouter.getInstance('/test-root');

      // 注册两个匹配的规则
      router.registerRule('rule1', {
        match: (ctx: ProjectContext) => ctx.status?.current_phase === 'implementation',
        handler: handler1,
      });
      router.registerRule('rule2', {
        match: (ctx: ProjectContext) => ctx.status?.current_phase === 'implementation',
        handler: handler2,
      });

      const result = await router.route(testContext);

      // 应该执行第一个匹配的处理器
      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(result).toBe('handler1');
    });
  });

  describe('边界情况', () => {
    test('空上下文 - 正常处理', async () => {
      const mockFallbackHandler = jest.fn().mockResolvedValue('fallback-result');
      const router = SmartRouter.getInstance('/test-root');
      router.setFallbackHandler(mockFallbackHandler);

      const result = await router.route(null as any);
      expect(mockFallbackHandler).toHaveBeenCalled();
    });

    test('处理器抛出异常 - 向上传播', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const testContext = createTestProjectContext();

      const router = SmartRouter.getInstance('/test-root');
      router.registerRule('error-rule', {
        match: () => true,
        handler: errorHandler,
      });

      await expect(router.route(testContext)).rejects.toThrow('Handler error');
    });
  });
});
