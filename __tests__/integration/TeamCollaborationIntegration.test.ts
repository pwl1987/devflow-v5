/**
 * 团队协作集成测试
 *
 * 测试范围：
 * - 工作区创建与用户邀请
 * - 角色分配与权限检查
 * - 多项目权限管理
 * - 权限继承机制
 */

import { RoleManager, PermissionManager, IRoleManager, IPermissionManager, SystemRole, PermissionInheritance } from '../../core/permission';
import { WorkspaceManager, IWorkspaceManager } from '../../core/workspace';
import type { PermissionPolicy } from '../../core/permission';

describe('团队协作集成测试', () => {
  let roleManager: IRoleManager;
  let permissionManager: IPermissionManager;
  let workspaceManager: IWorkspaceManager;

  beforeEach(async () => {
    roleManager = new RoleManager();
    permissionManager = new PermissionManager(roleManager);
    workspaceManager = new WorkspaceManager();

    // 初始化系统角色
    await roleManager.initializeSystemRoles();
  });

  afterEach(async () => {
    await roleManager.clear();
    await permissionManager.clear();
    await workspaceManager.clear();
  });

  // ============ 工作区协作场景测试 ============

  describe('工作区协作场景', () => {
    it('应完成工作区创建和所有者角色分配', async () => {
      // 1. 创建工作区
      const workspaceResult = await workspaceManager.createWorkspace('My Workspace', 'A test workspace');
      expect(workspaceResult.success).toBe(true);
      const workspaceId = workspaceResult.workspaceId!;

      // 2. 获取工作区所有者角色
      const ownerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      expect(ownerRole).toBeDefined();

      // 3. 为用户分配工作区所有者角色
      const userId = 'user-owner-123';
      if (ownerRole) {
        const assignResult = await roleManager.assignRoleToUser(
          userId,
          ownerRole.id,
          workspaceId,
          'workspace',
          'system'
        );
        expect(assignResult.success).toBe(true);
      }

      // 4. 验证用户拥有工作区管理员权限
      const hasAdminPermission = await permissionManager.checkPermission(
        userId,
        'workspace',
        'admin',
        workspaceId
      );
      expect(hasAdminPermission.granted).toBe(true);
    });

    it('应支持多用户工作区协作', async () => {
      // 1. 创建工作区
      const workspaceResult = await workspaceManager.createWorkspace('Team Workspace');
      const workspaceId = workspaceResult.workspaceId!;

      // 2. 添加所有者
      const ownerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      const ownerId = 'user-owner';
      if (ownerRole) {
        await roleManager.assignRoleToUser(ownerId, ownerRole.id, workspaceId, 'workspace', 'system');
      }

      // 3. 添加工作区管理员
      const adminId = 'user-admin';
      // 假设有 WORKSPACE_ADMIN 角色，这里简化为使用 WORKSPACE_OWNER
      if (ownerRole) {
        await roleManager.assignRoleToUser(adminId, ownerRole.id, workspaceId, 'workspace', ownerId);
      }

      // 4. 验证两个用户都有权限
      const [ownerPerms, adminPerms] = await Promise.all([
        permissionManager.checkPermission(ownerId, 'workspace', 'read', workspaceId),
        permissionManager.checkPermission(adminId, 'workspace', 'read', workspaceId)
      ]);

      expect(ownerPerms.granted).toBe(true);
      expect(adminPerms.granted).toBe(true);
    });
  });

  // ============ 项目级权限管理测试 ============

  describe('项目级权限管理', () => {
    it('应支持项目角色分配', async () => {
      // 1. 创建工作区
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;

      // 2. 添加项目
      const projResult = await workspaceManager.addProject(workspaceId, '/path/to/project', 'My Project');
      const projectId = projResult.projectId!;

      // 3. 为用户分配项目所有者角色
      const ownerRole = await roleManager.getRoleByName(SystemRole.PROJECT_OWNER);
      const userId = 'user-project-owner';
      if (ownerRole) {
        await roleManager.assignRoleToUser(userId, ownerRole.id, projectId, 'project', 'workspace-admin');
      }

      // 4. 验证项目权限
      const canUpdate = await permissionManager.checkPermission(userId, 'project', 'update', projectId);
      expect(canUpdate.granted).toBe(true);

      const canDelete = await permissionManager.checkPermission(userId, 'project', 'delete', projectId);
      expect(canDelete.granted).toBe(true);
    });

    it('应区分项目编辑者和查看者权限', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;
      const projResult = await workspaceManager.addProject(workspaceId, '/path/to/project', 'Project');
      const projectId = projResult.projectId!;

      // 获取角色
      const editorRole = await roleManager.getRoleByName(SystemRole.PROJECT_EDITOR);
      const viewerRole = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);

      const editorId = 'user-editor';
      const viewerId = 'user-viewer';

      if (editorRole) {
        await roleManager.assignRoleToUser(editorId, editorRole.id, projectId, 'project', 'admin');
      }
      if (viewerRole) {
        await roleManager.assignRoleToUser(viewerId, viewerRole.id, projectId, 'project', 'admin');
      }

      // 编辑者可以更新但不能删除
      const editorCanUpdate = await permissionManager.checkPermission(editorId, 'project', 'update', projectId);
      const editorCanDelete = await permissionManager.checkPermission(editorId, 'project', 'delete', projectId);
      expect(editorCanUpdate.granted).toBe(true);
      expect(editorCanDelete.granted).toBe(false);

      // 查看者只能读取
      const viewerCanRead = await permissionManager.checkPermission(viewerId, 'project', 'read', projectId);
      const viewerCanUpdate = await permissionManager.checkPermission(viewerId, 'project', 'update', projectId);
      expect(viewerCanRead.granted).toBe(true);
      expect(viewerCanUpdate.granted).toBe(false);
    });
  });

  // ============ 权限继承测试 ============

  describe('权限继承机制', () => {
    it('应支持工作区权限继承到项目', async () => {
      // 1. 创建工作区和项目
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;
      const projResult = await workspaceManager.addProject(workspaceId, '/path/to/project', 'Project');
      const projectId = projResult.projectId!;

      // 2. 设置权限继承策略
      const policy: PermissionPolicy = {
        id: `policy-${projectId}`,
        resourceId: projectId,
        resourceType: 'project',
        inheritance: PermissionInheritance.WORKSPACE_TO_PROJECT
      };
      await permissionManager.setPermissionPolicy(policy);

      // 3. 用户只有工作区权限
      const wsOwnerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      const userId = 'user-ws-only';
      if (wsOwnerRole) {
        await roleManager.assignRoleToUser(userId, wsOwnerRole.id, workspaceId, 'workspace', 'system');
      }

      // 4. 验证工作区权限继承到项目
      const hasInheritedPermission = await permissionManager.checkPermission(userId, 'workspace', 'read', projectId);
      expect(hasInheritedPermission.granted).toBe(true);
    });

    it('应在继承策略为NONE时不继承权限', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;
      const projResult = await workspaceManager.addProject(workspaceId, '/path/to/project', 'Project');
      const projectId = projResult.projectId!;

      // 设置不继承策略
      const policy: PermissionPolicy = {
        id: `policy-${projectId}`,
        resourceId: projectId,
        resourceType: 'project',
        inheritance: PermissionInheritance.NONE
      };
      await permissionManager.setPermissionPolicy(policy);

      // 用户只有工作区权限
      const wsOwnerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      const userId = 'user-ws-only';
      if (wsOwnerRole) {
        await roleManager.assignRoleToUser(userId, wsOwnerRole.id, workspaceId, 'workspace', 'system');
      }

      // 不应该继承权限
      const hasPermission = await permissionManager.checkPermission(userId, 'project', 'read', projectId);
      expect(hasPermission.granted).toBe(false);
    });
  });

  // ============ 资源所有权测试 ============

  describe('资源所有权', () => {
    it('应授予资源所有者完全权限', async () => {
      const resourceId = 'story-123';
      const ownerId = 'user-owner';
      const otherUser = 'user-other';

      // 设置资源所有者
      permissionManager.setResourceOwner(resourceId, ownerId);

      // 所有者应该有权限
      const ownerPerms = await permissionManager.isOwner(ownerId, resourceId);
      expect(ownerPerms).toBe(true);

      // 其他用户不应该有所有权
      const otherPerms = await permissionManager.isOwner(otherUser, resourceId);
      expect(otherPerms).toBe(false);
    });

    it('应优先使用所有权而非角色权限', async () => {
      const resourceId = 'resource-123';
      const userId = 'user-owner';

      // 设置资源所有者
      permissionManager.setResourceOwner(resourceId, userId);

      // 即使用户没有任何角色，也应该有权限（因为是所有者）
      const hasPermission = await permissionManager.checkPermission(userId, 'resource', 'delete', resourceId);
      expect(hasPermission.granted).toBe(true);
    });
  });

  // ============ 复杂协作场景测试 ============

  describe('复杂协作场景', () => {
    it('应支持多项目多角色复杂权限配置', async () => {
      // 1. 创建工作区
      const wsResult = await workspaceManager.createWorkspace('Company Workspace');
      const workspaceId = wsResult.workspaceId!;

      // 2. 创建多个项目
      const proj1Result = await workspaceManager.addProject(workspaceId, '/path/to/proj1', 'Project Alpha');
      const proj2Result = await workspaceManager.addProject(workspaceId, '/path/to/proj2', 'Project Beta');
      const proj1Id = proj1Result.projectId!;
      const proj2Id = proj2Result.projectId!;

      // 3. 配置用户角色
      const projectOwnerRole = await roleManager.getRoleByName(SystemRole.PROJECT_OWNER);
      const projectEditorRole = await roleManager.getRoleByName(SystemRole.PROJECT_EDITOR);
      const projectViewerRole = await roleManager.getRoleByName(SystemRole.PROJECT_VIEWER);

      // 用户A: Project Alpha 所有者，Project Beta 查看者
      const userA = 'user-a';
      if (projectOwnerRole) {
        await roleManager.assignRoleToUser(userA, projectOwnerRole.id, proj1Id, 'project', 'admin');
      }
      if (projectViewerRole) {
        await roleManager.assignRoleToUser(userA, projectViewerRole.id, proj2Id, 'project', 'admin');
      }

      // 用户B: Project Beta 编辑者
      const userB = 'user-b';
      if (projectEditorRole) {
        await roleManager.assignRoleToUser(userB, projectEditorRole.id, proj2Id, 'project', 'admin');
      }

      // 4. 验证权限
      // 用户A可以删除Project Alpha但不能删除Project Beta
      const userA_DeleteAlpha = await permissionManager.checkPermission(userA, 'project', 'delete', proj1Id);
      const userA_DeleteBeta = await permissionManager.checkPermission(userA, 'project', 'delete', proj2Id);
      expect(userA_DeleteAlpha.granted).toBe(true);
      expect(userA_DeleteBeta.granted).toBe(false);

      // 用户B可以编辑Project Beta但不能访问Project Alpha
      const userB_UpdateBeta = await permissionManager.checkPermission(userB, 'project', 'update', proj2Id);
      const userB_ReadAlpha = await permissionManager.checkPermission(userB, 'project', 'read', proj1Id);
      expect(userB_UpdateBeta.granted).toBe(true);
      expect(userB_ReadAlpha.granted).toBe(false);
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理未初始化的系统角色', async () => {
      await roleManager.clear();

      const result = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      expect(result).toBeNull();
    });

    it('应处理重复的角色分配', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;

      const ownerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      const userId = 'user-test';

      if (ownerRole) {
        const result1 = await roleManager.assignRoleToUser(userId, ownerRole.id, workspaceId, 'workspace', 'admin');
        const result2 = await roleManager.assignRoleToUser(userId, ownerRole.id, workspaceId, 'workspace', 'admin');

        // 第二次分配应该失败（重复）
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(false);
      }
    });

    it('应处理删除不存在的角色分配', async () => {
      const result = await roleManager.revokeRoleFromUser('non-existent-assignment');
      expect(result).toBe(false);
    });
  });
});
