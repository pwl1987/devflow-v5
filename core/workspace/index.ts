/**
 * DevFlow v5 - 工作区模块
 *
 * 导出所有工作区相关的接口和实现
 */

// ============ 接口 ============
export { IProjectRegistry } from './IProjectRegistry';
export { IWorkspaceManager } from './IWorkspaceManager';

// ============ 类型 ============
export type {
  ProjectMetadata,
  ProjectRegistrationResult
} from './IProjectRegistry';

export type {
  WorkspaceMetadata,
  WorkspaceConfig,
  WorkspaceState,
  WorkspaceCreationResult,
  ProjectAdditionResult
} from './IWorkspaceManager';

export type {
  WorkspaceMeta,
  WorkspaceProjectRelation,
  WorkspaceStats,
  MultiProjectOperationType,
  MultiProjectOperationStatus,
  MultiProjectOperationResult
} from './WorkspaceContext';

// ============ 实现 ============
export { ProjectRegistry } from './ProjectRegistry';
export { WorkspaceManager } from './WorkspaceManager';
