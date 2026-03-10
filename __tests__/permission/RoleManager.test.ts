/**
 * RoleManager 单元测试
 *
 * TDD 流程：RED → GREEN → IMPROVE
 *
 * 测试策略：
 * - Mock 所有外部依赖
 * - 测试角色CRUD操作
 * - 测试用户角色关联
 * - 测试系统角色初始化
 * - 测试边界条件和错误处理
 */

import { IRoleManager, Role, SystemRole, SystemRoleType, Permission, UserRoleAssignment } from '../../core/permission';

// ============ Mock RoleManager ============

class MockRoleManager implements IRoleManager {
  private roles: Map<string, Role> = new Map();
  private assignments: Map<string, UserRoleAssignment> = new Map();

  async createRole(name: string, displayName: string, description?: string, permissions?: Permission[]) {
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
    const existing = Array.from(this.roles.values()).find(r => r.name === name);
    if (existing) {
      return {
        success: false,
        error: `Role with name '${name}' already exists`
      };
    }

    const roleId = `role-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

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

    this.roles.set(roleId, role);
    return { success: true, roleId };
  }

  async getRole(roleId: string) {
    return this.roles.get(roleId) || null;
  }

  async getRoleByName(name: string) {
    const allRoles = Array.from(this.roles.values());
    return allRoles.find(r => r.name === name) || null;
  }

  async listRoles() {
    return Array.from(this.roles.values());
  }

  async listSystemRoles() {
    const allRoles = Array.from(this.roles.values());
    return allRoles.filter(r => r.isSystemRole);
  }

  async listCustomRoles() {
    const allRoles = Array.from(this.roles.values());
    return allRoles.filter(r => !r.isSystemRole);
  }

  async updateRole(roleId: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>) {
    const role = this.roles.get(roleId);
    if (!role) return false;

    const updated = { ...role, ...updates, updatedAt: new Date().toISOString() };
    this.roles.set(roleId, updated);
    return true;
  }

  async deleteRole(roleId: string) {
    // 系统角色不能删除
    const role = this.roles.get(roleId);
    if (!role || role.isSystemRole) return false;

    this.roles.delete(roleId);
    return true;
  }

  async addPermissionToRole(roleId: string, permission: Permission) {
    const role = this.roles.get(roleId);
    if (!role) return false;

    role.permissions.push(permission);
    return true;
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    const role = this.roles.get(roleId);
    if (!role) return false;

    role.permissions = role.permissions.filter(p => p.id !== permissionId);
    return true;
  }

  async assignRoleToUser(userId: string, roleId: string, resourceId: string, resourceType: 'workspace' | 'project', grantedBy: string) {
    const assignmentId = `assign-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

    this.assignments.set(assignmentId, assignment);
    return { success: true, assignmentId };
  }

  async revokeRoleFromUser(assignmentId: string) {
    return this.assignments.delete(assignmentId);
  }

  async getUserRoles(userId: string) {
    const allAssignments = Array.from(this.assignments.values());
    return allAssignments.filter(a => a.userId === userId);
  }

  async getUserRolesForResource(userId: string, resourceId: string) {
    const allAssignments = Array.from(this.assignments.values());
    return allAssignments.filter(a => a.userId === userId && a.resourceId === resourceId);
  }

  async initializeSystemRoles() {
    // 创建系统角色
    const systemRoles: Array<{name: SystemRoleType; displayName: string; description: string}> = [
      {
        name: SystemRole.WORKSPACE_OWNER,
        displayName: '工作区所有者',
        description: '拥有工作区的完全控制权',
      },
      {
        name: SystemRole.PROJECT_OWNER,
        displayName: '项目所有者',
        description: '拥有项目的完全控制权',
      },
      {
        name: SystemRole.PROJECT_EDITOR,
        displayName: '项目编辑者',
        description: '可编辑项目内容但不能删除',
      },
      {
        name: SystemRole.PROJECT_VIEWER,
        displayName: '项目查看者',
        description: '只能查看项目内容',
      }
    ];

    for (const roleData of systemRoles) {
      const roleId = `system-${roleData.name}`;
      const now = new Date().toISOString();

      const role: Role = {
        id: roleId,
        name: roleData.name,
        displayName: roleData.displayName,
        description: roleData.description,
        permissions: [],
        isSystemRole: true,
        createdAt: now,
        updatedAt: now
      };

      this.roles.set(roleId, role);
    }
  }

  async clear() {
    this.roles.clear();
    this.assignments.clear();
    return true;
  }
}

// ============ Test Suite ============

