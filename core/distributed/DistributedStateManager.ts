/**
 * DevFlow v5 - 分布式状态管理器实现
 *
 * 职责：跨项目状态同步、冲突解决、状态传播
 *
 * SOLID 原则：
 * - 单一职责：仅负责分布式状态的管理和同步
 * - 依赖倒置：实现 IDistributedStateManager 接口
 */

import type {
  IDistributedStateManager
} from './IDistributedStateManager';
import type {
  StateNode,
  StateVersion,
  StateSyncOperation,
  StateConflict,
  StatePropagationConfig,
  StatePropagationEvent,
  StateSnapshot,
  SnapshotRestoreResult,
  SyncSession
} from './types';
import {
  NodeStatus,
  NodeCapability,
  SyncOperationType,
  SyncOperationStatus,
  ConflictType,
  ConflictSeverity,
  ConflictResolutionStrategy,
  ConflictResolutionStatus,
  PropagationMode,
  PropagationScope,
  PropagationStatus,
  SyncSessionType,
  SyncSessionStatus
} from './types';

// ============ 默认配置 ============

const DEFAULT_PROPAGATION_CONFIG: StatePropagationConfig = {
  enabled: true,
  mode: PropagationMode.IMMEDIATE,
  scope: PropagationScope.WORKSPACE,
  propagationDelay: 100,
  batchSize: 10,
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  },
  conflictResolution: ConflictResolutionStrategy.LAST_WRITE_WINS
};

// ============ 辅助类型 ============

/**
 * 节点状态存储
 */
interface NodeStorage {
  node: StateNode;
  states: Map<string, any>; // 状态键 -> 状态数据
  versions: Map<string, StateVersion>; // 状态键 -> 版本信息
}

/**
 * 冲突检测器
 */
class ConflictDetector {
  /**
   * 检测两个版本之间是否存在冲突
   */
  static detectConflict(
    key: string,
    version1: StateVersion,
    data1: any,
    version2: StateVersion,
    data2: any
  ): StateConflict | null {
    // 检查版本是否分叉
    if (version1.parentVersionId !== version2.parentVersionId &&
        version1.version !== version2.version) {
      return {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        stateKey: key,
        conflictingVersions: [
          { nodeId: version1.nodeId, version: version1, stateData: data1 },
          { nodeId: version2.nodeId, version: version2, stateData: data2 }
        ],
        detectedAt: new Date().toISOString(),
        conflictType: ConflictType.VERSION_CONFLICT,
        severity: ConflictSeverity.MEDIUM,
        resolutionStatus: ConflictResolutionStatus.PENDING
      };
    }

    // 检查值冲突（同一版本的不同值）
    if (version1.version === version2.version && JSON.stringify(data1) !== JSON.stringify(data2)) {
      return {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        stateKey: key,
        conflictingVersions: [
          { nodeId: version1.nodeId, version: version1, stateData: data1 },
          { nodeId: version2.nodeId, version: version2, stateData: data2 }
        ],
        detectedAt: new Date().toISOString(),
        conflictType: ConflictType.VALUE_CONFLICT,
        severity: ConflictSeverity.LOW,
        resolutionStatus: ConflictResolutionStatus.PENDING
      };
    }

    return null;
  }

  /**
   * 检测并发修改冲突
   */
  static detectConcurrentConflict(
    key: string,
    existingNode: StateNode,
    existingVersion: StateVersion,
    existingData: any,
    newNode: StateNode,
    newVersion: StateVersion,
    newData: any
  ): StateConflict | null {
    // 如果时间戳接近（5秒内），认为是并发修改
    const timeDiff = Math.abs(
      new Date(existingVersion.timestamp).getTime() -
      new Date(newVersion.timestamp).getTime()
    );

    if (timeDiff < 5000 && JSON.stringify(existingData) !== JSON.stringify(newData)) {
      return {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        stateKey: key,
        conflictingVersions: [
          { nodeId: existingNode.nodeId, version: existingVersion, stateData: existingData },
          { nodeId: newNode.nodeId, version: newVersion, stateData: newData }
        ],
        detectedAt: new Date().toISOString(),
        conflictType: ConflictType.CONCURRENT_CONFLICT,
        severity: ConflictSeverity.HIGH,
        resolutionStatus: ConflictResolutionStatus.PENDING
      };
    }

    return null;
  }
}

// ============ DistributedStateManager 实现 ============

