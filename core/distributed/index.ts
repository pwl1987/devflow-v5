/**
 * DevFlow v5 - 分布式状态管理模块
 *
 * 职责：跨项目状态同步、冲突解决、状态传播
 */

// 类型定义（非枚举）
export type {
  StateVersion,
  StateNode,
  StateSyncOperation,
  StateConflict,
  StatePropagationConfig,
  StatePropagationEvent,
  StateSnapshot,
  SnapshotRestoreResult,
  SyncSession
} from './types';

// 接口
export type {
  IDistributedStateManager
} from './IDistributedStateManager';

// 实现
export {
  DistributedStateManager
} from './DistributedStateManager';

// 重新导出所有枚举（作为值）
export * from './types';
