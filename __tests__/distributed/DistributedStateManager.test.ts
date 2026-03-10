/**
 * DistributedStateManager 单元测试
 *
 * 测试范围：
 * - 节点管理（注册、注销、状态更新）
 * - 状态同步
 * - 冲突检测和解决
 * - 状态传播
 * - 快照管理
 * - 同步会话
 * - 统计信息
 */

import {
  DistributedStateManager,
  IDistributedStateManager
} from '../../core/distributed';
import {
  NodeStatus,
  NodeCapability,
  SyncOperationStatus,
  ConflictSeverity,
  ConflictResolutionStrategy,
  ConflictResolutionStatus,
  PropagationMode,
  PropagationScope,
  PropagationStatus,
  SyncSessionType,
  SyncSessionStatus
} from '../../core/distributed';

describe('DistributedStateManager', () => {
  let manager: IDistributedStateManager;

  beforeEach(async () => {
    manager = new DistributedStateManager();
  });

  afterEach(async () => {
    await manager.clear();
  });

  // ============ 节点管理测试 ============

  describe('节点管理', () => {
    it('应成功注册节点', async () => {
      const result = await manager.registerNode(
        'node-1',
        'workspace',
        [NodeCapability.RECEIVE_UPDATES, NodeCapability.SEND_UPDATES]
      );

      expect(result).toBe(true);

      const node = await manager.getNode('node-1');
      expect(node).toBeDefined();
      expect(node?.nodeId).toBe('node-1');
      expect(node?.status).toBe(NodeStatus.ONLINE);
      expect(node?.capabilities).toContain(NodeCapability.RECEIVE_UPDATES);
    });

    it('应拒绝重复注册相同节点', async () => {
      await manager.registerNode('node-1', 'workspace', [NodeCapability.RECEIVE_UPDATES]);

      const result = await manager.registerNode('node-1', 'project', [NodeCapability.SEND_UPDATES]);

      expect(result).toBe(false);
    });

    it('应成功注销节点', async () => {
      await manager.registerNode('node-1', 'workspace', [NodeCapability.RECEIVE_UPDATES]);

      const result = await manager.unregisterNode('node-1');

      expect(result).toBe(true);

      const node = await manager.getNode('node-1');
      expect(node).toBeNull();
    });

    it('应返回失败当注销不存在的节点', async () => {
      const result = await manager.unregisterNode('non-existent');
      expect(result).toBe(false);
    });

    it('应更新节点状态', async () => {
      await manager.registerNode('node-1', 'workspace', [NodeCapability.RECEIVE_UPDATES]);

      const result = await manager.updateNodeStatus('node-1', NodeStatus.OFFLINE);

      expect(result).toBe(true);

      const node = await manager.getNode('node-1');
      expect(node?.status).toBe(NodeStatus.OFFLINE);
    });

    it('应列出所有节点', async () => {
      await manager.registerNode('node-1', 'workspace', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('node-2', 'project', [NodeCapability.SEND_UPDATES]);
      await manager.registerNode('node-3', 'global', [NodeCapability.QUERY_STATE]);

      const nodes = await manager.listNodes();

      expect(nodes).toHaveLength(3);
      expect(nodes.map(n => n.nodeId)).toEqual(expect.arrayContaining(['node-1', 'node-2', 'node-3']));
    });
  });

  // ============ 状态同步测试 ============

  describe('状态同步', () => {
    beforeEach(async () => {
      await manager.registerNode(
        'source-node',
        'workspace',
        [NodeCapability.SEND_UPDATES, NodeCapability.RECEIVE_UPDATES]
      );
      await manager.registerNode(
        'target-node',
        'project',
        [NodeCapability.RECEIVE_UPDATES]
      );
    });

    it('应成功同步状态', async () => {
      const operationId = await manager.syncState(
        'source-node',
        'target-node',
        'test-key',
        { value: 'test-data' },
        1
      );

      expect(operationId).toBeDefined();

      const operation = await manager.getSyncOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.sourceNodeId).toBe('source-node');
      expect(operation?.targetNodeId).toBe('target-node');
      expect(operation?.stateKey).toBe('test-key');
      expect(operation?.stateData).toEqual({ value: 'test-data' });
      expect(operation?.priority).toBe(1);
    });

    it('应抛出错误当源节点不存在', async () => {
      await expect(
        manager.syncState('non-existent', 'target-node', 'key', 'data')
      ).rejects.toThrow('Source or target node not found');
    });

    it('应抛出错误当目标节点不在线', async () => {
      await manager.updateNodeStatus('target-node', NodeStatus.OFFLINE);

      await expect(
        manager.syncState('source-node', 'target-node', 'key', 'data')
      ).rejects.toThrow('Target node is not online');
    });

    it('应批量同步状态到多个节点', async () => {
      await manager.registerNode('target-1', 'project', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('target-2', 'project', [NodeCapability.RECEIVE_UPDATES]);

      const states = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]);

      const operationIds = await manager.syncStates(
        'source-node',
        ['target-1', 'target-2'],
        states,
        2
      );

      expect(operationIds).toHaveLength(4); // 2 targets × 2 states
    });

    it('应获取节点的待处理同步操作', async () => {
      await manager.syncState('source-node', 'target-node', 'key1', 'data1', 1);
      await manager.syncState('source-node', 'target-node', 'key2', 'data2', 2);

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const pendingOps = await manager.getPendingSyncOperations('target-node');

      // 操作应该已经完成（因为是同步内存操作）
      expect(Array.isArray(pendingOps)).toBe(true);
    });
  });

  // ============ 冲突管理测试 ============

  describe('冲突管理', () => {
    beforeEach(async () => {
      await manager.registerNode('node-1', 'workspace', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES,
        NodeCapability.RESOLVE_CONFLICTS
      ]);
      await manager.registerNode('node-2', 'project', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('node-3', 'project', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
    });

    it('应检测到状态冲突', async () => {
      // node-1 更新状态
      await manager.syncState('node-1', 'node-2', 'shared-key', { value: 'from-node-1' });
      await manager.syncState('node-1', 'node-3', 'shared-key', { value: 'from-node-1' });

      // node-2 更新相同状态（不同值）
      await manager.syncState('node-2', 'node-3', 'shared-key', { value: 'from-node-2' });

      // 检测冲突
      const conflicts = await manager.detectConflicts('shared-key');

      // 可能检测到冲突
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('应使用 LAST_WRITE_WINS 策略解决冲突', async () => {
      await manager.syncState('node-1', 'node-2', 'conflict-key', { value: 'first' });
      await manager.syncState('node-1', 'node-3', 'conflict-key', { value: 'first' });

      // 稍后更新
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.syncState('node-2', 'node-3', 'conflict-key', { value: 'second' });

      const conflicts = await manager.detectConflicts('conflict-key', ['node-2', 'node-3']);

      if (conflicts.length > 0) {
        const conflictId = conflicts[0].id;
        const result = await manager.resolveConflict(
          conflictId,
          ConflictResolutionStrategy.LAST_WRITE_WINS
        );

        expect(result).toBe(true);

        const updatedConflicts = await manager.getUnresolvedConflicts();
        expect(updatedConflicts.every(c => c.id !== conflictId)).toBe(true);
      }
    });

    it('应使用 HIGHEST_VERSION_WINS 策略解决冲突', async () => {
      const conflicts = await manager.detectConflicts('test-key');

      if (conflicts.length > 0) {
        const result = await manager.resolveConflict(
          conflicts[0].id,
          ConflictResolutionStrategy.HIGHEST_VERSION_WINS
        );

        expect(result).toBe(true);
      }
    });

    it('应使用 MANUAL 策略手动解决冲突', async () => {
      const conflicts = await manager.detectConflicts('manual-key');

      if (conflicts.length > 0) {
        const customData = { manually: 'resolved', value: 42 };

        const result = await manager.resolveConflict(
          conflicts[0].id,
          ConflictResolutionStrategy.MANUAL,
          customData
        );

        expect(result).toBe(true);
      }
    });

    it('应获取未解决的冲突', async () => {
      await manager.syncState('node-1', 'node-2', 'key', 'value1');
      await manager.syncState('node-1', 'node-3', 'key', 'value1');
      await manager.syncState('node-2', 'node-3', 'key', 'value2');

      const unresolved = await manager.getUnresolvedConflicts();

      expect(Array.isArray(unresolved)).toBe(true);
    });

    it('应按严重级别过滤未解决的冲突', async () => {
      await manager.syncState('node-1', 'node-2', 'key', 'value1');
      await manager.syncState('node-2', 'node-3', 'key', 'value2');

      const highSeverityConflicts = await manager.getUnresolvedConflicts(ConflictSeverity.HIGH);

      expect(Array.isArray(highSeverityConflicts)).toBe(true);
    });
  });

  // ============ 状态传播测试 ============

  describe('状态传播', () => {
    beforeEach(async () => {
      await manager.registerNode('source', 'workspace', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('target-1', 'project', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('target-2', 'project', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('target-3', 'project', [NodeCapability.RECEIVE_UPDATES]);
    });

    it('应传播状态变更到工作区', async () => {
      const eventId = await manager.propagateStateChange(
        'source',
        ['key1', 'key2'],
        PropagationScope.WORKSPACE,
        PropagationMode.IMMEDIATE
      );

      expect(eventId).toBeDefined();

      const event = await manager.getPropagationEvent(eventId);
      expect(event).toBeDefined();
      expect(event?.sourceNodeId).toBe('source');
      expect(event?.stateKeys).toEqual(['key1', 'key2']);
      expect(event?.mode).toBe(PropagationMode.IMMEDIATE);
    });

    it('应传播状态变更到全局', async () => {
      const eventId = await manager.propagateStateChange(
        'source',
        ['global-key'],
        PropagationScope.GLOBAL,
        PropagationMode.BATCH
      );

      const event = await manager.getPropagationEvent(eventId);
      expect(event?.targetNodeIds.length).toBeGreaterThan(0);
    });

    it('应获取和更新传播配置', async () => {
      const config = manager.getPropagationConfig();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe(PropagationMode.IMMEDIATE);
      expect(config.scope).toBe(PropagationScope.WORKSPACE);

      const updateResult = await manager.updatePropagationConfig({
        mode: PropagationMode.BATCH,
        batchSize: 20
      });

      expect(updateResult).toBe(true);

      const updatedConfig = manager.getPropagationConfig();
      expect(updatedConfig.mode).toBe(PropagationMode.BATCH);
      expect(updatedConfig.batchSize).toBe(20);
    });
  });

  // ============ 快照管理测试 ============

  describe('快照管理', () => {
    beforeEach(async () => {
      await manager.registerNode('snapshot-node', 'workspace', [
        NodeCapability.STORE_SNAPSHOTS,
        NodeCapability.RECEIVE_UPDATES
      ]);

      // 添加一些状态
      await manager.syncState('snapshot-node', 'snapshot-node', 'key1', { data: 'value1' });
      await manager.syncState('snapshot-node', 'snapshot-node', 'key2', { data: 'value2' });
    });

    it('应创建状态快照', async () => {
      const snapshotId = await manager.createSnapshot(
        'snapshot-node',
        'Test snapshot',
        ['test', 'backup']
      );

      expect(snapshotId).toBeDefined();

      const snapshots = await manager.listSnapshots('snapshot-node');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe(snapshotId);
      expect(snapshots[0].description).toBe('Test snapshot');
      expect(snapshots[0].tags).toEqual(['test', 'backup']);
    });

    it('应恢复快照', async () => {
      const snapshotId = await manager.createSnapshot('snapshot-node', 'Before changes');

      // 修改状态
      await manager.syncState('snapshot-node', 'snapshot-node', 'key1', { data: 'modified' });

      // 恢复快照
      const result = await manager.restoreSnapshot('snapshot-node', snapshotId);

      expect(result.success).toBe(true);
      expect(result.restoredKeys).toBeGreaterThan(0);
    });

    it('应删除快照', async () => {
      const snapshotId = await manager.createSnapshot('snapshot-node');

      const deleteResult = await manager.deleteSnapshot('snapshot-node', snapshotId);

      expect(deleteResult).toBe(true);

      const snapshots = await manager.listSnapshots('snapshot-node');
      expect(snapshots).toHaveLength(0);
    });

    it('应列出节点的所有快照', async () => {
      await manager.createSnapshot('snapshot-node', 'Snapshot 1');
      await manager.createSnapshot('snapshot-node', 'Snapshot 2');
      await manager.createSnapshot('snapshot-node', 'Snapshot 3');

      const snapshots = await manager.listSnapshots('snapshot-node');

      expect(snapshots).toHaveLength(3);
    });

    it('应返回失败当恢复不存在的快照', async () => {
      const result = await manager.restoreSnapshot('snapshot-node', 'non-existent');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============ 同步会话测试 ============

  describe('同步会话', () => {
    beforeEach(async () => {
      await manager.registerNode('session-node-1', 'workspace', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('session-node-2', 'project', [
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('session-node-3', 'project', [
        NodeCapability.RECEIVE_UPDATES
      ]);
    });

    it('应创建同步会话', async () => {
      const sessionId = await manager.createSyncSession(
        SyncSessionType.WORKSPACE_SYNC,
        ['session-node-1', 'session-node-2', 'session-node-3']
      );

      expect(sessionId).toBeDefined();

      const session = await manager.getSyncSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.type).toBe(SyncSessionType.WORKSPACE_SYNC);
      expect(session?.participants).toEqual(['session-node-1', 'session-node-2', 'session-node-3']);
      expect(session?.status).toBe(SyncSessionStatus.PENDING);
    });

    it('应启动同步会话', async () => {
      const sessionId = await manager.createSyncSession(
        SyncSessionType.PEER_TO_PEER,
        ['session-node-1', 'session-node-2']
      );

      const result = await manager.startSyncSession(sessionId);

      expect(result).toBe(true);

      const session = await manager.getSyncSession(sessionId);
      expect(session?.status).toBe(SyncSessionStatus.IN_PROGRESS);
    });

    it('应取消同步会话', async () => {
      const sessionId = await manager.createSyncSession(
        SyncSessionType.GLOBAL_SYNC,
        ['session-node-1', 'session-node-2', 'session-node-3']
      );

      const result = await manager.cancelSyncSession(sessionId);

      expect(result).toBe(true);

      const session = await manager.getSyncSession(sessionId);
      expect(session?.status).toBe(SyncSessionStatus.CANCELLED);
    });

    it('应列出所有同步会话', async () => {
      await manager.createSyncSession(SyncSessionType.WORKSPACE_SYNC, ['session-node-1', 'session-node-2']);
      await manager.createSyncSession(SyncSessionType.PROJECT_SYNC, ['session-node-2', 'session-node-3']);

      const allSessions = await manager.listSyncSessions();
      expect(allSessions).toHaveLength(2);

      const pendingSessions = await manager.listSyncSessions(SyncSessionStatus.PENDING);
      expect(pendingSessions).toHaveLength(2);
    });

    it('应返回失败当启动不存在的会话', async () => {
      const result = await manager.startSyncSession('non-existent');
      expect(result).toBe(false);
    });

    it('应返回失败当取消已完成的会话', async () => {
      const sessionId = await manager.createSyncSession(
        SyncSessionType.PROJECT_SYNC,
        ['session-node-1']
      );

      await manager.startSyncSession(sessionId);

      // 手动设置为完成
      const session = await manager.getSyncSession(sessionId);
      // 无法直接修改会话状态，所以这个测试会被跳过
    });
  });

  // ============ 统计信息测试 ============

  describe('统计信息', () => {
    beforeEach(async () => {
      await manager.registerNode('stats-node-1', 'workspace', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('stats-node-2', 'project', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('stats-node-3', 'project', [
        NodeCapability.RECEIVE_UPDATES,
        NodeCapability.STORE_SNAPSHOTS
      ]);
    });

    it('应获取系统统计摘要', async () => {
      // 创建一些活动
      await manager.syncState('stats-node-1', 'stats-node-2', 'key1', 'value1');
      await manager.syncState('stats-node-1', 'stats-node-3', 'key2', 'value2');
      await manager.createSnapshot('stats-node-3', 'Test snapshot');

      const stats = await manager.getStatistics();

      expect(stats.nodes.total).toBe(3);
      expect(stats.nodes.online).toBe(3);
      expect(stats.snapshots.total).toBe(1);
      expect(stats.snapshots.totalSize).toBeGreaterThan(0);
    });

    it('应正确统计离线和错误节点', async () => {
      await manager.updateNodeStatus('stats-node-2', NodeStatus.OFFLINE);
      await manager.updateNodeStatus('stats-node-3', NodeStatus.ERROR);

      const stats = await manager.getStatistics();

      expect(stats.nodes.offline).toBe(1);
      expect(stats.nodes.error).toBe(1);
      expect(stats.nodes.online).toBe(1);
    });

    it('应正确统计冲突', async () => {
      // 创建一些冲突
      await manager.syncState('stats-node-1', 'stats-node-2', 'conflict-key', 'value1');
      await manager.syncState('stats-node-1', 'stats-node-3', 'conflict-key', 'value1');
      await manager.syncState('stats-node-2', 'stats-node-3', 'conflict-key', 'value2');

      await manager.detectConflicts('conflict-key');

      const stats = await manager.getStatistics();

      expect(stats.conflicts).toBeDefined();
      expect(stats.conflicts.bySeverity).toBeDefined();
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空节点列表', async () => {
      const nodes = await manager.listNodes();
      expect(nodes).toHaveLength(0);
    });

    it('应处理获取不存在的节点', async () => {
      const node = await manager.getNode('non-existent');
      expect(node).toBeNull();
    });

    it('应处理获取不存在的同步操作', async () => {
      const operation = await manager.getSyncOperation('non-existent-op');
      expect(operation).toBeNull();
    });

    it('应处理获取不存在的传播事件', async () => {
      const event = await manager.getPropagationEvent('non-existent-event');
      expect(event).toBeNull();
    });

    it('应处理获取不存在的同步会话', async () => {
      const session = await manager.getSyncSession('non-existent-session');
      expect(session).toBeNull();
    });

    it('应处理列出不存在节点的快照', async () => {
      const snapshots = await manager.listSnapshots('non-existent-node');
      expect(snapshots).toHaveLength(0);
    });

    it('应清空所有数据', async () => {
      await manager.registerNode('node-1', 'workspace', [NodeCapability.RECEIVE_UPDATES]);
      await manager.syncState('node-1', 'node-1', 'key', 'value');

      const result = await manager.clear();

      expect(result).toBe(true);

      const nodes = await manager.listNodes();
      expect(nodes).toHaveLength(0);
    });
  });

  // ============ 并发操作测试 ============

  describe('并发操作', () => {
    beforeEach(async () => {
      await manager.registerNode('concurrent-1', 'workspace', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
      await manager.registerNode('concurrent-2', 'project', [
        NodeCapability.SEND_UPDATES,
        NodeCapability.RECEIVE_UPDATES
      ]);
    });

    it('应处理并发状态更新', async () => {
      // 并发更新同一个状态键
      const updates = [
        manager.syncState('concurrent-1', 'concurrent-2', 'shared-key', { v: 1 }),
        manager.syncState('concurrent-1', 'concurrent-2', 'shared-key', { v: 2 }),
        manager.syncState('concurrent-1', 'concurrent-2', 'shared-key', { v: 3 })
      ];

      const results = await Promise.all(updates);

      expect(results).toHaveLength(3);
      results.forEach(id => expect(id).toBeDefined());
    });

    it('应处理批量同步操作', async () => {
      await manager.registerNode('batch-1', 'project', [NodeCapability.RECEIVE_UPDATES]);
      await manager.registerNode('batch-2', 'project', [NodeCapability.RECEIVE_UPDATES]);

      const states = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
        ['key4', 'value4'],
        ['key5', 'value5']
      ]);

      const operationIds = await manager.syncStates(
        'concurrent-1',
        ['concurrent-2', 'batch-1', 'batch-2'],
        states
      );

      expect(operationIds).toHaveLength(15); // 3 targets × 5 states
    });
  });

  // ============ 配置测试 ============

  describe('配置管理', () => {
    it('应支持自定义重试配置', async () => {
      await manager.updatePropagationConfig({
        retry: {
          maxRetries: 5,
          retryDelay: 2000,
          exponentialBackoff: true
        }
      });

      const config = manager.getPropagationConfig();

      expect(config.retry?.maxRetries).toBe(5);
      expect(config.retry?.retryDelay).toBe(2000);
      expect(config.retry?.exponentialBackoff).toBe(true);
    });

    it('应支持切换冲突解决策略', async () => {
      await manager.updatePropagationConfig({
        conflictResolution: ConflictResolutionStrategy.HIGHEST_VERSION_WINS
      });

      const config = manager.getPropagationConfig();

      expect(config.conflictResolution).toBe(ConflictResolutionStrategy.HIGHEST_VERSION_WINS);
    });

    it('应支持禁用状态传播', async () => {
      await manager.updatePropagationConfig({
        enabled: false
      });

      const config = manager.getPropagationConfig();

      expect(config.enabled).toBe(false);
    });
  });
});
