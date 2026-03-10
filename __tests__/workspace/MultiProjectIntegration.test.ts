/**
 * 多项目集成测试
 *
 * 测试 WorkspaceManager + ProjectRegistry 的协同工作
 *
 * 测试场景：
 * - 创建工作区并添加多个项目
 * - 跨项目状态隔离验证
 * - 工作区级别的批量操作
 * - 向后兼容单项目模式
 * - 边界条件和错误处理
 */

import { WorkspaceManager, ProjectRegistry } from '../../core/workspace';

// ============ Test Suite ============

describe('多项目集成测试', () => {
  let workspaceManager: WorkspaceManager;
  let projectRegistry: ProjectRegistry;

  beforeEach(() => {
    projectRegistry = new ProjectRegistry();
    workspaceManager = new WorkspaceManager(projectRegistry);
  });

  afterEach(async () => {
    await workspaceManager.clear();
    await projectRegistry.clear();
  });

  // ============ 工作区创建与项目管理集成测试 ============

  describe('工作区创建与项目管理', () => {
    it('应创建工作区并添加多个项目', async () => {
      // 创建工作区
      const wsResult = await workspaceManager.createWorkspace('TestWorkspace');

      expect(wsResult.success).toBe(true);
      expect(wsResult.workspaceId).toBeDefined();

      // 添加项目
      const p1Result = await workspaceManager.addProject(wsResult.workspaceId!, '/test/project1', 'Project1');
      const p2Result = await workspaceManager.addProject(wsResult.workspaceId!, '/test/project2', 'Project2');
      const p3Result = await workspaceManager.addProject(wsResult.workspaceId!, '/test/project3', 'Project3');

      expect(p1Result.success).toBe(true);
      expect(p2Result.success).toBe(true);
      expect(p3Result.success).toBe(true);

      // 验证工作区状态
      const state = await workspaceManager.getWorkspaceState(wsResult.workspaceId!);

      expect(state?.projects.length).toBe(3);
      expect(state?.stats.totalProjects).toBe(3);
      expect(state?.stats.activeProjects).toBe(3);
    });

    it('应正确维护工作区与项目的关联关系', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace1');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p1', 'P1');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p2', 'P2');

      const projects = await workspaceManager.listProjects(wsResult.workspaceId!);

      expect(projects.length).toBe(2);
      expect(projects.map(p => p.name)).toEqual(['P1', 'P2']);
    });
  });

  // ============ 跨项目状态隔离验证 ============

  describe('跨项目状态隔离', () => {
    it('应隔离不同工作区的项目', async () => {
      // 创建两个工作区
      const ws1Result = await workspaceManager.createWorkspace('Workspace1');
      const ws2Result = await workspaceManager.createWorkspace('Workspace2');

      // 向不同工作区添加项目
      await workspaceManager.addProject(ws1Result.workspaceId!, '/test/shared-project', 'SharedProject');

      // 尝试向第二个工作区添加相同路径（应该失败）
      const addResult = await workspaceManager.addProject(ws2Result.workspaceId!, '/test/shared-project', 'SharedProject');

      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('already');
    });

    it('应支持同一项目在不同工作区（通过唯一路径）', async () => {
      const ws1Result = await workspaceManager.createWorkspace('Workspace1');
      const ws2Result = await workspaceManager.createWorkspace('Workspace2');

      // 添加不同路径的项目
      const p1Result = await workspaceManager.addProject(ws1Result.workspaceId!, '/test/workspace1-project', 'Project1');
      const p2Result = await workspaceManager.addProject(ws2Result.workspaceId!, '/test/workspace2-project', 'Project2');

      expect(p1Result.success).toBe(true);
      expect(p2Result.success).toBe(true);

      // 验证项目ID不同
      expect(p1Result.projectId).not.toBe(p2Result.projectId);
    });

    it('应保持项目注册表的唯一性约束', async () => {
      // 单独使用 ProjectRegistry 注册项目
      const standaloneResult = await projectRegistry.registerProject('/standalone/project', 'Standalone');

      expect(standaloneResult.success).toBe(true);

      // 创建工作区并尝试添加相同路径（应该失败）
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const addResult = await workspaceManager.addProject(wsResult.workspaceId!, '/standalone/project', 'Duplicate');

      expect(addResult.success).toBe(false);
    });
  });

  // ============ 工作区级别的批量操作 ============

  describe('工作区级别的批量操作', () => {
    it('应支持跨项目配置同步', async () => {
      const wsResult = await workspaceManager.createWorkspace('TestWorkspace');

      // 更新工作区配置
      const updated = await workspaceManager.updateWorkspaceConfig(wsResult.workspaceId!, {
        inheritProjectConfig: true,
        envVars: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com'
        },
        batchConfig: {
          maxConcurrency: 5,
          retryCount: 3
        }
      });

      expect(updated).toBe(true);

      const workspace = await workspaceManager.getWorkspace(wsResult.workspaceId!);
      expect(workspace?.config?.inheritProjectConfig).toBe(true);
      expect(workspace?.config?.envVars).toEqual({
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com'
      });
    });

    it('应支持配置合并而不是替换', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace', undefined, {
        envVars: { NODE_ENV: 'development' }
      });

      // 部分更新
      await workspaceManager.updateWorkspaceConfig(wsResult.workspaceId!, {
        envVars: { NODE_ENV: 'production' }
      });

      const workspace = await workspaceManager.getWorkspace(wsResult.workspaceId!);
      expect(workspace?.config?.envVars).toEqual({ NODE_ENV: 'production' });
    });

    it('应支持跨项目批量删除', async () => {
      const wsResult = await workspaceManager.createWorkspace('BatchWorkspace');

      // 添加多个项目
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p1', 'P1');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p2', 'P2');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p3', 'P3');

      // 批量删除项目
      const projects = await workspaceManager.listProjects(wsResult.workspaceId!);
      for (const project of projects) {
        await workspaceManager.removeProject(wsResult.workspaceId!, project.id);
      }

      const finalProjects = await workspaceManager.listProjects(wsResult.workspaceId!);
      expect(finalProjects.length).toBe(0);
    });
  });

  // ============ 向后兼容单项目模式 ============

  describe('向后兼容单项目模式', () => {
    it('应支持不使用工作区的单独项目注册', async () => {
      // 直接使用 ProjectRegistry
      const result = await projectRegistry.registerProject('/standalone/project', 'StandaloneProject');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();

      // 验证项目可以单独查询
      const metadata = await projectRegistry.getProject(result.metadata!.id);
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('StandaloneProject');
    });

    it('应允许单独使用 ProjectRegistry 管理项目', async () => {
      // 注册多个项目
      const p1 = await projectRegistry.registerProject('/standalone/p1', 'P1');
      const p2 = await projectRegistry.registerProject('/standalone/p2', 'P2');
      const p3 = await projectRegistry.registerProject('/standalone/p3', 'P3');

      expect(p1.success).toBe(true);
      expect(p2.success).toBe(true);
      expect(p3.success).toBe(true);

      // 列出所有项目
      const allProjects = await projectRegistry.listProjects();
      expect(allProjects.length).toBe(3);
    });

    it('应支持单项目模式与工作区模式并存', async () => {
      // 单项目模式
      const standaloneResult = await projectRegistry.registerProject('/standalone/project', 'Standalone');

      // 工作区模式
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      await workspaceManager.addProject(wsResult.workspaceId!, '/workspace/project', 'WorkspaceProject');

      // 两者应该独立存在
      expect(standaloneResult.success).toBe(true);
      expect(standaloneResult.metadata).toBeDefined();

      const workspaceProjects = await workspaceManager.listProjects(wsResult.workspaceId!);
      expect(workspaceProjects.length).toBe(1);
      expect(workspaceProjects[0].name).toBe('WorkspaceProject');

      // 验证全局项目计数
      const totalCount = await projectRegistry.getProjectCount();
      expect(totalCount).toBe(2);
    });
  });

  // ============ 边界条件和错误处理 ============

  describe('边界条件和错误处理', () => {
    it('应处理删除不存在的工作区', async () => {
      const deleted = await workspaceManager.deleteWorkspace('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('应处理向不存在的工作区添加项目', async () => {
      const addResult = await workspaceManager.addProject('non-existent-id', '/test/project', 'TestProject');

      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('not found');
    });

    it('应处理从不存在的工作区移除项目', async () => {
      const removed = await workspaceManager.removeProject('non-existent-id', 'project-id');

      expect(removed).toBe(false);
    });

    it('应处理获取不存在的工作区状态', async () => {
      const state = await workspaceManager.getWorkspaceState('non-existent-id');

      expect(state).toBeNull();
    });

    it('应处理重复激活/停用操作', async () => {
      const wsResult = await workspaceManager.createWorkspace('TestWorkspace');

      // 重复激活
      const activated1 = await workspaceManager.activateWorkspace(wsResult.workspaceId!);
      const activated2 = await workspaceManager.activateWorkspace(wsResult.workspaceId!);

      expect(activated1).toBe(true);
      expect(activated2).toBe(true);

      // 重复停用
      const deactivated1 = await workspaceManager.deactivateWorkspace(wsResult.workspaceId!);
      const deactivated2 = await workspaceManager.deactivateWorkspace(wsResult.workspaceId!);

      expect(deactivated1).toBe(true);
      expect(deactivated2).toBe(true);
    });

    it('应处理清空空的工作区列表', async () => {
      const cleared = await workspaceManager.clear();

      expect(cleared).toBe(true);
    });
  });

  // ============ 工作区生命周期管理 ============

  describe('工作区生命周期管理', () => {
    it('应正确更新工作区元数据的时间戳', async () => {
      const wsResult = await workspaceManager.createWorkspace('TestWorkspace');
      const originalWorkspace = await workspaceManager.getWorkspace(wsResult.workspaceId!);

      // 等待1毫秒确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      // 更新工作区
      await workspaceManager.renameWorkspace(wsResult.workspaceId!, 'NewName');

      const updatedWorkspace = await workspaceManager.getWorkspace(wsResult.workspaceId!);

      expect(updatedWorkspace?.updatedAt).not.toBe(originalWorkspace?.updatedAt);
    });

    it('应支持工作区的完整生命周期', async () => {
      // 1. 创建工作区
      const createResult = await workspaceManager.createWorkspace('LifecycleWorkspace');
      expect(createResult.success).toBe(true);

      // 2. 添加项目
      const addResult = await workspaceManager.addProject(createResult.workspaceId!, '/test/project', 'TestProject');
      expect(addResult.success).toBe(true);

      // 3. 停用工作区
      const deactivated = await workspaceManager.deactivateWorkspace(createResult.workspaceId!);
      expect(deactivated).toBe(true);

      // 4. 重新激活
      const activated = await workspaceManager.activateWorkspace(createResult.workspaceId!);
      expect(activated).toBe(true);

      // 5. 移除项目
      const removed = await workspaceManager.removeProject(createResult.workspaceId!, addResult.projectId!);
      expect(removed).toBe(true);

      // 6. 删除工作区
      const deleted = await workspaceManager.deleteWorkspace(createResult.workspaceId!);
      expect(deleted).toBe(true);

      // 7. 验证工作区已删除
      const workspace = await workspaceManager.getWorkspace(createResult.workspaceId!);
      expect(workspace).toBeNull();
    });
  });

  // ============ 统计信息验证 ============

  describe('统计信息验证', () => {
    it('应正确统计工作区和项目数量', async () => {
      // 创建多个工作区
      const ws1Result = await workspaceManager.createWorkspace('Workspace1');
      const ws2Result = await workspaceManager.createWorkspace('Workspace2');

      // 添加项目
      await workspaceManager.addProject(ws1Result.workspaceId!, '/test/p1', 'P1');
      await workspaceManager.addProject(ws1Result.workspaceId!, '/test/p2', 'P2');
      await workspaceManager.addProject(ws2Result.workspaceId!, '/test/p3', 'P3');

      // 统计工作区
      const wsCount = await workspaceManager.getWorkspaceCount();
      expect(wsCount).toBe(2);

      // 统计项目
      const projCount = await projectRegistry.getProjectCount();
      expect(projCount).toBe(3);
    });

    it('应在删除项目后更新统计', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p1', 'P1');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p2', 'P2');

      // 删除一个项目
      const projects = await workspaceManager.listProjects(wsResult.workspaceId!);
      await workspaceManager.removeProject(wsResult.workspaceId!, projects[0].id);

      const state = await workspaceManager.getWorkspaceState(wsResult.workspaceId!);
      expect(state?.stats.totalProjects).toBe(1);
    });

    it('应正确计算激活项目数', async () => {
      const wsResult = await workspaceManager.createWorkspace('Workspace');

      // 添加项目
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p1', 'P1');
      await workspaceManager.addProject(wsResult.workspaceId!, '/test/p2', 'P2');

      // 停用一个项目
      const projects = await workspaceManager.listProjects(wsResult.workspaceId!);
      await projectRegistry.updateProject(projects[0].id, { active: false });

      const state = await workspaceManager.getWorkspaceState(wsResult.workspaceId!);
      expect(state?.stats.activeProjects).toBe(1);
    });
  });
});
