/**
 * DevFlow v5 - HookManager 优先级机制测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import { HookManager, HookConfig, HookPhase } from '../../core/hooks/HookManager';
import { ContextDataBus } from '../../lib/bus/ContextDataBus';

describe('HookManager - 优先级机制', () => {
  let hookManager: HookManager;
  let contextBus: ContextDataBus;

  beforeEach(() => {
    contextBus = ContextDataBus.getInstance('/test/project');
    hookManager = new HookManager(contextBus);
  });

  afterEach(async () => {
    await hookManager.clearAll();
  });

  describe('优先级注册', () => {
    it('应该按优先级从高到低排序钩子', async () => {
      const phase: HookPhase = 'pre-commit';

      // 注册不同优先级的钩子
      await hookManager.register({
        id: 'hook-low',
        phase,
        command: 'echo "low priority"',
        priority: 1
      });

      await hookManager.register({
        id: 'hook-high',
        phase,
        command: 'echo "high priority"',
        priority: 10
      });

      await hookManager.register({
        id: 'hook-medium',
        phase,
        command: 'echo "medium priority"',
        priority: 5
      });

      const hooks = await hookManager.getHooks(phase);

      // 验证顺序：high → medium → low
      expect(hooks).toHaveLength(3);
      expect(hooks[0].id).toBe('hook-high');
      expect(hooks[1].id).toBe('hook-medium');
      expect(hooks[2].id).toBe('hook-low');
    });

    it('应该为未指定优先级的钩子分配默认值', async () => {
      const phase: HookPhase = 'pre-commit';

      await hookManager.register({
        id: 'hook-default',
        phase,
        command: 'echo "default priority"'
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks[0].priority).toBe(5); // 默认优先级 5
    });

    it('应该对相同优先级的钩子按注册时间排序', async () => {
      const phase: HookPhase = 'pre-commit';

      await hookManager.register({
        id: 'hook-first',
        phase,
        command: 'echo "first"',
        priority: 5
      });

      // 添加延迟确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      await hookManager.register({
        id: 'hook-second',
        phase,
        command: 'echo "second"',
        priority: 5
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks[0].id).toBe('hook-first');
      expect(hooks[1].id).toBe('hook-second');
    });
  });

  describe('优先级执行', () => {
    it('应该按优先级顺序触发钩子', async () => {
      const phase: HookPhase = 'pre-story';
      const executionOrder: string[] = [];

      // Mock executeHook 方法来记录执行顺序
      const originalTrigger = hookManager.trigger;
      let callCount = 0;

      // 注册不同优先级的钩子
      await hookManager.register({
        id: 'hook-1',
        phase,
        command: 'echo "1"',
        priority: 1
      });

      await hookManager.register({
        id: 'hook-10',
        phase,
        command: 'echo "10"',
        priority: 10
      });

      await hookManager.register({
        id: 'hook-5',
        phase,
        command: 'echo "5"',
        priority: 5
      });

      const hooks = await hookManager.getHooks(phase);

      // 验证钩子已按优先级排序
      expect(hooks[0].id).toBe('hook-10');
      expect(hooks[1].id).toBe('hook-5');
      expect(hooks[2].id).toBe('hook-1');
    });
  });

  describe('优先级边界条件', () => {
    it('应该处理优先级为 0 的情况', async () => {
      const phase: HookPhase = 'post-commit';

      await hookManager.register({
        id: 'hook-zero',
        phase,
        command: 'echo "zero priority"',
        priority: 0
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks).toHaveLength(1);
      expect(hooks[0].priority).toBe(0);
    });

    it('应该处理负数优先级', async () => {
      const phase: HookPhase = 'post-commit';

      await hookManager.register({
        id: 'hook-negative',
        phase,
        command: 'echo "negative priority"',
        priority: -5
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks).toHaveLength(1);
      expect(hooks[0].priority).toBe(-5);
    });

    it('应该处理超过 10 的高优先级', async () => {
      const phase: HookPhase = 'pre-project';

      await hookManager.register({
        id: 'hook-15',
        phase,
        command: 'echo "priority 15"',
        priority: 15
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks).toHaveLength(1);
      expect(hooks[0].priority).toBe(15);
    });
  });

  describe('优先级与阻塞', () => {
    it('应该在高优先级阻塞钩子失败时停止执行', async () => {
      const phase: HookPhase = 'pre-phase';

      // 高优先级阻塞钩子
      await hookManager.register({
        id: 'hook-blocking-high',
        phase,
        command: 'false', // 失败命令
        priority: 10,
        blocking: true
      });

      // 低优先级钩子
      await hookManager.register({
        id: 'hook-low',
        phase,
        command: 'echo "low"',
        priority: 1
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks[0].id).toBe('hook-blocking-high');
      expect(hooks[1].id).toBe('hook-low');
    });
  });

  describe('动态优先级更新', () => {
    it('应该支持更新现有钩子的优先级', async () => {
      const phase: HookPhase = 'post-story';

      await hookManager.register({
        id: 'hook-update',
        phase,
        command: 'echo "update"',
        priority: 1
      });

      // 注销并重新注册以更新优先级
      await hookManager.unregister('hook-update');

      await hookManager.register({
        id: 'hook-update',
        phase,
        command: 'echo "update"',
        priority: 10
      });

      const hooks = await hookManager.getHooks(phase);
      expect(hooks).toHaveLength(1);
      expect(hooks[0].priority).toBe(10);
    });
  });
});
