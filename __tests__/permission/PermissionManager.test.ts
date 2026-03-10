/**
 * PermissionManager 单元测试
 *
 * TDD 流程：RED → GREEN → IMPROVE
 *
 * 测试策略：
 * - 使用实际的 RoleManager 实现
 * - 测试权限检查逻辑
 * - 测试资源所有者功能
 * - 测试权限继承策略
 */

import { PermissionManager, RoleManager, IPermissionManager, IRoleManager, Permission, PermissionInheritance, PermissionPolicy, SystemRole } from '../../core/permission';

// ============ Test Suite ============

describe('PermissionManager', () => {
  let permissionManager: IPermissionManager;
  let roleManager: IRoleManager;

  beforeEach(async () => {
    roleManager = new RoleManager();
    permissionManager = new PermissionManager(roleManager);
    await roleManager.initializeSystemRoles();
  });

  afterEach(async () => {
    await permissionManager.clear();
    await roleManager.clear();
  });

  // ============ checkPermission() 测试 ============

  describe('checkPermission() - 权限检查', () => {
    it('应授予资源所有者完全权限', async () => {
      permissionManager.setResourceOwner('resource-123', 'user-alice');

      const result = await permissionManager.checkPermission('user-alice', 'project', 'delete', 'resource-123');

      expect(result.granted).toBe(true);
      expect(result.permission).toBeDefined();
      expect(result.permission?.name).toBe('project.delete');
    });

    it('应拒绝非所有者的权限请求', async () => {
      permissionManager.setResourceOwner('resource-123', 'user-bob');

      const result = await permissionManager.checkPermission('user-alice', 'project', 'delete', 'resource-123');

      expect(result.granted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('应基于角色授予权限', async () => {
      const viewerRole = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);
      expect(viewerRole).toBeDefined();

      if (viewerRole) {
        await roleManager.assignRoleToUser('user-123', viewerRole.id, 'proj-456', 'project', 'admin');
      }

      const result = await permissionManager.checkPermission('user-123', 'project', 'read', 'proj-456');

      expect(result.granted).toBe(true);
    });

    it('应拒绝用户没有的权限', async () => {
      const viewerRole = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);
      expect(viewerRole).toBeDefined();

      if (viewerRole) {
        await roleManager.assignRoleToUser('user-123', viewerRole.id, 'proj-456', 'project', 'admin');
      }

      const result = await permissionManager.checkPermission('user-123', 'project', 'delete', 'proj-456');

      expect(result.granted).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  // ============ checkPermissions() 批量检查测试 ============

  describe('checkPermissions() - 批量权限检查', () => {
    beforeEach(async () => {
      const ownerRole = await roleManager.getRoleByName(SystemRole.PROJECT_OWNER);
      if (ownerRole) {
        await roleManager.assignRoleToUser('user-123', ownerRole.id, 'proj-456', 'project', 'admin');
      }
    });

    it('应批量检查多个权限', async () => {
      const checks = [
        { resource: 'project', action: 'read', resourceId: 'proj-456' },
        { resource: 'project', action: 'update', resourceId: 'proj-456' },
        { resource: 'project', action: 'delete', resourceId: 'proj-456' }
      ];

      const results = await permissionManager.checkPermissions('user-123', checks);

      expect(results.size).toBe(3);
      expect(results.get('project:read:proj-456')?.granted).toBe(true);
      expect(results.get('project:update:proj-456')?.granted).toBe(true);
      expect(results.get('project:delete:proj-456')?.granted).toBe(true);
    });

    it('应正确处理混合授权结果', async () => {
      const viewerRole = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);
      if (viewerRole) {
        await roleManager.assignRoleToUser('user-limited', viewerRole.id, 'proj-789', 'project', 'admin');
      }

      const checks = [
        { resource: 'project', action: 'read', resourceId: 'proj-789' },
        { resource: 'project', action: 'delete', resourceId: 'proj-789' }
      ];

      const results = await permissionManager.checkPermissions('user-limited', checks);

      expect(results.get('project:read:proj-789')?.granted).toBe(true);
      expect(results.get('project:delete:proj-789')?.granted).toBe(false);
    });
  });

  // ============ isOwner() 测试 ============

  describe('isOwner() - 资源所有者检查', () => {
    it('应正确识别资源所有者', async () => {
      permissionManager.setResourceOwner('resource-123', 'user-owner');

      const isOwner = await permissionManager.isOwner('user-owner', 'resource-123');

      expect(isOwner).toBe(true);
    });

    it('应拒绝非所有者', async () => {
      permissionManager.setResourceOwner('resource-123', 'user-owner');

      const isOwner = await permissionManager.isOwner('user-other', 'resource-123');

      expect(isOwner).toBe(false);
    });
  });

  // ============ getUserPermissions() 测试 ============

  describe('getUserPermissions() - 获取用户权限', () => {
    it('应聚合用户所有角色的权限', async () => {
      const ownerRole = await roleManager.getRoleByName(SystemRole.PROJECT_OWNER);
      if (ownerRole) {
        await roleManager.assignRoleToUser('user-123', ownerRole.id, 'proj-456', 'project', 'admin');
      }

      const permissions = await permissionManager.getUserPermissions('user-123', 'proj-456');

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'project')).toBe(true);
    });

    it('应返回空数组当用户没有角色', async () => {
      const permissions = await permissionManager.getUserPermissions('user-no-roles');

      expect(permissions).toEqual([]);
    });
  });

  // ============ 权限策略测试 ============

  describe('权限策略 - Permission Policy', () => {
    it('应设置和获取权限策略', async () => {
      const policy: PermissionPolicy = {
        id: 'policy-1',
        resourceId: 'workspace-123',
        resourceType: 'workspace',
        inheritance: PermissionInheritance.WORKSPACE_TO_PROJECT
      };

      await permissionManager.setPermissionPolicy(policy);

      const retrieved = await permissionManager.getPermissionPolicy('workspace-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.inheritance).toBe(PermissionInheritance.WORKSPACE_TO_PROJECT);
    });

    it('应返回null当策略不存在', async () => {
      const policy = await permissionManager.getPermissionPolicy('non-existent');
      expect(policy).toBeNull();
    });
  });

  // ============ 权限继承测试 ============

  describe('权限继承 - Permission Inheritance', () => {
    it('应支持工作区到项目权限继承', async () => {
      // 设置继承策略
      const policy: PermissionPolicy = {
        id: 'policy-1',
        resourceId: 'proj-456',
        resourceType: 'project',
        inheritance: PermissionInheritance.WORKSPACE_TO_PROJECT
      };
      await permissionManager.setPermissionPolicy(policy);

      // 分配工作区角色
      const wsOwnerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      if (wsOwnerRole) {
        await roleManager.assignRoleToUser('user-123', wsOwnerRole.id, 'ws-789', 'workspace', 'admin');
      }

      // 检查是否继承工作区权限
      const result = await permissionManager.checkPermission('user-123', 'workspace', 'read', 'proj-456');

      expect(result.granted).toBe(true);
    });

    it('应拒绝当继承策略为NONE', async () => {
      const policy: PermissionPolicy = {
        id: 'policy-1',
        resourceId: 'proj-456',
        resourceType: 'project',
        inheritance: PermissionInheritance.NONE
      };
      await permissionManager.setPermissionPolicy(policy);

      const result = await permissionManager.checkPermission('user-123', 'project', 'read', 'proj-456');

      expect(result.granted).toBe(false);
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空用户ID', async () => {
      const result = await permissionManager.checkPermission('', 'project', 'read');
      expect(result.granted).toBe(false);
    });

    it('应处理未初始化的系统角色', async () => {
      await roleManager.clear();
      const result = await permissionManager.checkPermission('user-123', 'project', 'read');
      expect(result.granted).toBe(false);
    });
  });
});
