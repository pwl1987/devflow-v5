/**
 * DevFlow v5 - 角色管理器实现
 *
 * 职责：管理角色定义、角色权限分配、用户角色关联
 *
 * SOLID 原则：
 * - 单一职责：仅负责角色和权限管理
 * - 依赖倒置：实现 IRoleManager 接口
 */

import type {
  IRoleManager,
  Role,
  Permission,
  UserRoleAssignment,
  RoleCreationResult,
  RoleAssignmentResult
} from '../permission';
import { SystemRole } from '../permission';

// ============ RoleManager 实现 ============

/**
 * 角色管理器实现
 *
 * 管理角色的生命周期、权限分配和用户关联
 */
export class RoleManager implements IRoleManager {
  // 角色存储
  private roles: Map<string, Role> = new Map();
  // 角色名称索引（快速查找）
  private roleNameIndex: Map<string, string> = new Map();
  // 用户角色关联存储
  private userRoleAssignments: Map<string, UserRoleAssignment> = new Map();

  /**
   * 创建新角色
   */
  async createRole(
    name: string,
    displayName: string,
    description?: string,
    permissions?: Permission[]
  ): Promise<RoleCreationResult> {
    // 验证输入
    if (!name || name.trim() === '') {
      return {
        success: false,
        error: 'Role name cannot be empty'
      };
    }

    if (!displayName || displayName.trim() === '') {
      return {
        success: false,
        error: 'Role display name cannot be empty'
      };
    }

    // 检查名称是否已存在
    if (this.roleNameIndex.has(name)) {
      return {
        success: false,
        error: `Role with name '${name}' already exists`
      };
    }

    // 生成角色ID
    const roleId = this.generateRoleId();
    const now = new Date().toISOString();

    // 创建角色
    const role: Role = {
      id: roleId,
      name: name.trim(),
      displayName: displayName.trim(),
      description,
      permissions: permissions || [],
      isSystemRole: false,
      createdAt: now,
      updatedAt: now
    };

    // 存储角色
    this.roles.set(roleId, role);
    this.roleNameIndex.set(name, roleId);

    return {
      success: true,
      roleId
    };
  }

  /**
   * 获取角色
   */
  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  /**
   * 通过名称获取角色
   */
  async getRoleByName(name: string): Promise<Role | null> {
    const roleId = this.roleNameIndex.get(name);
    if (!roleId) {
      return null;
    }
    return this.roles.get(roleId) || null;
  }

  /**
   * 列出所有角色
   */
  async listRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  /**
   * 列出系统角色
   */
  async listSystemRoles(): Promise<Role[]> {
    const allRoles = Array.from(this.roles.values());
    return allRoles.filter(r => r.isSystemRole);
  }

  /**
   * 列出自定义角色
   */
  async listCustomRoles(): Promise<Role[]> {
    const allRoles = Array.from(this.roles.values());
    return allRoles.filter(r => !r.isSystemRole);
  }

  /**
   * 更新角色
   */
  async updateRole(
    roleId: string,
    updates: Partial<Omit<Role, 'id' | 'createdAt'>>
  ): Promise<boolean> {
    const role = this.roles.get(roleId);

    if (!role) {
      return false;
    }

    // 系统角色不能修改名称
    if (role.isSystemRole && updates.name) {
      return false;
    }

    // 如果更新名称，需要更新索引
    if (updates.name && updates.name !== role.name) {
      if (this.roleNameIndex.has(updates.name)) {
        return false; // 名称冲突
      }
      this.roleNameIndex.delete(role.name);
      this.roleNameIndex.set(updates.name, roleId);
    }

    // 更新角色
    const updated: Role = {
      ...role,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.roles.set(roleId, updated);

    return true;
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);

    if (!role) {
      return false;
    }

    // 系统角色不能删除
    if (role.isSystemRole) {
      return false;
    }

    // 检查是否有用户使用此角色
    const hasUsers = Array.from(this.userRoleAssignments.values()).some(
      assignment => assignment.roleId === roleId
    );

    if (hasUsers) {
      return false; // 有用户使用，不能删除
    }

    // 删除角色
    this.roles.delete(roleId);
    this.roleNameIndex.delete(role.name);

    return true;
  }

