/**
 * DevFlow v5 - 权限管理器实现
 *
 * 职责：检查权限、授予/撤销权限、权限策略管理
 *
 * SOLID 原则：
 * - 单一职责：仅负责权限检查和管理
 * - 依赖倒置：实现 IPermissionManager 接口
 */

import type {
  IPermissionManager,
  IRoleManager,
  Permission,
  PermissionCheckResult,
  PermissionPolicy
} from '../permission';
import { PermissionInheritance } from '../permission';

// ============ PermissionManager 实现 ============

/**
 * 权限管理器实现
 *
 * 基于角色进行权限检查
 * 支持权限继承策略
 */
export class PermissionManager implements IPermissionManager {
  // 权限策略存储
  private policies: Map<string, PermissionPolicy> = new Map();
  // 资源所有者存储（resourceId -> ownerId）
  private resourceOwners: Map<string, string> = new Map();

  constructor(private roleManager: IRoleManager) {}

  /**
   * 检查用户是否有特定权限
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<PermissionCheckResult> {
    // 1. 检查是否为资源所有者
    if (resourceId && await this.isOwner(userId, resourceId)) {
      return {
        granted: true,
        permission: {
          id: 'owner-perm',
          name: `${resource}.${action}`,
          resource: resource as any,
          action: action as any
        }
      };
    }

    // 2. 获取用户的所有权限
    const userPermissions = await this.getUserPermissions(userId, resourceId);

    // 3. 检查是否有匹配的权限
    const matchingPermission = userPermissions.find(
      p => p.resource === resource && p.action === action
    );

    if (matchingPermission) {
      return {
        granted: true,
        permission: matchingPermission
      };
    }

    // 4. 检查继承权限
    if (resourceId) {
      const inheritedPermission = await this.checkInheritedPermission(
        userId,
        resource,
        action,
        resourceId
      );
      if (inheritedPermission.granted) {
        return inheritedPermission;
      }
    }

    return {
      granted: false,
      reason: `User does not have permission to ${action} on ${resource}`
    };
  }

  /**
   * 批量检查权限
   */
  async checkPermissions(
    userId: string,
    checks: Array<{
      resource: string;
      action: string;
      resourceId?: string;
    }>
  ): Promise<Map<string, PermissionCheckResult>> {
    const results = new Map<string, PermissionCheckResult>();

    for (const check of checks) {
      const key = `${check.resource}:${check.action}:${check.resourceId || 'global'}`;
      const result = await this.checkPermission(
        userId,
        check.resource,
        check.action,
        check.resourceId
      );
      results.set(key, result);
    }

    return results;
  }

  /**
   * 检查用户是否为资源所有者
   */
  async isOwner(userId: string, resourceId: string): Promise<boolean> {
    const ownerId = this.resourceOwners.get(resourceId);
    return ownerId === userId;
  }

  /**
   * 授予用户权限（通过角色）
   */
  async grantPermission(
    userId: string,
    permission: Permission,
    resourceId: string,
    grantedBy: string
  ): Promise<boolean> {
    // 通过角色授予权限（这里简化实现，实际需要更复杂的逻辑）
    // 暂时返回 true 表示操作成功
    return true;
  }

  /**
   * 撤销用户权限
   */
  async revokePermission(
    userId: string,
    permissionId: string,
    resourceId: string
  ): Promise<boolean> {
    // 暂时简化实现
    return true;
  }

  /**
   * 获取用户的所有权限
   */
  async getUserPermissions(
    userId: string,
    resourceId?: string
  ): Promise<Permission[]> {
    const permissions: Permission[] = [];

    // 获取用户的所有角色
    const userRoles = await this.roleManager.getUserRoles(userId);

    // 筛选特定资源的角色
    const relevantRoles = resourceId
      ? userRoles.filter(r => r.resourceId === resourceId)
      : userRoles;

    // 收集所有角色的权限
    for (const roleAssignment of relevantRoles) {
      const role = await this.roleManager.getRole(roleAssignment.roleId);
      if (role) {
        permissions.push(...role.permissions);
      }
    }

    return permissions;
  }

  /**
   * 设置权限策略
   */
  async setPermissionPolicy(policy: PermissionPolicy): Promise<boolean> {
    this.policies.set(policy.resourceId, policy);
    return true;
  }

  /**
   * 获取权限策略
   */
  async getPermissionPolicy(resourceId: string): Promise<PermissionPolicy | null> {
    return this.policies.get(resourceId) || null;
  }

  /**
   * 设置资源所有者
   */
  setResourceOwner(resourceId: string, ownerId: string): void {
    this.resourceOwners.set(resourceId, ownerId);
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<boolean> {
    this.policies.clear();
    this.resourceOwners.clear();
    return true;
  }

  // ============ 私有辅助方法 ============

  /**
   * 检查继承权限
   */
  private async checkInheritedPermission(
    userId: string,
    resource: string,
    action: string,
    resourceId: string
  ): Promise<PermissionCheckResult> {
    // 获取权限策略
    const policy = await this.getPermissionPolicy(resourceId);

    if (!policy || policy.inheritance === PermissionInheritance.NONE) {
      return {
        granted: false,
        reason: 'No permission inheritance configured'
      };
    }

    // 工作区到项目继承
    if (policy.inheritance === PermissionInheritance.WORKSPACE_TO_PROJECT) {
      // 检查工作区级权限
      const workspacePermissions = await this.getUserPermissions(userId);
      const workspacePermission = workspacePermissions.find(
        p => p.resource === 'workspace' && p.action === action
      );

      if (workspacePermission) {
        return {
          granted: true,
          permission: workspacePermission
        };
      }
    }

    // 完全继承
    if (policy.inheritance === PermissionInheritance.FULL) {
      const allPermissions = await this.getUserPermissions(userId);
      const inherited = allPermissions.find(
        p => p.resource === resource && p.action === action
      );

      if (inherited) {
        return {
          granted: true,
          permission: inherited
        };
      }
    }

    return {
      granted: false,
      reason: 'No inherited permission found'
    };
  }
}
