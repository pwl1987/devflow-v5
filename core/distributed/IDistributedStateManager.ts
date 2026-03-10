/**
 * DevFlow v5 - 分布式状态管理器接口
 *
 * 职责：定义跨项目状态同步、冲突解决、状态传播的标准接口
 */

import type {
  StateNode,
  StateVersion,
  StateSyncOperation,
  StateConflict,
  StatePropagationConfig,
  StatePropagationEvent,
  StateSnapshot,
  SnapshotRestoreResult,
  SyncSession,
  NodeStatus,
  SyncOperationType,
  SyncOperationStatus,
  ConflictResolutionStrategy,
  ConflictResolutionStatus,
  PropagationMode,
  PropagationScope,
  SyncSessionType,
  SyncSessionStatus
} from './types';

// ============ IDistributedStateManager 接口 ============

/**
 * 分布式状态管理器接口
 *
 * 功能：
 * - 状态同步管理
 * - 冲突检测和解决
 * - 状态传播
 * - 快照管理
 */
export interface IDistributedStateManager {
  // ============ 节点管理 ============

  /**
   * 注册节点
   * @param nodeId 节点ID
   * @param nodeType 节点类型
   * @param capabilities 节点能力
   * @returns 是否成功
   */
  registerNode(
    nodeId: string,
    nodeType: 'workspace' | 'project' | 'global',
    capabilities: NodeCapability[]
  ): Promise<boolean>;

  /**
   * 注销节点
   * @param nodeId 节点ID
   * @returns 是否成功
   */
  unregisterNode(nodeId: string): Promise<boolean>;

  /**
   * 更新节点状态
   * @param nodeId 节点ID
   * @param status 节点状态
   * @returns 是否成功
   */
  updateNodeStatus(nodeId: string, status: NodeStatus): Promise<boolean>;

  /**
   * 获取节点信息
   * @param nodeId 节点ID
   * @returns 节点信息，不存在时返回null
   */
  getNode(nodeId: string): Promise<StateNode | null>;

  /**
   * 列出所有节点
   * @returns 节点列表
   */
  listNodes(): Promise<StateNode[]>;

  // ============ 状态同步 ============

  /**
   * 同步状态到目标节点
   * @param sourceNodeId 源节点ID
   * @param targetNodeId 目标节点ID
   * @param stateKey 状态键
   * @param stateData 状态数据
   * @param priority 优先级（可选）
   * @returns 同步操作ID
   */
  syncState(
    sourceNodeId: string,
    targetNodeId: string,
    stateKey: string,
    stateData: any,
    priority?: number
  ): Promise<string>;

  /**
   * 批量同步状态
   * @param sourceNodeId 源节点ID
   * @param targetNodeIds 目标节点ID列表
   * @param states 状态映射
   * @param priority 优先级（可选）
   * @returns 同步操作ID列表
   */
  syncStates(
    sourceNodeId: string,
    targetNodeIds: string[],
    states: Map<string, any>,
    priority?: number
  ): Promise<string[]>;

  /**
   * 查询同步操作状态
   * @param operationId 操作ID
   * @returns 同步操作
   */
  getSyncOperation(operationId: string): Promise<StateSyncOperation | null>;

  /**
   * 获取节点的待处理同步操作
   * @param nodeId 节点ID
   * @returns 同步操作列表
   */
  getPendingSyncOperations(nodeId: string): Promise<StateSyncOperation[]>;

  // ============ 冲突管理 ============

  /**
   * 检测状态冲突
   * @param stateKey 状态键
   * @param nodeIds 节点ID列表（可选，不指定则检查所有节点）
   * @returns 冲突列表
   */
  detectConflicts(stateKey: string, nodeIds?: string[]): Promise<StateConflict[]>;

  /**
   * 解决冲突
   * @param conflictId 冲突ID
   * @param resolutionStrategy 解决策略
   * @param resolvedData 解决后的数据（可选，某些策略需要）
   * @returns 是否成功
   */
  resolveConflict(
    conflictId: string,
    resolutionStrategy: ConflictResolutionStrategy,
    resolvedData?: any
  ): Promise<boolean>;

  /**
   * 获取未解决的冲突
   * @param severity 冲突严重级别（可选）
   * @returns 冲突列表
   */
  getUnresolvedConflicts(severity?: ConflictSeverity): Promise<StateConflict[]>;

