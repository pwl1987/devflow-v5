/**
 * DevFlow v5 - 权限管理器接口
 *
 * 职责：检查权限、授予/撤销权限
 */

import { Permission, PermissionCheckResult, PermissionPolicy } from './types';

// ============ IPermissionManager 接口 ============

/**
 * 权限管理器接口
 *
 * 功能：
 * - 权限检查
 * - 权限授予/撤销
 * - 权限策略管理
 */
export interface IPermissionManager {
  /**
   * 检查用户是否有特定权限
   * @param userId 用户ID
   * @param resource 资源类型
   * @param action 操作类型
   * @param resourceId 资源ID（可选）
   * @returns 权限检查结果
   */
  checkPermission(
    userId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<PermissionCheckResult>;

  /**
   * 批量检查权限
   * @param userId 用户ID
   * @param checks 权限检查列表
   * @returns 权限检查结果映射
   */
  checkPermissions(
    userId: string,
    checks: Array<{
      resource: string;
      action: string;
      resourceId?: string;
    }>
  ): Promise<Map<string, PermissionCheckResult>>;

  /**
   * 检查用户是否为资源所有者
   * @param userId 用户ID
   * @param resourceId 资源ID
   * @returns 是否为所有者
   */
  isOwner(userId: string, resourceId: string): Promise<boolean>;

  /**
   * 授予用户权限
   * @param userId 用户ID
   * @param permission 权限
   * @param resourceId 资源ID
   * @param grantedBy 授予者ID
   * @returns 是否成功
   */
  grantPermission(
    userId: string,
    permission: Permission,
    resourceId: string,
    grantedBy: string
  ): Promise<boolean>;

  /**
   * 撤销用户权限
   * @param userId 用户ID
   * @param permissionId 权限ID
   * @param resourceId 资源ID
   * @returns 是否成功
   */
  revokePermission(
    userId: string,
    permissionId: string,
    resourceId: string
  ): Promise<boolean>;

  /**
   * 获取用户的所有权限
   * @param userId 用户ID
   * @param resourceId 资源ID（可选，筛选特定资源）
   * @returns 权限列表
   */
  getUserPermissions(
    userId: string,
    resourceId?: string
  ): Promise<Permission[]>;

  /**
   * 设置权限策略
   * @param policy 权限策略
   * @returns 是否成功
   */
  setPermissionPolicy(policy: PermissionPolicy): Promise<boolean>;

  /**
   * 获取权限策略
   * @param resourceId 资源ID
   * @returns 权限策略，不存在时返回null
   */
  getPermissionPolicy(resourceId: string): Promise<PermissionPolicy | null>;

  /**
   * 设置资源所有者
   * @param resourceId 资源ID
   * @param ownerId 所有者用户ID
   */
  setResourceOwner(resourceId: string, ownerId: string): void;

  /**
   * 清空所有数据（主要用于测试）
   * @returns 是否成功
   */
  clear(): Promise<boolean>;
}