/**
 * 分布式状态管理器实现
 *
 * 功能：
 * - 节点注册和管理
 * - 状态同步和传播
 * - 冲突检测和解决
 * - 快照管理
 * - 同步会话管理
 */
export class DistributedStateManager implements IDistributedStateManager {
  // 节点存储
  private nodes: Map<string, NodeStorage> = new Map();

  // 同步操作存储
  private syncOperations: Map<string, StateSyncOperation> = new Map();
  private pendingOperations: Map<string, Set<string>> = new Map(); // 节点ID -> 操作ID集合

  // 冲突存储
  private conflicts: Map<string, StateConflict> = new Map();

  // 传播事件存储
  private propagationEvents: Map<string, StatePropagationEvent> = new Map();

  // 快照存储
  private snapshots: Map<string, Map<string, StateSnapshot>> = new Map(); // 节点ID -> 快照映射

  // 同步会话存储
  private syncSessions: Map<string, SyncSession> = new Map();

  // 传播配置
  private propagationConfig: StatePropagationConfig = { ...DEFAULT_PROPAGATION_CONFIG };

  // 操作计数器（用于生成ID）
  private operationCounter = 0;
  private sessionCounter = 0;

  // ============ 节点管理 ============

  /**
   * 注册节点
   */
  async registerNode(
    nodeId: string,
    nodeType: 'workspace' | 'project' | 'global',
    capabilities: NodeCapability[]
  ): Promise<boolean> {
    if (this.nodes.has(nodeId)) {
      return false; // 节点已存在
    }

    const node: StateNode = {
      nodeId,
      nodeType,
      status: NodeStatus.ONLINE,
      lastSeen: new Date().toISOString(),
      capabilities
    };

    this.nodes.set(nodeId, {
      node,
      states: new Map(),
      versions: new Map()
    });

    this.pendingOperations.set(nodeId, new Set());

    return true;
  }

  /**
   * 注销节点
   */
  async unregisterNode(nodeId: string): Promise<boolean> {
    const nodeStorage = this.nodes.get(nodeId);
    if (!nodeStorage) {
      return false;
    }

    // 取消所有待处理的同步操作
    const pendingOps = this.pendingOperations.get(nodeId) || new Set();
    for (const opId of pendingOps) {
      const op = this.syncOperations.get(opId);
      if (op && op.status === SyncOperationStatus.PENDING) {
        op.status = SyncOperationStatus.CANCELLED;
      }
    }

    this.nodes.delete(nodeId);
    this.pendingOperations.delete(nodeId);

    return true;
  }

  /**
   * 更新节点状态
   */
  async updateNodeStatus(nodeId: string, status: NodeStatus): Promise<boolean> {
    const nodeStorage = this.nodes.get(nodeId);
    if (!nodeStorage) {
      return false;
    }

    nodeStorage.node.status = status;
    nodeStorage.node.lastSeen = new Date().toISOString();

    return true;
  }

  /**
   * 获取节点信息
   */
  async getNode(nodeId: string): Promise<StateNode | null> {
    const nodeStorage = this.nodes.get(nodeId);
    return nodeStorage ? { ...nodeStorage.node } : null;
  }

  /**
   * 列出所有节点
   */
  async listNodes(): Promise<StateNode[]> {
    return Array.from(this.nodes.values()).map(ns => ({ ...ns.node }));
  }

  // ============ 状态同步 ============

  /**
   * 同步状态到目标节点
   */
  async syncState(
    sourceNodeId: string,
    targetNodeId: string,
    stateKey: string,
    stateData: any,
    priority = 0
  ): Promise<string> {
    const sourceNode = this.nodes.get(sourceNodeId);
    const targetNode = this.nodes.get(targetNodeId);

    if (!sourceNode || !targetNode) {
      throw new Error('Source or target node not found');
    }

    if (targetNode.node.status !== NodeStatus.ONLINE) {
      throw new Error('Target node is not online');
    }

    // 创建版本信息
    const currentVersion = sourceNode.versions.get(stateKey);
    const versionId = this.generateVersionId();
    const newVersion: StateVersion = {
      id: versionId,
      version: currentVersion ? currentVersion.version + 1 : 1,
      timestamp: new Date().toISOString(),
      nodeId: sourceNodeId,
      summary: `Update ${stateKey}`,
      parentVersionId: currentVersion?.id
    };

    // 创建同步操作
    const operationId = this.generateOperationId();
    const operation: StateSyncOperation = {
      id: operationId,
      type: SyncOperationType.UPDATE,
      sourceNodeId,
      targetNodeId,
      stateKey,
      stateData,
      version: newVersion,
      priority,
      timestamp: new Date().toISOString(),
      status: SyncOperationStatus.PENDING,
      retryCount: 0
    };

    this.syncOperations.set(operationId, operation);
    this.pendingOperations.get(targetNodeId)!.add(operationId);

    // 执行同步
    await this.executeSyncOperation(operation);

    return operationId;
  }