  // ============ 状态传播 ============

  /**
   * 传播状态变更
   * @param sourceNodeId 源节点ID
   * @param stateKeys 状态键列表
   * @param scope 传播范围
   * @param mode 传播模式
   * @returns 传播事件ID
   */
  propagateStateChange(
    sourceNodeId: string,
    stateKeys: string[],
    scope: PropagationScope,
    mode: PropagationMode
  ): Promise<string>;

  /**
   * 获取传播事件状态
   * @param eventId 事件ID
   * @returns 传播事件
   */
  getPropagationEvent(eventId: string): Promise<StatePropagationEvent | null>;

  /**
   * 获取传播配置
   * @returns 传播配置
   */
  getPropagationConfig(): StatePropagationConfig;

  /**
   * 更新传播配置
   * @param config 新配置
   * @returns 是否成功
   */
  updatePropagationConfig(config: Partial<StatePropagationConfig>): Promise<boolean>;

  // ============ 快照管理 ============

  /**
   * 创建状态快照
   * @param nodeId 节点ID
   * @param description 快照描述
   * @param tags 快照标签（可选）
   * @returns 快照ID
   */
  createSnapshot(
    nodeId: string,
    description?: string,
    tags?: string[]
  ): Promise<string>;

  /**
   * 恢复快照
   * @param nodeId 节点ID
   * @param snapshotId 快照ID
   * @returns 恢复结果
   */
  restoreSnapshot(
    nodeId: string,
    snapshotId: string
  ): Promise<SnapshotRestoreResult>;

  /**
   * 列出节点的快照
   * @param nodeId 节点ID
   * @returns 快照列表
   */
  listSnapshots(nodeId: string): Promise<StateSnapshot[]>;

  /**
   * 删除快照
   * @param nodeId 节点ID
   * @param snapshotId 快照ID
   * @returns 是否成功
   */
  deleteSnapshot(nodeId: string, snapshotId: string): Promise<boolean>;

  // ============ 同步会话 ============

  /**
   * 创建同步会话
   * @param type 会话类型
   * @param participants 参与节点列表
   * @param config 会话配置（可选）
   * @returns 会话ID
   */
  createSyncSession(
    type: SyncSessionType,
    participants: string[],
    config?: StatePropagationConfig
  ): Promise<string>;

  /**
   * 启动同步会话
   * @param sessionId 会话ID
   * @returns 是否成功
   */
  startSyncSession(sessionId: string): Promise<boolean>;

  /**
   * 获取同步会话状态
   * @param sessionId 会话ID
   * @returns 同步会话
   */
  getSyncSession(sessionId: string): Promise<SyncSession | null>;

  /**
   * 列出同步会话
   * @param status 会话状态（可选）
   * @returns 会话列表
   */
  listSyncSessions(status?: SyncSessionStatus): Promise<SyncSession[]>;

  /**
   * 取消同步会话
   * @param sessionId 会话ID
   * @returns 是否成功
   */
  cancelSyncSession(sessionId: string): Promise<boolean>;

  // ============ 统计信息 ============

  /**
   * 获取系统统计摘要
   * @returns 统计摘要
   */
  getStatistics(): Promise<DistributedStateStatistics>;

  /**
   * 清空所有数据（主要用于测试）
   * @returns 是否成功
   */
  clear(): Promise<boolean>;
}

// ============ 分布式状态统计 ============

/**
 * 分布式状态统计摘要
 */
export interface DistributedStateStatistics {
  /** 节点统计 */
  nodes: {
    /** 总节点数 */
    total: number;
    /** 在线节点数 */
    online: number;
    /** 离线节点数 */
    offline: number;
    /** 错误节点数 */
    error: number;
  };
  /** 同步操作统计 */
  syncOperations: {
    /** 待处理 */
    pending: number;
    /** 进行中 */
    inProgress: number;
    /** 今日成功数 */
    todaySuccess: number;
    /** 今日失败数 */
    todayFailure: number;
  };
  /** 冲突统计 */
  conflicts: {
    /** 未解决冲突数 */
    unresolved: number;
    /** 今日解决数 */
    todayResolved: number;
    /** 按严重级别分类 */
    bySeverity: Record<string, number>;
  };
  /** 快照统计 */
  snapshots: {
    /** 总快照数 */
    total: number;
    /** 总大小（字节） */
    totalSize: number;
  };
}
