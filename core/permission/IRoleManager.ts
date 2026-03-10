/**
 * DevFlow v5 - 角色管理器接口
 *
 * 职责：管理角色定义、角色权限分配
 */

import { Role, SystemRole, Permission, UserRoleAssignment } from './types';

// ============ 角色管理结果 ============

/**
 * 角色创建结果
 */
export interface RoleCreationResult {
  /** 是否成功 */
  success: boolean;
  /** 角色ID（成功时返回） */
  roleId?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

/**
 * 角色分配结果
 */
export interface RoleAssignmentResult {
  /** 是否成功 */
  success: boolean;
  /** 分配ID（成功时返回） */
  assignmentId?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

// ============ IRoleManager 接口 ============

/**
 * 角色管理器接口
 *
 * 功能：
 * - 角色CRUD操作
 * - 用户角色关联管理
 * - 系统角色管理
 */
export interface IRoleManager {
  /**
   * 创建新角色
   * @param name 角色名称
   * @param displayName 显示名称
   * @param description 角色描述
   * @param permissions 初始权限列表
   * @returns 创建结果
   */
  createRole(
    name: string,
    displayName: string,
    description?: string,
    permissions?: Permission[]
  ): Promise<RoleCreationResult>;

  /**
   * 获取角色
   * @param roleId 角色ID
   * @returns 角色定义，不存在时返回null
   */
  getRole(roleId: string): Promise<Role | null>;

  /**
   * 通过名称获取角色
   * @param name 角色名称
   * @returns 角色定义，不存在时返回null
   */
  getRoleByName(name: string): Promise<Role | null>;

  /**
   * 列出所有角色
   * @returns 角色列表
   */
  listRoles(): Promise<Role[]>;

  /**
   * 列出系统角色
   * @returns 系统角色列表
   */
  listSystemRoles(): Promise<Role[]>;

  /**
   * 列出自定义角色
   * @returns 自定义角色列表
   */
  listCustomRoles(): Promise<Role[]>;

  /**
   * 更新角色
   * @param roleId 角色ID
   * @param updates 要更新的字段
   * @returns 是否成功
   */
  updateRole(roleId: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<boolean>;

  /**
   * 删除角色
   * @param roleId 角色ID
   * @returns 是否成功
   */
  deleteRole(roleId: string): Promise<boolean>;

  /**
   * 为角色添加权限
   * @param roleId 角色ID
   * @param permission 权限
   * @returns 是否成功
   */
  addPermissionToRole(roleId: string, permission: Permission): Promise<boolean>;

  /**
   * 从角色移除权限
   * @param roleId 角色ID
   * @param permissionId 权限ID
   * @returns 是否成功
   */
  removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean>;

  /**
   * 为用户分配角色
   * @param userId 用户ID
   * @param roleId 角色ID
   * @param resourceId 资源ID（工作区ID或项目ID）
   * @param resourceType 资源类型
   * @param grantedBy 授予者ID
   * @returns 分配结果
   */
  assignRoleToUser(
    userId: string,
    roleId: string,
    resourceId: string,
    resourceType: 'workspace' | 'project',
    grantedBy: string
  ): Promise<RoleAssignmentResult>;

  /**
   * 撤销用户角色
   * @param assignmentId 关联ID
   * @returns 是否成功
   */
  revokeRoleFromUser(assignmentId: string): Promise<boolean>;

  /**
   * 获取用户的所有角色关联
   * @param userId 用户ID
   * @returns 角色关联列表
   */
  getUserRoles(userId: string): Promise<UserRoleAssignment[]>;

  /**
   * 获取用户在特定资源的角色
   * @param userId 用户ID
   * @param resourceId 资源ID
   * @returns 角色关联列表
   */
  getUserRolesForResource(userId: string, resourceId: string): Promise<UserRoleAssignment[]>;

  /**
   * 初始化系统角色
   * 创建预定义的系统角色
   */
  initializeSystemRoles(): Promise<void>;

  /**
   * 清空所有数据（主要用于测试）
   * @returns 是否成功
   */
  clear(): Promise<boolean>;
}