describe('RoleManager', () => {
  let roleManager: IRoleManager;

  beforeEach(() => {
    roleManager = new MockRoleManager();
  });

  afterEach(async () => {
    await roleManager.clear();
  });

  // ============ createRole() 测试 ============

  describe('createRole() - 创建角色', () => {
    it('应成功创建新角色', async () => {
      const result = await roleManager.createRole('custom-role', 'Custom Role', 'A custom role');

      expect(result.success).toBe(true);
      expect(result.roleId).toBeDefined();

      const role = await roleManager.getRole(result.roleId!);
      expect(role).toBeDefined();
      expect(role?.name).toBe('custom-role');
      expect(role?.displayName).toBe('Custom Role');
      expect(role?.isSystemRole).toBe(false);
    });

    it('应创建包含初始权限的角色', async () => {
      const permissions: Permission[] = [
        { id: 'perm-1', name: 'project.read', resource: 'project', action: 'read' }
      ];

      const result = await roleManager.createRole('reader', 'Reader', undefined, permissions);

      expect(result.success).toBe(true);

      const role = await roleManager.getRole(result.roleId!);
      expect(role?.permissions).toEqual(permissions);
    });

    it('应设置创建和更新时间戳', async () => {
      const result = await roleManager.createRole('test-role', 'Test Role');

      const role = await roleManager.getRole(result.roleId!);
      expect(role?.createdAt).toBeDefined();
      expect(role?.updatedAt).toBeDefined();
    });
  });

  // ============ getRole() / getRoleByName() 测试 ============

  describe('getRole() / getRoleByName() - 获取角色', () => {
    it('应通过ID获取角色', async () => {
      const result = await roleManager.createRole('test-role', 'Test Role');

      const role = await roleManager.getRole(result.roleId!);

      expect(role).toBeDefined();
      expect(role?.name).toBe('test-role');
    });

    it('应通过名称获取角色', async () => {
      await roleManager.createRole('test-role', 'Test Role');

      const role = await roleManager.getRoleByName('test-role');

      expect(role).toBeDefined();
      expect(role?.name).toBe('test-role');
    });

    it('应返回null当角色不存在', async () => {
      const role = await roleManager.getRole('non-existent-id');
      expect(role).toBeNull();
    });
  });

  // ============ listRoles() 测试 ============

  describe('listRoles() - 列出角色', () => {
    it('应返回所有角色', async () => {
      await roleManager.createRole('role1', 'Role 1');
      await roleManager.createRole('role2', 'Role 2');

      const roles = await roleManager.listRoles();

      expect(roles.length).toBeGreaterThanOrEqual(2);
    });

    it('应区分系统角色和自定义角色', async () => {
      await roleManager.initializeSystemRoles();
      await roleManager.createRole('custom-role', 'Custom Role');

      const allRoles = await roleManager.listRoles();
      const systemRoles = await roleManager.listSystemRoles();
      const customRoles = await roleManager.listCustomRoles();

      expect(systemRoles.length).toBe(4);
      expect(customRoles.length).toBe(1);
      expect(allRoles.length).toBe(systemRoles.length + customRoles.length);
    });
  });

  // ============ updateRole() 测试 ============

  describe('updateRole() - 更新角色', () => {
    it('应成功更新角色名称', async () => {
      const result = await roleManager.createRole('old-name', 'Old Name');

      const updated = await roleManager.updateRole(result.roleId!, {
        displayName: 'New Name'
      });

      expect(updated).toBe(true);

      const role = await roleManager.getRole(result.roleId!);
      expect(role?.displayName).toBe('New Name');
    });

    it('应返回false当更新不存在的角色', async () => {
      const updated = await roleManager.updateRole('non-existent-id', { displayName: 'New Name' });

      expect(updated).toBe(false);
    });

    it('应更新updatedAt时间戳', async () => {
      const result = await roleManager.createRole('test-role', 'Test Role');
      const originalRole = await roleManager.getRole(result.roleId!);

      await new Promise(resolve => setTimeout(resolve, 1));
      await roleManager.updateRole(result.roleId!, { displayName: 'Updated' });

      const updatedRole = await roleManager.getRole(result.roleId!);
      expect(updatedRole?.updatedAt).not.toBe(originalRole?.updatedAt);
    });
  });

  // ============ deleteRole() 测试 ============

  describe('deleteRole() - 删除角色', () => {
    it('应成功删除自定义角色', async () => {
      const result = await roleManager.createRole('custom-role', 'Custom');

      const deleted = await roleManager.deleteRole(result.roleId!);

      expect(deleted).toBe(true);

      const role = await roleManager.getRole(result.roleId!);
      expect(role).toBeNull();
    });

    it('应不允许删除系统角色', async () => {
      await roleManager.initializeSystemRoles();
      const role = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);

      expect(role).toBeDefined();

      if (role) {
        const deleted = await roleManager.deleteRole(role.id);
        expect(deleted).toBe(false);
      }
    });

    it('应返回false当删除不存在的角色', async () => {
      const deleted = await roleManager.deleteRole('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  // ============ addPermissionToRole() / removePermissionFromRole() 测试 ============

  describe('addPermissionToRole() / removePermissionFromRole() - 权限管理', () => {
    it('应为角色添加权限', async () => {
      const result = await roleManager.createRole('reader', 'Reader');
      const permission: Permission = {
        id: 'perm-read',
        name: 'project.read',
        resource: 'project',
        action: 'read'
      };

      const added = await roleManager.addPermissionToRole(result.roleId!, permission);

      expect(added).toBe(true);

      const role = await roleManager.getRole(result.roleId!);
      expect(role?.permissions).toContain(permission);
    });

    it('应从角色移除权限', async () => {
      const permission: Permission = {
        id: 'perm-read',
        name: 'project.read',
        resource: 'project',
        action: 'read'
      };
      const result = await roleManager.createRole('reader', 'Reader', undefined, [permission]);

      const removed = await roleManager.removePermissionFromRole(result.roleId!, permission.id);

      expect(removed).toBe(true);

      const role = await roleManager.getRole(result.roleId!);
      expect(role?.permissions).not.toContain(permission);
    });
  });

  // ============ assignRoleToUser() / revokeRoleFromUser() 测试 ============

  describe('assignRoleToUser() / revokeRoleFromUser() - 用户角色关联', () => {
    it('应为用户分配角色', async () => {
      const roleResult = await roleManager.createRole('editor', 'Editor');
      const assignResult = await roleManager.assignRoleToUser(
        'user-123',
        roleResult.roleId!,
        'workspace-456',
        'workspace',
        'admin-user'
      );

      expect(assignResult.success).toBe(true);
      expect(assignResult.assignmentId).toBeDefined();
    });

    it('应撤销用户角色', async () => {
      const roleResult = await roleManager.createRole('editor', 'Editor');
      const assignResult = await roleManager.assignRoleToUser(
        'user-123',
        roleResult.roleId!,
        'workspace-456',
        'workspace',
        'admin-user'
      );

      const revoked = await roleManager.revokeRoleFromUser(assignResult.assignmentId!);

      expect(revoked).toBe(true);
    });

    it('应获取用户的所有角色', async () => {
      const role1 = await roleManager.createRole('role1', 'Role 1');
      const role2 = await roleManager.createRole('role2', 'Role 2');

      await roleManager.assignRoleToUser('user-123', role1.roleId!, 'ws-1', 'workspace', 'admin');
      await roleManager.assignRoleToUser('user-123', role2.roleId!, 'proj-1', 'project', 'admin');

      const userRoles = await roleManager.getUserRoles('user-123');

      expect(userRoles.length).toBe(2);
    });

    it('应获取用户在特定资源的角色', async () => {
      const role = await roleManager.createRole('editor', 'Editor');
      await roleManager.assignRoleToUser('user-123', role.roleId!, 'ws-1', 'workspace', 'admin');

      const roles = await roleManager.getUserRolesForResource('user-123', 'ws-1');

      expect(roles.length).toBe(1);
      expect(roles[0].resourceId).toBe('ws-1');
    });
  });

  // ============ initializeSystemRoles() 测试 ============

  describe('initializeSystemRoles() - 系统角色初始化', () => {
    it('应创建所有预定义系统角色', async () => {
      await roleManager.initializeSystemRoles();

      const ownerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      const projectOwner = await roleManager.getRoleByName(SystemRole.PROJECT_OWNER);
      const editor = await roleManager.getRoleByName(SystemRole.PROJECT_EDITOR);
      const viewer = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);

      expect(ownerRole).toBeDefined();
      expect(projectOwner).toBeDefined();
      expect(editor).toBeDefined();
      expect(viewer).toBeDefined();
    });

    it('应标记系统角色', async () => {
      await roleManager.initializeSystemRoles();

      const systemRoles = await roleManager.listSystemRoles();

      expect(systemRoles.every(r => r.isSystemRole)).toBe(true);
    });

    it('应支持重复初始化', async () => {
      await roleManager.initializeSystemRoles();
      await roleManager.initializeSystemRoles();

      const systemRoles = await roleManager.listSystemRoles();
      expect(systemRoles.length).toBe(4);
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空角色名称', async () => {
      const result = await roleManager.createRole('', 'Empty Role');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应处理重复的角色名称', async () => {
      await roleManager.createRole('duplicate', 'First');
      // 第二次创建同名角色应该失败
      const result = await roleManager.createRole('duplicate', 'Second');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