  /**
   * 批量同步状态
   */
  async syncStates(
    sourceNodeId: string,
    targetNodeIds: string[],
    states: Map<string, any>,
    priority = 0
  ): Promise<string[]> {
    const operationIds: string[] = [];

    for (const targetNodeId of targetNodeIds) {
      for (const [stateKey, stateData] of states.entries()) {
        const opId = await this.syncState(sourceNodeId, targetNodeId, stateKey, stateData, priority);
        operationIds.push(opId);
      }
    }

    return operationIds;
  }

  /**
   * 查询同步操作状态
   */
  async getSyncOperation(operationId: string): Promise<StateSyncOperation | null> {
    const op = this.syncOperations.get(operationId);
    return op ? { ...op } : null;
  }

  /**
   * 获取节点的待处理同步操作
   */
  async getPendingSyncOperations(nodeId: string): Promise<StateSyncOperation[]> {
    const pendingOpIds = this.pendingOperations.get(nodeId) || new Set();
    const operations: StateSyncOperation[] = [];

    for (const opId of pendingOpIds) {
      const op = this.syncOperations.get(opId);
      if (op && op.status === SyncOperationStatus.PENDING) {
        operations.push({ ...op });
      }
    }

    return operations.sort((a, b) => b.priority - a.priority);
  }

  // ============ 冲突管理 ============

  /**
   * 检测状态冲突
   */
  async detectConflicts(stateKey: string, nodeIds?: string[]): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    const nodesToCheck = nodeIds || Array.from(this.nodes.keys());

    // 获取所有拥有此状态的节点
    const nodesWithData: Array<{ nodeId: string; storage: NodeStorage }> = [];
    for (const nodeId of nodesToCheck) {
      const storage = this.nodes.get(nodeId);
      if (storage && storage.states.has(stateKey)) {
        nodesWithData.push({ nodeId, storage });
      }
    }

    // 检测两两之间的冲突
    for (let i = 0; i < nodesWithData.length; i++) {
      for (let j = i + 1; j < nodesWithData.length; j++) {
        const node1 = nodesWithData[i];
        const node2 = nodesWithData[j];

        const version1 = node1.storage.versions.get(stateKey)!;
        const version2 = node2.storage.versions.get(stateKey)!;
        const data1 = node1.storage.states.get(stateKey);
        const data2 = node2.storage.states.get(stateKey);

        const conflict = ConflictDetector.detectConflict(
          stateKey,
          version1,
          data1,
          version2,
          data2
        );

        if (conflict) {
          this.conflicts.set(conflict.id, conflict);
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    resolutionStrategy: ConflictResolutionStrategy,
    resolvedData?: any
  ): Promise<boolean> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      return false;
    }

    conflict.resolutionStrategy = resolutionStrategy;
    conflict.resolutionStatus = ConflictResolutionStatus.RESOLVING;

    try {
      let finalData: any;
      let finalVersion: StateVersion;

      switch (resolutionStrategy) {
        case ConflictResolutionStrategy.LAST_WRITE_WINS: {
          // 选择最新的时间戳
          const latest = conflict.conflictingVersions
            .sort((a, b) =>
              new Date(b.version.timestamp).getTime() - new Date(a.version.timestamp).getTime()
            )[0];
          finalData = latest.stateData;
          finalVersion = latest.version;
          break;
        }

        case ConflictResolutionStrategy.FIRST_WRITE_WINS: {
          const earliest = conflict.conflictingVersions
            .sort((a, b) =>
              new Date(a.version.timestamp).getTime() - new Date(b.version.timestamp).getTime()
            )[0];
          finalData = earliest.stateData;
          finalVersion = earliest.version;
          break;
        }

        case ConflictResolutionStrategy.HIGHEST_VERSION_WINS: {
          const highest = conflict.conflictingVersions
            .sort((a, b) => b.version.version - a.version.version)[0];
          finalData = highest.stateData;
          finalVersion = highest.version;
          break;
        }

        case ConflictResolutionStrategy.MANUAL:
        case ConflictResolutionStrategy.CUSTOM: {
          if (resolvedData === undefined) {
            conflict.resolutionStatus = ConflictResolutionStatus.FAILED;
            return false;
          }
          finalData = resolvedData;
          finalVersion = {
            id: this.generateVersionId(),
            version: Math.max(...conflict.conflictingVersions.map(v => v.version.version)) + 1,
            timestamp: new Date().toISOString(),
            nodeId: 'system',
            summary: `Resolved conflict for ${conflict.stateKey}`
          };
          break;
        }

        default: {
          conflict.resolutionStatus = ConflictResolutionStatus.FAILED;
          return false;
        }
      }

      // 应用解决方案到所有涉及的节点
      for (const { nodeId } of conflict.conflictingVersions) {
        const storage = this.nodes.get(nodeId);
        if (storage) {
          storage.states.set(conflict.stateKey, finalData);
          storage.versions.set(conflict.stateKey, finalVersion);
        }
      }

      conflict.resolvedVersion = finalVersion;
      conflict.resolutionStatus = ConflictResolutionStatus.RESOLVED;

      return true;
    } catch (error) {
      conflict.resolutionStatus = ConflictResolutionStatus.FAILED;
      return false;
    }
  }

