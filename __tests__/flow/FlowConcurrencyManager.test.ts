/**
 * DevFlow v5 - 流程并发控制管理器单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  FlowConcurrencyManager,
  FlowConcurrencyLimitError,
  type ConcurrencyConfig,
  type ConcurrencyStats
} from '../../core/flow/FlowConcurrencyManager';

describe('FlowConcurrencyManager', () => {
  let manager: FlowConcurrencyManager;

  beforeEach(() => {
    FlowConcurrencyManager.clearInstance();
    manager = FlowConcurrencyManager.getInstance({
      maxConcurrentFlows: 2,
      flowTimeout: 10000, // 增加超时时间以避免测试超时
      enableWaitQueue: true,
      maxWaitQueueSize: 3
    });
  });

  afterEach(() => {
    FlowConcurrencyManager.clearInstance();
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = FlowConcurrencyManager.getInstance();
      const instance2 = FlowConcurrencyManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('清除后应该创建新实例', () => {
      const instance1 = FlowConcurrencyManager.getInstance();
      FlowConcurrencyManager.clearInstance();
      const instance2 = FlowConcurrencyManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('流程槽位获取', () => {
    it('应该允许在限制内启动流程', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(2);
    });

    it('应该在达到限制时将流程放入等待队列', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      // 第三个流程应该进入等待队列
      const flow3Promise = manager.acquireFlowSlot('flow-3', 'greenfield');

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(2);
      expect(stats.currentWaiting).toBe(1);

      // 释放一个槽位
      manager.releaseFlowSlot('flow-1', 'completed');

      // 等待 flow3 完成
      await flow3Promise;

      // 现在应该可以执行
      const finalStats = manager.getStats();
      expect(finalStats.currentRunning).toBe(2);
    });

    it('应该拒绝超过等待队列大小的请求', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      // 填满等待队列
      await manager.acquireFlowSlot('flow-3', 'greenfield');
      await manager.acquireFlowSlot('flow-4', 'brownfield');
      await manager.acquireFlowSlot('flow-5', 'greenfield');

      // 下一个请求应该被拒绝
      await expect(manager.acquireFlowSlot('flow-6', 'brownfield')).rejects.toThrow(
        FlowConcurrencyLimitError
      );
    });

    it('应该在禁用等待队列时立即拒绝超出限制的请求', async () => {
      FlowConcurrencyManager.clearInstance();
      const noWaitManager = FlowConcurrencyManager.getInstance({
        maxConcurrentFlows: 2,
        enableWaitQueue: false
      });

      await noWaitManager.acquireFlowSlot('flow-1', 'greenfield');
      await noWaitManager.acquireFlowSlot('flow-2', 'brownfield');

      // 第三个请求应该被立即拒绝
      await expect(noWaitManager.acquireFlowSlot('flow-3', 'greenfield')).rejects.toThrow(
        FlowConcurrencyLimitError
      );
    });
  });

  describe('流程槽位释放', () => {
    it('应该正确释放流程槽位', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      manager.releaseFlowSlot('flow-1', 'completed');

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(1);
    });

    it('应该从等待队列中启动下一个流程', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');
      const flow3Promise = manager.acquireFlowSlot('flow-3', 'greenfield');

      manager.releaseFlowSlot('flow-1', 'completed');

      // 等待异步处理
      await new Promise(resolve => setTimeout(resolve, 50));
      await flow3Promise;

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(2);
    });

    it('应该更新统计信息', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      manager.releaseFlowSlot('flow-1', 'completed');

      await manager.acquireFlowSlot('flow-2', 'brownfield');
      manager.releaseFlowSlot('flow-2', 'failed');

      const stats = manager.getStats();
      expect(stats.totalCompleted).toBe(1);
      expect(stats.totalFailed).toBe(1);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');
      await manager.acquireFlowSlot('flow-3', 'greenfield');

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(2);
      expect(stats.currentWaiting).toBe(1);
      expect(stats.maxConcurrent).toBe(2);
    });

    it('应该跟踪最大并发数', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      manager.releaseFlowSlot('flow-1', 'completed');
      await manager.acquireFlowSlot('flow-3', 'greenfield');

      const runningFlows = manager.getRunningFlows();
      expect(runningFlows.length).toBe(2);
    });
  });

  describe('等待队列管理', () => {
    it('应该返回等待中的流程列表', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');
      await manager.acquireFlowSlot('flow-3', 'greenfield');

      const waitingFlows = manager.getWaitingFlows();
      expect(waitingFlows).toContain('flow-3');
    }, 10000);

    it('应该允许取消等待中的流程', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      const flow3Promise = manager.acquireFlowSlot('flow-3', 'greenfield');
      const cancelled = manager.cancelWaitingFlow('flow-3');

      expect(cancelled).toBe(true);

      // 验证 Promise 被拒绝
      await expect(flow3Promise).rejects.toThrow('流程已取消');

      const waitingFlows = manager.getWaitingFlows();
      expect(waitingFlows).not.toContain('flow-3');
    }, 10000);

    it('应该取消不存在的流程时返回 false', () => {
      const cancelled = manager.cancelWaitingFlow('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('配置更新', () => {
    it('应该支持动态更新配置', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');
      const flow3Promise = manager.acquireFlowSlot('flow-3', 'greenfield');

      // flow-3 应该在等待队列中
      let stats = manager.getStats();
      expect(stats.currentRunning).toBe(2);
      expect(stats.currentWaiting).toBe(1);

      // 增加并发限制
      manager.updateConfig({ maxConcurrentFlows: 4 });

      // 等待队列处理
      await flow3Promise;
      await new Promise(resolve => setTimeout(resolve, 50));

      stats = manager.getStats();
      expect(stats.currentRunning).toBe(3);
    });
  });

  describe('辅助方法', () => {
    it('应该正确判断是否可以立即开始', async () => {
      expect(manager.canStartImmediately()).toBe(true);

      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      expect(manager.canStartImmediately()).toBe(false);

      manager.releaseFlowSlot('flow-1', 'completed');
      expect(manager.canStartImmediately()).toBe(true);
    });

    it('应该返回正在运行的流程列表', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');

      const runningFlows = manager.getRunningFlows();
      expect(runningFlows).toHaveLength(2);
      expect(runningFlows[0].flowId).toBe('flow-1');
      expect(runningFlows[0].status).toBe('running');
    });
  });

  describe('重置功能', () => {
    it('应该重置所有状态', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      await manager.acquireFlowSlot('flow-2', 'brownfield');
      manager.releaseFlowSlot('flow-1', 'completed');
      manager.releaseFlowSlot('flow-2', 'failed');

      manager.reset();

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(0);
      expect(stats.currentWaiting).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.totalFailed).toBe(0);
    });
  });

  describe('重复流程处理', () => {
    it('应该允许已运行的流程重复获取槽位', async () => {
      await manager.acquireFlowSlot('flow-1', 'greenfield');
      // 不应抛出错误
      await manager.acquireFlowSlot('flow-1', 'greenfield');

      const stats = manager.getStats();
      expect(stats.currentRunning).toBe(1);
    });
  });

  describe('边界条件', () => {
    it('应该处理零并发限制', async () => {
      FlowConcurrencyManager.clearInstance();
      const zeroLimitManager = FlowConcurrencyManager.getInstance({
        maxConcurrentFlows: 0,
        enableWaitQueue: false
      });

      await expect(zeroLimitManager.acquireFlowSlot('flow-1', 'greenfield')).rejects.toThrow(
        FlowConcurrencyLimitError
      );
    });

    it('应该处理空等待队列配置', () => {
      FlowConcurrencyManager.clearInstance();
      const testManager = FlowConcurrencyManager.getInstance({
        maxWaitQueueSize: 0,
        enableWaitQueue: true
      });

      const waitingFlows = testManager.getWaitingFlows();
      expect(waitingFlows).toEqual([]);
    });
  });
});