  /**
   * 为角色添加权限
   */
  async addPermissionToRole(roleId: string, permission: Permission): Promise<boolean> {
    const role = this.roles.get(roleId);

    if (!role) {
      return false;
    }

    // 检查权限是否已存在
    const exists = role.permissions.some(p => p.id === permission.id);

    if (exists) {
      return false;
    }

    role.permissions.push(permission);

    // 更新时间戳
    role.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * 从角色移除权限
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const role = this.roles.get(roleId);

    if (!role) {
      return false;
    }

    const initialLength = role.permissions.length;
    role.permissions = role.permissions.filter(p => p.id !== permissionId);

    if (role.permissions.length === initialLength) {
      return false; // 权限不存在
    }

    // 更新时间戳
    role.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * 为用户分配角色
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    resourceId: string,
    resourceType: 'workspace' | 'project',
    grantedBy: string
  ): Promise<RoleAssignmentResult> {
    // 验证角色存在
    const role = await this.getRole(roleId);
    if (!role) {
      return {
        success: false,
        error: `Role '${roleId}' not found`
      };
    }

    // 检查是否已有相同角色的分配
    const existing = Array.from(this.userRoleAssignments.values()).find(
      a => a.userId === userId && a.resourceId === resourceId && a.roleId === roleId
    );

    if (existing) {
      return {
        success: false,
        error: 'User already has this role for the resource'
      };
    }

    // 生成分配ID
    const assignmentId = this.generateAssignmentId();
    const now = new Date().toISOString();

    const assignment: UserRoleAssignment = {
      id: assignmentId,
      userId,
      roleId,
      resourceId,
      resourceType,
      grantedAt: now,
      grantedBy
    };

    this.userRoleAssignments.set(assignmentId, assignment);

    return {
      success: true,
      assignmentId
    };
  }

  /**
   * 撤销用户角色
   */
  async revokeRoleFromUser(assignmentId: string): Promise<boolean> {
    return this.userRoleAssignments.delete(assignmentId);
  }

  /**
   * 获取用户的所有角色关联
   */
  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    const allAssignments = Array.from(this.userRoleAssignments.values());
    return allAssignments.filter(a => a.userId === userId);
  }

  /**
   * 获取用户在特定资源的角色
   */
  async getUserRolesForResource(userId: string, resourceId: string): Promise<UserRoleAssignment[]> {
    const allAssignments = Array.from(this.userRoleAssignments.values());
    return allAssignments.filter(a => a.userId === userId && a.resourceId === resourceId);
  }

  /**
   * 初始化系统角色
   */
  async initializeSystemRoles(): Promise<void> {
    const systemRoleConfigs: Array<{
      name: string;
      displayName: string;
      description: string;
      permissions: Permission[];
    }> = [
      {
        name: SystemRole.WORKSPACE_OWNER,
        displayName: '工作区所有者',
        description: '拥有工作区的完全控制权',
        permissions: [
          { id: 'ws-admin', name: 'workspace.admin', resource: 'workspace', action: 'admin' },
          { id: 'ws-create', name: 'workspace.create', resource: 'workspace', action: 'create' },
          { id: 'ws-read', name: 'workspace.read', resource: 'workspace', action: 'read' },
          { id: 'ws-update', name: 'workspace.update', resource: 'workspace', action: 'update' },
          { id: 'ws-delete', name: 'workspace.delete', resource: 'workspace', action: 'delete' },
          { id: 'ws-share', name: 'workspace.share', resource: 'workspace', action: 'share' }
        ]
      },
      {
        name: SystemRole.PROJECT_OWNER,
        displayName: '项目所有者',
        description: '拥有项目的完全控制权',
        permissions: [
          { id: 'proj-admin', name: 'project.admin', resource: 'project', action: 'admin' },
          { id: 'proj-create', name: 'project.create', resource: 'project', action: 'create' },
          { id: 'proj-read', name: 'project.read', resource: 'project', action: 'read' },
          { id: 'proj-update', name: 'project.update', resource: 'project', action: 'update' },
          { id: 'proj-delete', name: 'project.delete', resource: 'project', action: 'delete' },
          { id: 'proj-execute', name: 'project.execute', resource: 'project', action: 'execute' }
        ]
      },
      {
        name: SystemRole.PROJECT_EDITOR,
        displayName: '项目编辑者',
        description: '可编辑项目内容但不能删除',
        permissions: [
          { id: 'proj-read', name: 'project.read', resource: 'project', action: 'read' },
          { id: 'proj-update', name: 'project.update', resource: 'project', action: 'update' },
          { id: 'proj-execute', name: 'project.execute', resource: 'project', action: 'execute' }
        ]
      },
      {
        name: SystemRole.PROJECT_VIEWER,
        displayName: '项目查看者',
        description: '只能查看项目内容',
        permissions: [
          { id: 'proj-read', name: 'project.read', resource: 'project', action: 'read' }
        ]
      }
    ];

    for (const config of systemRoleConfigs) {
      // 如果角色不存在，创建它
      const existing = await this.getRoleByName(config.name);
      if (!existing) {
        const roleId = this.generateRoleId();
        const now = new Date().toISOString();

        const role: Role = {
          id: roleId,
          name: config.name,
          displayName: config.displayName,
          description: config.description,
          permissions: config.permissions,
          isSystemRole: true,
          createdAt: now,
          updatedAt: now
        };

        this.roles.set(roleId, role);
        this.roleNameIndex.set(config.name, roleId);
      }
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<boolean> {
    this.roles.clear();
    this.roleNameIndex.clear();
    this.userRoleAssignments.clear();
    return true;
  }

  // ============ 私有辅助方法 ============

  /**
   * 生成角色ID
   */
  private generateRoleId(): string {
    return `role-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 生成分配ID
   */
  private generateAssignmentId(): string {
    return `assign-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
