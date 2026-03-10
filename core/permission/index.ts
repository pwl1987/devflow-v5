/**
 * DevFlow v5 - 权限模块
 *
 * 导出所有权限相关的接口和类型
 */

// ============ 类型 ============
export type {
  PermissionResource,
  PermissionAction,
  Permission,
  Role,
  UserRoleAssignment,
  UserPermissionSummary,
  PermissionCheckResult,
  PermissionPolicy,
  PermissionRule,
  PermissionCondition,
  SystemRoleType
} from './types';

// ============ 枚举 ============
export { PermissionInheritance } from './types';

// ============ 常量 ============
export { SystemRole } from './types';

// ============ 接口 ============
export { IRoleManager } from './IRoleManager';
export type {
  RoleCreationResult,
  RoleAssignmentResult
} from './IRoleManager';

export { IPermissionManager } from './IPermissionManager';

// ============ 实现 ============
export { RoleManager } from './RoleManager';
export { PermissionManager } from './PermissionManager';
