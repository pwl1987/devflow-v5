/**
 * DevFlow v5 - 分布式状态系统类型定义
 *
 * 职责：定义跨项目状态同步、冲突解决、状态传播的核心数据结构
 */

// ============ 状态同步类型 ============

/**
 * 状态版本
 */
export interface StateVersion {
  /** 版本ID（唯一标识符） */
  id: string;
  /** 版本号（单调递增） */
  version: number;
  /** 时间戳 */
  timestamp: string;
  /** 节点ID（产生此版本的节点） */
  nodeId: string;
  /** 变更摘要 */
  summary: string;
  /** 父版本ID（用于版本链） */
  parentVersionId?: string;
}

/**
 * 状态节点
 */
export interface StateNode {
  /** 节点ID（通常是项目ID或工作区ID） */
  nodeId: string;
  /** 节点类型 */
  nodeType: 'workspace' | 'project' | 'global';
  /** 节点地址（网络地址） */
  address?: string;
  /** 节点状态 */
  status: NodeStatus;
  /** 最后活跃时间 */
  lastSeen: string;
  /** 支持的操作类型 */
  capabilities: NodeCapability[];
}

/**
 * 节点状态
 */
export enum NodeStatus {
  /** 在线 */
  ONLINE = 'online',
  /** 离线 */
  OFFLINE = 'offline',
  /** 同步中 */
  SYNCING = 'syncing',
  /** 错误 */
  ERROR = 'error'
}

/**
 * 节点能力
 */
export enum NodeCapability {
  /** 可以接收状态更新 */
  RECEIVE_UPDATES = 'receive_updates',
  /** 可以发送状态更新 */
  SEND_UPDATES = 'send_updates',
  /** 可以解决冲突 */
  RESOLVE_CONFLICTS = 'resolve_conflicts',
  /** 可以存储状态快照 */
  STORE_SNAPSHOTS = 'store_snapshots',
  /** 可以执行状态查询 */
  QUERY_STATE = 'query_state'
}

/**
 * 状态同步操作
 */
export interface StateSyncOperation {
  /** 操作ID */
  id: string;
  /** 操作类型 */
  type: SyncOperationType;
  /** 源节点 */
  sourceNodeId: string;
  /** 目标节点 */
  targetNodeId: string;
  /** 状态键 */
  stateKey: string;
  /** 状态数据 */
  stateData: any;
  /** 版本信息 */
  version: StateVersion;
  /** 操作优先级（数字越大优先级越高） */
  priority: number;
  /** 操作时间戳 */
  timestamp: string;
  /** 操作状态 */
  status: SyncOperationStatus;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 同步操作类型
 */
export enum SyncOperationType {
  /** 更新状态 */
  UPDATE = 'update',
  /** 删除状态 */
  DELETE = 'delete',
  /** 查询状态 */
  QUERY = 'query',
  /** 同步请求 */
  SYNC_REQUEST = 'sync_request',
  /** 冲突解决 */
  RESOLVE_CONFLICT = 'resolve_conflict',
  /** 批量同步 */
  BATCH_SYNC = 'batch_sync'
}

/**
 * 同步操作状态
 */
export enum SyncOperationStatus {
  /** 待处理 */
  PENDING = 'pending',
  /** 进行中 */
  IN_PROGRESS = 'in_progress',
  /** 成功 */
  SUCCESS = 'success',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled',
  /** 冲突 */
  CONFLICT = 'conflict'
}

// ============ 冲突解决 ============

/**
 * 状态冲突
 */
export interface StateConflict {
  /** 冲突ID */
  id: string;
  /** 状态键 */
  stateKey: string;
  /** 冲突版本列表 */
  conflictingVersions: Array<{
    nodeId: string;
    version: StateVersion;
    stateData: any;
  }>;
  /** 冲突检测时间 */
  detectedAt: string;
  /** 冲突类型 */
  conflictType: ConflictType;
  /** 冲突严重级别 */
  severity: ConflictSeverity;
  /** 解决策略 */
  resolutionStrategy?: ConflictResolutionStrategy;
  /** 解决状态 */
  resolutionStatus: ConflictResolutionStatus;
  /** 解决后的版本 */
  resolvedVersion?: StateVersion;
}

/**
 * 冲突类型
 */
export enum ConflictType {
  /** 值冲突：同一键的不同值 */
  VALUE_CONFLICT = 'value_conflict',
  /** 版本冲突：版本分叉 */
  VERSION_CONFLICT = 'version_conflict',
  /** 并发冲突：同时修改 */
  CONCURRENT_CONFLICT = 'concurrent_conflict',
  /** 结构冲突：数据结构不一致 */
  STRUCTURAL_CONFLICT = 'structural_conflict'
}

/**
 * 冲突严重级别
 */
export enum ConflictSeverity {
  /** 低：可以自动解决 */
  LOW = 'low',
  /** 中：需要用户确认 */
  MEDIUM = 'medium',
  /** 高：必须手动解决 */
  HIGH = 'high',
  /** 关键：阻塞系统运行 */
  CRITICAL = 'critical'
}

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  /** 最后写入胜出（LWW） */
  LAST_WRITE_WINS = 'last_write_wins',
  /** 第一写入胜出 */
  FIRST_WRITE_WINS = 'first_write_wins',
  /** 版本号胜出（最高版本） */
  HIGHEST_VERSION_WINS = 'highest_version_wins',
  /** 手动解决 */
  MANUAL = 'manual',
  /** 源节点优先 */
  SOURCE_PRIORITY = 'source_priority',
  /** 目标节点优先 */
  TARGET_PRIORITY = 'target_priority',
  /** 合并：自动合并变更 */
  MERGE = 'merge',
  /** 自定义策略 */
  CUSTOM = 'custom'
}