  /**
   * 获取未解决的冲突
   */
  async getUnresolvedConflicts(severity?: ConflictSeverity): Promise<StateConflict[]> {
    const conflicts = Array.from(this.conflicts.values())
      .filter(c => c.resolutionStatus === ConflictResolutionStatus.PENDING);

    if (severity) {
      return conflicts.filter(c => c.severity === severity);
    }

    return conflicts;
  }

  // ============ 状态传播 ============

  /**
   * 传播状态变更
   */
  async propagateStateChange(
    sourceNodeId: string,
    stateKeys: string[],
    scope: PropagationScope,
    mode: PropagationMode
  ): Promise<string> {
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode) {
      throw new Error('Source node not found');
    }

    // 确定目标节点
    let targetNodeIds: string[] = [];

    switch (scope) {
      case PropagationScope.GLOBAL: {
        targetNodeIds = Array.from(this.nodes.keys()).filter(id => id !== sourceNodeId);
        break;
      }

      case PropagationScope.WORKSPACE: {
        // 同一工作区的所有项目节点
        targetNodeIds = Array.from(this.nodes.entries())
          .filter(([id, storage]) =>
            id !== sourceNodeId &&
            storage.node.nodeType === 'project'
          )
          .map(([id]) => id);
        break;
      }

      case PropagationScope.PROJECT: {
        // 仅限项目内（不传播）
        targetNodeIds = [];
        break;
      }

      case PropagationScope.CUSTOM: {
        // 自定义目标需要额外参数，这里简化处理
        targetNodeIds = [];
        break;
      }
    }

    // 创建传播事件
    const eventId = this.generateEventId();
    const event: StatePropagationEvent = {
      id: eventId,
      sourceNodeId,
      targetNodeIds,
      stateKeys,
      mode,
      timestamp: new Date().toISOString(),
      status: PropagationStatus.PENDING,
      statistics: {
        totalTargets: targetNodeIds.length,
        successCount: 0,
        failureCount: 0,
        pendingCount: targetNodeIds.length,
        conflictCount: 0,
        startTime: new Date().toISOString()
      }
    };

    this.propagationEvents.set(eventId, event);

    // 执行传播
    await this.executePropagation(event, sourceNode);

