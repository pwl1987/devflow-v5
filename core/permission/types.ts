/**
 * DevFlow v5 - 权限系统类型定义
 *
 * 职责：定义权限、角色、用户关联的核心数据结构
 */

// ============ 权限类型 ============

/**
 * 权限资源类型
 */
export type PermissionResource =
  | 'workspace'
  | 'project'
  | 'story'
  | 'asset'
  | 'config'
  | 'workflow';

/**
 * 权限操作类型
 */
export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'share';

/**
 * 权限定义
 */
export interface Permission {
  /** 权限ID */
  id: string;
  /** 权限名称（如：project.read） */
  name: string;
  /** 资源类型 */
  resource: PermissionResource;
  /** 操作类型 */
  action: PermissionAction;
  /** 权限描述 */
  description?: string;
}

// ============ 角色类型 ============

/**
 * 角色定义
 */
export interface Role {
  /** 角色ID */
  id: string;
  /** 角色名称（如：owner, editor, viewer） */
  name: string;
  /** 角色显示名称 */
  displayName: string;
  /** 角色描述 */
  description?: string;
  /** 角色权限列表 */
  permissions: Permission[];
  /** 是否为系统角色 */
  isSystemRole?: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 预定义系统角色名称常量
 */
export const SystemRole = {
  /** 工作区所有者 - 完全控制 */
  WORKSPACE_OWNER: 'workspace-owner',
  /** 项目所有者 - 项目级完全控制 */
  PROJECT_OWNER: 'project-owner',
  /** 项目编辑者 - 可修改但不能删除 */
  PROJECT_EDITOR: 'project-editor',
  /** 项目查看者 - 只读访问 */
  PROJECT_VIEWER: 'project-viewer',
  /** 工作区管理员 - 管理工作区但不能修改项目 */
  WORKSPACE_ADMIN: 'workspace-admin',
} as const;

/**
 * 系统角色类型
 */
export type SystemRoleType = typeof SystemRole[keyof typeof SystemRole];

// ============ 用户角色关联 ============

/**
 * 用户角色关联
 */
export interface UserRoleAssignment {
  /** 关联ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 角色ID */
  roleId: string;
  /** 资源ID（工作区ID或项目ID） */
  resourceId: string;
  /** 资源类型 */
  resourceType: 'workspace' | 'project';
  /** 授予时间 */
  grantedAt: string;
  /** 授予者ID */
  grantedBy: string;
  /** 过期时间（可选） */
  expiresAt?: string;
}

/**
 * 用户权限摘要
 */
export interface UserPermissionSummary {
  /** 用户ID */
  userId: string;
  /** 工作区角色 */
  workspaceRoles: Array<{
    workspaceId: string;
    roleName: string;
  }>;
  /** 项目角色 */
  projectRoles: Array<{
    projectId: string;
    roleName: string;
  }>;
  /** 有效权限列表 */
  permissions: Permission[];
}

// ============ 权限检查结果 ============

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  /** 是否有权限 */
  granted: boolean;
  /** 权限详情（如果有） */
  permission?: Permission;
  /** 拒绝原因（如果无权限） */
  reason?: string;
}

// ============ 权限策略 ============

/**
 * 权限继承策略
 */
export enum PermissionInheritance {
  /** 不继承 */
  NONE = 'none',
  /** 继承工作区权限到项目 */
  WORKSPACE_TO_PROJECT = 'workspace-to-project',
  /** 继承项目权限到故事 */
  PROJECT_TO_STORY = 'project-to-story',
  /** 完全继承 */
  FULL = 'full',
}

/**
 * 权限策略配置
 */
export interface PermissionPolicy {
  /** 策略ID */
  id: string;
  /** 资源ID（工作区ID或项目ID） */
  resourceId: string;
  /** 资源类型 */
  resourceType: 'workspace' | 'project';
  /** 继承策略 */
  inheritance: PermissionInheritance;
  /** 自定义权限规则（可选） */
  customRules?: PermissionRule[];
}

/**
 * 权限规则
 */
export interface PermissionRule {
  /** 规则ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则条件 */
  condition: PermissionCondition;
  /** 规则效果 */
  effect: 'allow' | 'deny';
}

/**
 * 权限条件
 */
export interface PermissionCondition {
  /** 需要的角色 */
  roles?: string[];
  /** 需要的权限 */
  permissions?: string[];
  /** 时间限制（可选） */
  timeRestriction?: {
    start?: string;
    end?: string;
  };
}