/**
 * 冲突解决状态
 */
export enum ConflictResolutionStatus {
  /** 待解决 */
  PENDING = 'pending',
  /** 解决中 */
  RESOLVING = 'resolving',
  /** 已解决 */
  RESOLVED = 'resolved',
  /** 已忽略 */
  IGNORED = 'ignored',
  /** 解决失败 */
  FAILED = 'failed'
}

// ============ 状态传播 ============

/**
 * 状态传播配置
 */
export interface StatePropagationConfig {
  /** 是否启用状态传播 */
  enabled: boolean;
  /** 传播模式 */
  mode: PropagationMode;
  /** 传播范围 */
  scope: PropagationScope;
  /** 传播延迟（毫秒） */
  propagationDelay?: number;
  /** 批量传播大小 */
  batchSize?: number;
  /** 重试配置 */
  retry?: {
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试延迟（毫秒） */
    retryDelay: number;
    /** 指数退避 */
    exponentialBackoff: boolean;
  };
  /** 冲突解决策略 */
  conflictResolution: ConflictResolutionStrategy;
}

/**
 * 传播模式
 */
export enum PropagationMode {
  /** 即时传播 */
  IMMEDIATE = 'immediate',
  /** 批量传播 */
  BATCH = 'batch',
  /** 定期传播 */
  SCHEDULED = 'scheduled',
  /** 按需传播 */
  ON_DEMAND = 'on_demand'
}

/**
 * 传播范围
 */
export enum PropagationScope {
  /** 全局：传播到所有节点 */
  GLOBAL = 'global',
  /** 工作区：传播到工作区内所有项目 */
  WORKSPACE = 'workspace',
  /** 项目：仅限项目内 */
  PROJECT = 'project',
  /** 自定义：指定目标节点 */
  CUSTOM = 'custom'
}

/**
 * 状态传播事件
 */
export interface StatePropagationEvent {
  /** 事件ID */
  id: string;
  /** 源节点 */
  sourceNodeId: string;
  /** 目标节点列表 */
  targetNodeIds: string[];
  /** 状态键列表 */
  stateKeys: string[];
  /** 传播模式 */
  mode: PropagationMode;
  /** 事件时间戳 */
  timestamp: string;
  /** 传播状态 */
  status: PropagationStatus;
  /** 结果统计 */
  statistics: PropagationStatistics;
}

/**
 * 传播状态
 */
export enum PropagationStatus {
  /** 待传播 */
  PENDING = 'pending',
  /** 传播中 */
  IN_PROGRESS = 'in_progress',
  /** 部分成功 */
  PARTIAL = 'partial',
  /** 全部成功 */
  SUCCESS = 'success',
  /** 全部失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled'
}

/**
 * 传播统计
 */
export interface PropagationStatistics {
  /** 总目标数 */
  totalTargets: number;
  /** 成功数 */
  successCount: number;
  /** 失败数 */
  failureCount: number;
  /** 待处理数 */
  pendingCount: number;
  /** 冲突数 */
  conflictCount: number;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime?: string;
}

// ============ 状态快照 ============

/**
 * 状态快照
 */
export interface StateSnapshot {
  /** 快照ID */
  id: string;
  /** 节点ID */
  nodeId: string;
  /** 快照时间 */
  timestamp: string;
  /** 状态版本 */
  version: StateVersion;
  /** 状态数据映射 */
  states: Map<string, any>;
  /** 校验和 */
  checksum: string;
  /** 快照大小（字节） */
  size: number;
  /** 快照描述 */
  description?: string;
  /** 标签 */
  tags?: string[];
}

/**
 * 快照恢复结果
 */
export interface SnapshotRestoreResult {
  /** 是否成功 */
  success: boolean;
  /** 恢复的状态键数 */
  restoredKeys: number;
  /** 跳过的键数 */
  skippedKeys: number;
  /** 失败的键数 */
  failedKeys: number;
  /** 错误列表 */
  errors: Array<{
    key: string;
    error: string;
  }>;
}

// ============ 同步会话 ============

/**
 * 同步会话
 */
export interface SyncSession {
  /** 会话ID */
  id: string;
  /** 会话类型 */
  type: SyncSessionType;
  /** 参与节点列表 */
  participants: string[];
  /** 会话状态 */
  status: SyncSessionStatus;
  /** 创建时间 */
  createdAt: string;
  /** 开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
  /** 传播事件引用 */
  propagationEventId?: string;
  /** 会话配置 */
  config?: StatePropagationConfig;
}

/**
 * 同步会话类型
 */
export enum SyncSessionType {
  /** 全局同步 */
  GLOBAL_SYNC = 'global_sync',
  /** 工作区同步 */
  WORKSPACE_SYNC = 'workspace_sync',
  /** 项目同步 */
  PROJECT_SYNC = 'project_sync',
  /** 点对点同步 */
  PEER_TO_PEER = 'peer_to_peer',
  /** 冲突解决会话 */
  CONFLICT_RESOLUTION = 'conflict_resolution'
}

/**
 * 同步会话状态
 */
export enum SyncSessionStatus {
  /** 待执行 */
  PENDING = 'pending',
  /** 进行中 */
  IN_PROGRESS = 'in_progress',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled'
}