    return eventId;
  }

  /**
   * 获取传播事件状态
   */
  async getPropagationEvent(eventId: string): Promise<StatePropagationEvent | null> {
    const event = this.propagationEvents.get(eventId);
    return event ? { ...event } : null;
  }

  /**
   * 获取传播配置
   */
  getPropagationConfig(): StatePropagationConfig {
    return { ...this.propagationConfig };
  }

  /**
   * 更新传播配置
   */
  async updatePropagationConfig(config: Partial<StatePropagationConfig>): Promise<boolean> {
    this.propagationConfig = { ...this.propagationConfig, ...config };
    return true;
  }

  // ============ 快照管理 ============

  /**
   * 创建状态快照
   */
  async createSnapshot(
    nodeId: string,
    description?: string,
    tags?: string[]
  ): Promise<string> {
    const nodeStorage = this.nodes.get(nodeId);
    if (!nodeStorage) {
      throw new Error('Node not found');
    }

    const snapshotId = this.generateSnapshotId();
    const versionId = this.generateVersionId();
    const states = new Map<string, any>(nodeStorage.states);
    const checksum = this.calculateChecksum(states);

    const snapshot: StateSnapshot = {
      id: snapshotId,
      nodeId,
      timestamp: new Date().toISOString(),
      version: {
        id: versionId,
        version: Date.now(),
        timestamp: new Date().toISOString(),
        nodeId,
        summary: description || 'Snapshot'
      },
      states,
      checksum,
      size: JSON.stringify(Array.from(states.entries())).length,
      description,
      tags
    };

    if (!this.snapshots.has(nodeId)) {
      this.snapshots.set(nodeId, new Map());
    }

    this.snapshots.get(nodeId)!.set(snapshotId, snapshot);

    return snapshotId;
  }

  /**
   * 恢复快照
   */
  async restoreSnapshot(
    nodeId: string,
    snapshotId: string
  ): Promise<SnapshotRestoreResult> {
    const nodeStorage = this.nodes.get(nodeId);
    if (!nodeStorage) {
      return {
        success: false,
        restoredKeys: 0,
        skippedKeys: 0,
        failedKeys: 0,
        errors: [{ key: 'node', error: 'Node not found' }]
      };
    }

    const snapshots = this.snapshots.get(nodeId);
    if (!snapshots) {
      return {
        success: false,
        restoredKeys: 0,
        skippedKeys: 0,
        failedKeys: 0,
        errors: [{ key: 'node', error: 'No snapshots found for node' }]
      };
    }

    const snapshot = snapshots.get(snapshotId);
    if (!snapshot) {
      return {
        success: false,
        restoredKeys: 0,
        skippedKeys: 0,
        failedKeys: 0,
        errors: [{ key: snapshotId, error: 'Snapshot not found' }]
      };
    }

    let restoredKeys = 0;
    let skippedKeys = 0;
    let failedKeys = 0;
    const errors: Array<{ key: string; error: string }> = [];

    // 恢复每个状态
    for (const [key, value] of snapshot.states.entries()) {
      try {
        nodeStorage.states.set(key, value);
        restoredKeys++;
      } catch (error) {
        failedKeys++;
        errors.push({
          key,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 恢复版本信息
    for (const [key, version] of snapshot.states.entries()) {
      if (snapshot.version) {
        nodeStorage.versions.set(key, snapshot.version);
      } else {
        skippedKeys++;
      }
    }

    return {
      success: failedKeys === 0,
      restoredKeys,
      skippedKeys,
      failedKeys,
      errors
    };
  }

  /**
   * 列出节点的快照
   */
  async listSnapshots(nodeId: string): Promise<StateSnapshot[]> {
    const snapshots = this.snapshots.get(nodeId);
    if (!snapshots) {
      return [];
    }

    return Array.from(snapshots.values());
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(nodeId: string, snapshotId: string): Promise<boolean> {
    const snapshots = this.snapshots.get(nodeId);
    if (!snapshots) {
      return false;
    }

    return snapshots.delete(snapshotId);
  }

  // ============ 同步会话 ============

  /**
   * 创建同步会话
   */
  async createSyncSession(
    type: SyncSessionType,
    participants: string[],
    config?: StatePropagationConfig
  ): Promise<string> {
    const sessionId = this.generateSessionId();

    const session: SyncSession = {
      id: sessionId,
      type,
      participants,
      status: SyncSessionStatus.PENDING,
      createdAt: new Date().toISOString(),
      config: config || this.propagationConfig
    };

    this.syncSessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * 启动同步会话
   */
  async startSyncSession(sessionId: string): Promise<boolean> {
    const session = this.syncSessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.status !== SyncSessionStatus.PENDING) {
      return false;
    }

    session.status = SyncSessionStatus.IN_PROGRESS;
    session.startedAt = new Date().toISOString();

    // 创建传播事件并执行
    try {
      const sourceNodeId = session.participants[0];
      const targetNodeIds = session.participants.slice(1);

      const eventId = await this.propagateStateChange(
        sourceNodeId,
        [], // 空数组表示所有状态
        this.getScopeFromSessionType(session.type),
        session.config?.mode || PropagationMode.IMMEDIATE
      );

      session.propagationEventId = eventId;

      return true;
    } catch (error) {
      session.status = SyncSessionStatus.FAILED;
      return false;
    }
  }

  /**
   * 获取同步会话状态
   */
  async getSyncSession(sessionId: string): Promise<SyncSession | null> {
    const session = this.syncSessions.get(sessionId);
    return session ? { ...session } : null;
  }

  /**
   * 列出同步会话
   */
  async listSyncSessions(status?: SyncSessionStatus): Promise<SyncSession[]> {
    let sessions = Array.from(this.syncSessions.values());

    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }

    return sessions.map(s => ({ ...s }));
  }

  /**
   * 取消同步会话
   */
  async cancelSyncSession(sessionId: string): Promise<boolean> {
    const session = this.syncSessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.status === SyncSessionStatus.COMPLETED ||
        session.status === SyncSessionStatus.CANCELLED) {
      return false;
    }

    session.status = SyncSessionStatus.CANCELLED;

    // 取消关联的传播事件
    if (session.propagationEventId) {
      const event = this.propagationEvents.get(session.propagationEventId);
      if (event && event.status === PropagationStatus.IN_PROGRESS) {
        event.status = PropagationStatus.CANCELLED;
      }
    }

    return true;
  }

  // ============ 统计信息 ============

  /**
   * 获取系统统计摘要
   */
  async getStatistics(): Promise<{
    nodes: {
      total: number;
      online: number;
      offline: number;
      error: number;
    };
    syncOperations: {
      pending: number;
      inProgress: number;
      todaySuccess: number;
      todayFailure: number;
    };
    conflicts: {
      unresolved: number;
      todayResolved: number;
      bySeverity: Record<string, number>;
    };
    snapshots: {
      total: number;
      totalSize: number;
    };
  }> {
    const nodes = Array.from(this.nodes.values());
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // 节点统计
    const nodeStats = {
      total: nodes.length,
      online: nodes.filter(n => n.node.status === NodeStatus.ONLINE).length,
      offline: nodes.filter(n => n.node.status === NodeStatus.OFFLINE).length,
      error: nodes.filter(n => n.node.status === NodeStatus.ERROR).length
    };

    // 同步操作统计
    const allOperations = Array.from(this.syncOperations.values());
    const todayOps = allOperations.filter(op => op.timestamp >= todayStart);
    const syncStats = {
      pending: allOperations.filter(op => op.status === SyncOperationStatus.PENDING).length,
      inProgress: allOperations.filter(op => op.status === SyncOperationStatus.IN_PROGRESS).length,
      todaySuccess: todayOps.filter(op => op.status === SyncOperationStatus.SUCCESS).length,
      todayFailure: todayOps.filter(op => op.status === SyncOperationStatus.FAILED).length
    };

    // 冲突统计
    const allConflicts = Array.from(this.conflicts.values());
    const resolvedConflicts = allConflicts.filter(c =>
      c.resolutionStatus === ConflictResolutionStatus.RESOLVED &&
      c.resolvedVersion &&
      c.resolvedVersion.timestamp >= todayStart
    );
    const conflictStats = {
      unresolved: allConflicts.filter(c => c.resolutionStatus === ConflictResolutionStatus.PENDING).length,
      todayResolved: resolvedConflicts.length,
      bySeverity: {
        low: allConflicts.filter(c => c.severity === ConflictSeverity.LOW).length,
        medium: allConflicts.filter(c => c.severity === ConflictSeverity.MEDIUM).length,
        high: allConflicts.filter(c => c.severity === ConflictSeverity.HIGH).length,
        critical: allConflicts.filter(c => c.severity === ConflictSeverity.CRITICAL).length
      }
    };

    // 快照统计
    let totalSnapshots = 0;
    let totalSize = 0;
    for (const snapshots of this.snapshots.values()) {
      for (const snapshot of snapshots.values()) {
        totalSnapshots++;
        totalSize += snapshot.size;
      }
    }

    return {
      nodes: nodeStats,
      syncOperations: syncStats,
      conflicts: conflictStats,
      snapshots: {
        total: totalSnapshots,
        totalSize
      }
    };
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<boolean> {
    this.nodes.clear();
    this.syncOperations.clear();
    this.pendingOperations.clear();
    this.conflicts.clear();
    this.propagationEvents.clear();
    this.snapshots.clear();
    this.syncSessions.clear();
    this.operationCounter = 0;
    this.sessionCounter = 0;
    return true;
  }

  // ============ 私有辅助方法 ============

  /**
   * 执行同步操作
   */
  private async executeSyncOperation(operation: StateSyncOperation): Promise<void> {
    operation.status = SyncOperationStatus.IN_PROGRESS;

    try {
      const targetStorage = this.nodes.get(operation.targetNodeId);
      if (!targetStorage) {
        throw new Error('Target node not found');
      }

      // 检测并发冲突
      const existingData = targetStorage.states.get(operation.stateKey);
      const existingVersion = targetStorage.versions.get(operation.stateKey);

      if (existingData && existingVersion) {
        const conflict = ConflictDetector.detectConcurrentConflict(
          operation.stateKey,
          this.nodes.get(operation.sourceNodeId)!.node,
          operation.version,
          operation.stateData,
          targetStorage.node,
          existingVersion,
          existingData
        );

        if (conflict) {
          this.conflicts.set(conflict.id, conflict);
          operation.status = SyncOperationStatus.CONFLICT;
          this.pendingOperations.get(operation.targetNodeId)!.delete(operation.id);
          return;
        }
      }

      // 应用状态更新
      targetStorage.states.set(operation.stateKey, operation.stateData);
      targetStorage.versions.set(operation.stateKey, operation.version);

      operation.status = SyncOperationStatus.SUCCESS;
      this.pendingOperations.get(operation.targetNodeId)!.delete(operation.id);
    } catch (error) {
      operation.status = SyncOperationStatus.FAILED;
      operation.error = error instanceof Error ? error.message : String(error);
      operation.retryCount++;

      // 重试逻辑
      if (operation.retryCount < (this.propagationConfig.retry?.maxRetries || 3)) {
        setTimeout(() => {
          this.executeSyncOperation(operation);
        }, this.propagationConfig.retry?.retryDelay || 1000);
      }
    }
  }

  /**
   * 执行传播事件
   */
  private async executePropagation(
    event: StatePropagationEvent,
    sourceStorage: NodeStorage
  ): Promise<void> {
    event.status = PropagationStatus.IN_PROGRESS;

    let successCount = 0;
    let failureCount = 0;
    let conflictCount = 0;

    for (const targetNodeId of event.targetNodeIds) {
      try {
        const targetStorage = this.nodes.get(targetNodeId);
        if (!targetStorage) {
          failureCount++;
          continue;
        }

        // 如果指定了状态键，只同步这些键
        const stateKeys = event.stateKeys.length > 0
          ? event.stateKeys
          : Array.from(sourceStorage.states.keys());

        for (const stateKey of stateKeys) {
          const stateData = sourceStorage.states.get(stateKey);
          if (stateData !== undefined) {
            await this.syncState(
              event.sourceNodeId,
              targetNodeId,
              stateKey,
              stateData,
              0 // 优先级为0
            );
          }
        }

        successCount++;
      } catch (error) {
        failureCount++;
      }
    }

    event.statistics.successCount = successCount;
    event.statistics.failureCount = failureCount;
    event.statistics.conflictCount = conflictCount;
    event.statistics.pendingCount = 0;
    event.statistics.endTime = new Date().toISOString();

    if (failureCount === 0) {
      event.status = PropagationStatus.SUCCESS;
    } else if (successCount > 0) {
      event.status = PropagationStatus.PARTIAL;
    } else {
      event.status = PropagationStatus.FAILED;
    }
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `sync-${Date.now()}-${++this.operationCounter}`;
  }

  /**
   * 生成版本ID
   */
  private generateVersionId(): string {
    return `ver-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `prop-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 生成快照ID
   */
  private generateSnapshotId(): string {
    return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${++this.sessionCounter}`;
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(states: Map<string, any>): string {
    // 简化的校验和计算
    const data = JSON.stringify(Array.from(states.entries()));
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 从会话类型获取传播范围
   */
  private getScopeFromSessionType(type: SyncSessionType): PropagationScope {
    switch (type) {
      case SyncSessionType.GLOBAL_SYNC:
        return PropagationScope.GLOBAL;
      case SyncSessionType.WORKSPACE_SYNC:
        return PropagationScope.WORKSPACE;
      case SyncSessionType.PROJECT_SYNC:
        return PropagationScope.PROJECT;
      case SyncSessionType.PEER_TO_PEER:
        return PropagationScope.CUSTOM;
      default:
        return PropagationScope.WORKSPACE;
    }
  }
}
