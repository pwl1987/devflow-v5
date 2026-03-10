/**
 * WorkspaceManager 单元测试
 *
 * TDD 流程：RED → GREEN → IMPROVE
 *
 * 测试策略：
 * - Mock IProjectRegistry 依赖
 * - 测试工作区生命周期管理
 * - 测试项目添加/移除
 * - 测试边界条件和错误处理
 * - 验证向后兼容性
 */

import {
  IWorkspaceManager,
  IProjectRegistry,
  WorkspaceMetadata,
  WorkspaceState,
  WorkspaceCreationResult,
  ProjectAdditionResult,
  WorkspaceConfig,
  WorkspaceManager,
  ProjectRegistry,
  ProjectMetadata
} from '../../core/workspace';

// ============ Mock ProjectRegistry ============

class MockProjectRegistry implements IProjectRegistry {
  private projects: Map<string, ProjectMetadata> = new Map();
  private pathIndex: Map<string, string> = new Map();

  async registerProject(rootPath: string, name?: string, description?: string, tags?: string[]) {
    const normalizedPath = rootPath.trim();

    // 验证空路径
    if (!normalizedPath || normalizedPath === '' || normalizedPath === '/' || normalizedPath === '.') {
      return { success: false, error: 'Project root path is invalid' };
    }

    if (this.pathIndex.has(normalizedPath)) {
      return { success: false, error: 'Path already registered' };
    }

    const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const projectName = name?.trim() || normalizedPath.split('/').pop() || 'unnamed';
    const now = new Date().toISOString();

    const metadata: ProjectMetadata = {
      id: projectId,
      name: projectName,
      rootPath: normalizedPath,
      description,
      tags,
      createdAt: now,
      updatedAt: now,
      active: true
    };

    this.projects.set(projectId, metadata);
    this.pathIndex.set(normalizedPath, projectId);

    return { success: true, metadata };
  }

  async getProject(projectId: string) {
    return this.projects.get(projectId) || null;
  }

  async getProjectByPath(rootPath: string) {
    const normalizedPath = rootPath.trim();
    const projectId = this.pathIndex.get(normalizedPath);
    return projectId ? (this.projects.get(projectId) || null) : null;
  }

  async listProjects() {
    return Array.from(this.projects.values());
  }

  async listActiveProjects() {
    return Array.from(this.projects.values()).filter(p => p.active);
  }

  async removeProject(projectId: string) {
    const metadata = this.projects.get(projectId);
    if (!metadata) return false;

    this.pathIndex.delete(metadata.rootPath);
    this.projects.delete(projectId);
    return true;
  }

  async removeProjectByPath(rootPath: string) {
    const normalizedPath = rootPath.trim();
    const projectId = this.pathIndex.get(normalizedPath);
    if (!projectId) return false;
    return this.removeProject(projectId);
  }

  async hasProject(projectId: string) {
    return this.projects.has(projectId);
  }

  async hasPath(rootPath: string) {
    return this.pathIndex.has(rootPath.trim());
  }

  async updateProject(projectId: string, updates: any) {
    const metadata = this.projects.get(projectId);
    if (!metadata) return false;

    const updated = { ...metadata, ...updates, updatedAt: new Date().toISOString() };
    this.projects.set(projectId, updated);
    return true;
  }

  async getProjectCount() {
    return this.projects.size;
  }

  async clear() {
    this.projects.clear();
    this.pathIndex.clear();
    return true;
  }
}

// ============ Test Suite ============

describe('WorkspaceManager', () => {
  let manager: IWorkspaceManager;
  let mockRegistry: MockProjectRegistry;

  beforeEach(() => {
    mockRegistry = new MockProjectRegistry();
    manager = new WorkspaceManager(mockRegistry);
  });

  afterEach(async () => {
    await manager.clear();
    await mockRegistry.clear();
  });

  // ============ createWorkspace() 测试 ============

  describe('createWorkspace() - 创建工作区', () => {
    it('应成功创建新工作区并返回工作区ID', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      expect(result.success).toBe(true);
      expect(result.workspaceId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('应创建包含描述的工作区', async () => {
      const result = await manager.createWorkspace('TestWorkspace', 'A test workspace');

      expect(result.success).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.description).toBe('A test workspace');
    });

    it('应创建包含配置的工作区', async () => {
      const config: WorkspaceConfig = {
        inheritProjectConfig: true,
        envVars: { NODE_ENV: 'test' }
      };

      const result = await manager.createWorkspace('TestWorkspace', undefined, config);

      expect(result.success).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.config).toEqual(config);
    });

    it('应生成唯一的工作区ID', async () => {
      const result1 = await manager.createWorkspace('Workspace1');
      const result2 = await manager.createWorkspace('Workspace2');
      const result3 = await manager.createWorkspace('Workspace3');

      expect(result1.workspaceId).toBeDefined();
      expect(result2.workspaceId).toBeDefined();
      expect(result3.workspaceId).toBeDefined();

      const ids = new Set([result1.workspaceId, result2.workspaceId, result3.workspaceId]);
      expect(ids.size).toBe(3);
    });

    it('应设置初始状态为激活', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.active).toBe(true);
    });

    it('应初始化空项目列表', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      const state = await manager.getWorkspaceState(result.workspaceId!);
      expect(state?.projects).toEqual([]);
      expect(state?.stats.totalProjects).toBe(0);
    });
  });

  // ============ deleteWorkspace() 测试 ============

  describe('deleteWorkspace() - 删除工作区', () => {
    it('应成功删除已存在的工作区', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      const deleted = await manager.deleteWorkspace(result.workspaceId!);

      expect(deleted).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace).toBeNull();
    });

    it('应返回false当删除不存在的工作区', async () => {
      const deleted = await manager.deleteWorkspace('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('应删除工作区但不删除项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'TestProject');

      await manager.deleteWorkspace(workspaceResult.workspaceId!);

      // 项目应仍存在于注册表中
      const project = await mockRegistry.getProject(addResult.projectId!);
      expect(project).toBeDefined();
    });
  });

  // ============ renameWorkspace() 测试 ============

  describe('renameWorkspace() - 重命名工作区', () => {
    it('应成功重命名工作区', async () => {
      const result = await manager.createWorkspace('OldName');

      const renamed = await manager.renameWorkspace(result.workspaceId!, 'NewName');

      expect(renamed).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.name).toBe('NewName');
    });

    it('应返回false当重命名不存在的工作区', async () => {
      const renamed = await manager.renameWorkspace('non-existent-id', 'NewName');

      expect(renamed).toBe(false);
    });

    it('应更新updatedAt时间戳', async () => {
      const result = await manager.createWorkspace('TestWorkspace');
      const originalWorkspace = await manager.getWorkspace(result.workspaceId!);

      await new Promise(resolve => setTimeout(resolve, 3));
      await manager.renameWorkspace(result.workspaceId!, 'NewName');

      const renamedWorkspace = await manager.getWorkspace(result.workspaceId!);
      expect(renamedWorkspace?.updatedAt).not.toBe(originalWorkspace?.updatedAt);
    });
  });

  // ============ getWorkspace() 测试 ============

  describe('getWorkspace() - 获取工作区元数据', () => {
    it('应返回已创建的工作区元数据', async () => {
      const result = await manager.createWorkspace('TestWorkspace', 'Test description');

      const workspace = await manager.getWorkspace(result.workspaceId!);

      expect(workspace).toBeDefined();
      expect(workspace?.id).toBe(result.workspaceId);
      expect(workspace?.name).toBe('TestWorkspace');
      expect(workspace?.description).toBe('Test description');
      expect(workspace?.active).toBe(true);
    });

    it('应返回null当工作区不存在', async () => {
      const workspace = await manager.getWorkspace('non-existent-id');

      expect(workspace).toBeNull();
    });
  });

  // ============ getWorkspaceState() 测试 ============

  describe('getWorkspaceState() - 获取工作区状态', () => {
    it('应返回完整的工作区状态', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p1', 'Project1');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p2', 'Project2');

      const state = await manager.getWorkspaceState(workspaceResult.workspaceId!);

      expect(state).toBeDefined();
      expect(state?.metadata.name).toBe('TestWorkspace');
      expect(state?.projects.length).toBe(2);
      expect(state?.stats.totalProjects).toBe(2);
      expect(state?.stats.activeProjects).toBe(2);
    });

    it('应返回null当工作区不存在', async () => {
      const state = await manager.getWorkspaceState('non-existent-id');

      expect(state).toBeNull();
    });

    it('应包含最后更新时间', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const state = await manager.getWorkspaceState(workspaceResult.workspaceId!);

      expect(state?.stats.lastUpdated).toBeDefined();
    });
  });

  // ============ listWorkspaces() 测试 ============

  describe('listWorkspaces() - 列出所有工作区', () => {
    it('应返回空数组当没有工作区时', async () => {
      const workspaces = await manager.listWorkspaces();

      expect(workspaces).toEqual([]);
    });

    it('应返回所有已创建工作区', async () => {
      await manager.createWorkspace('Workspace1');
      await manager.createWorkspace('Workspace2');
      await manager.createWorkspace('Workspace3');

      const workspaces = await manager.listWorkspaces();

      expect(workspaces.length).toBe(3);
      expect(workspaces.map(w => w.name)).toEqual(['Workspace1', 'Workspace2', 'Workspace3']);
    });
  });

  // ============ listActiveWorkspaces() 测试 ============

  describe('listActiveWorkspaces() - 列出激活工作区', () => {
    it('应返回所有激活的工作区', async () => {
      await manager.createWorkspace('Workspace1');
      await manager.createWorkspace('Workspace2');

      const workspaces = await manager.listActiveWorkspaces();

      expect(workspaces.length).toBe(2);
      expect(workspaces.every(w => w.active)).toBe(true);
    });

    it('应不包含已停用的工作区', async () => {
      const result = await manager.createWorkspace('TestWorkspace');
      await manager.deactivateWorkspace(result.workspaceId!);

      const activeWorkspaces = await manager.listActiveWorkspaces();

      expect(activeWorkspaces.length).toBe(0);
    });
  });

  // ============ hasWorkspace() 测试 ============

  describe('hasWorkspace() - 检查工作区存在性', () => {
    it('应返回true当工作区存在', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      const exists = await manager.hasWorkspace(result.workspaceId!);

      expect(exists).toBe(true);
    });

    it('应返回false当工作区不存在', async () => {
      const exists = await manager.hasWorkspace('non-existent-id');

      expect(exists).toBe(false);
    });
  });

  // ============ activateWorkspace() / deactivateWorkspace() 测试 ============

  describe('activateWorkspace() / deactivateWorkspace() - 激活/停用工作区', () => {
    it('应成功激活工作区', async () => {
      const result = await manager.createWorkspace('TestWorkspace');
      await manager.deactivateWorkspace(result.workspaceId!);

      const activated = await manager.activateWorkspace(result.workspaceId!);

      expect(activated).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.active).toBe(true);
    });

    it('应成功停用工作区', async () => {
      const result = await manager.createWorkspace('TestWorkspace');

      const deactivated = await manager.deactivateWorkspace(result.workspaceId!);

      expect(deactivated).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.active).toBe(false);
    });

    it('应返回false当激活不存在的工作区', async () => {
      const activated = await manager.activateWorkspace('non-existent-id');

      expect(activated).toBe(false);
    });

    it('应返回false当停用不存在的工作区', async () => {
      const deactivated = await manager.deactivateWorkspace('non-existent-id');

      expect(deactivated).toBe(false);
    });
  });

  // ============ addProject() 测试 ============

  describe('addProject() - 添加项目到工作区', () => {
    it('应成功添加项目到工作区', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'TestProject');

      expect(addResult.success).toBe(true);
      expect(addResult.projectId).toBeDefined();
    });

    it('应使用路径最后部分作为项目名称', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/my-project');

      expect(addResult.success).toBe(true);

      const project = await mockRegistry.getProject(addResult.projectId!);
      expect(project?.name).toBe('my-project');
    });

    it('应拒绝添加已存在的路径', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'Project1');

      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'Project2');

      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('already');
    });

    it('应更新工作区的项目列表', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p1', 'Project1');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p2', 'Project2');

      const projects = await manager.listProjects(workspaceResult.workspaceId!);

      expect(projects.length).toBe(2);
      expect(projects.map(p => p.name)).toEqual(['Project1', 'Project2']);
    });

    it('应返回错误当工作区不存在', async () => {
      const addResult = await manager.addProject('non-existent-id', '/test/project', 'TestProject');

      expect(addResult.success).toBe(false);
      expect(addResult.error).toContain('not found');
    });
  });

  // ============ removeProject() 测试 ============

  describe('removeProject() - 从工作区移除项目', () => {
    it('应成功从工作区移除项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'TestProject');

      const removed = await manager.removeProject(workspaceResult.workspaceId!, addResult.projectId!);

      expect(removed).toBe(true);

      const projects = await manager.listProjects(workspaceResult.workspaceId!);
      expect(projects.length).toBe(0);
    });

    it('应返回false当移除不存在的项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const removed = await manager.removeProject(workspaceResult.workspaceId!, 'non-existent-project-id');

      expect(removed).toBe(false);
    });

    it('应返回false当工作区不存在', async () => {
      const removed = await manager.removeProject('non-existent-workspace-id', 'project-id');

      expect(removed).toBe(false);
    });
  });

  // ============ listProjects() 测试 ============

  describe('listProjects() - 列出工作区项目', () => {
    it('应返回空数组当工作区没有项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const projects = await manager.listProjects(workspaceResult.workspaceId!);

      expect(projects).toEqual([]);
    });

    it('应返回工作区所有项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p1', 'Project1');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p2', 'Project2');
      await manager.addProject(workspaceResult.workspaceId!, '/test/p3', 'Project3');

      const projects = await manager.listProjects(workspaceResult.workspaceId!);

      expect(projects.length).toBe(3);
    });
  });

  // ============ setActiveProject() 测试 ============

  describe('setActiveProject() - 设置活动项目', () => {
    it('应成功设置活动项目', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');
      const addResult = await manager.addProject(workspaceResult.workspaceId!, '/test/project', 'TestProject');

      const set = await manager.setActiveProject(workspaceResult.workspaceId!, addResult.projectId!);

      expect(set).toBe(true);
    });

    it('应返回false当项目不存在', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const set = await manager.setActiveProject(workspaceResult.workspaceId!, 'non-existent-project-id');

      expect(set).toBe(false);
    });
  });

  // ============ updateWorkspaceConfig() 测试 ============

  describe('updateWorkspaceConfig() - 更新工作区配置', () => {
    it('应成功更新工作区配置', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const updated = await manager.updateWorkspaceConfig(workspaceResult.workspaceId!, {
        inheritProjectConfig: false,
        envVars: { NODE_ENV: 'production' }
      });

      expect(updated).toBe(true);

      const workspace = await manager.getWorkspace(workspaceResult.workspaceId!);
      expect(workspace?.config?.inheritProjectConfig).toBe(false);
      expect(workspace?.config?.envVars).toEqual({ NODE_ENV: 'production' });
    });

    it('应合并配置而不是替换', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace', undefined, {
        inheritProjectConfig: true,
        envVars: { NODE_ENV: 'test' }
      });

      await manager.updateWorkspaceConfig(workspaceResult.workspaceId!, {
        envVars: { NODE_ENV: 'production' }
      });

      const workspace = await manager.getWorkspace(workspaceResult.workspaceId!);
      expect(workspace?.config?.inheritProjectConfig).toBe(true);
      expect(workspace?.config?.envVars).toEqual({ NODE_ENV: 'production' });
    });

    it('应返回false当工作区不存在', async () => {
      const updated = await manager.updateWorkspaceConfig('non-existent-id', { inheritProjectConfig: false });

      expect(updated).toBe(false);
    });
  });

  // ============ getWorkspaceCount() 测试 ============

  describe('getWorkspaceCount() - 获取工作区总数', () => {
    it('应返回0当没有工作区', async () => {
      const count = await manager.getWorkspaceCount();

      expect(count).toBe(0);
    });

    it('应返回正确的工作区数量', async () => {
      await manager.createWorkspace('W1');
      await manager.createWorkspace('W2');
      await manager.createWorkspace('W3');

      const count = await manager.getWorkspaceCount();

      expect(count).toBe(3);
    });

    it('应在删除工作区后更新计数', async () => {
      const result1 = await manager.createWorkspace('W1');
      await manager.createWorkspace('W2');
      await manager.createWorkspace('W3');

      await manager.deleteWorkspace(result1.workspaceId!);

      const count = await manager.getWorkspaceCount();

      expect(count).toBe(2);
    });
  });

  // ============ clear() 测试 ============

  describe('clear() - 清空所有工作区', () => {
    it('应清空所有工作区', async () => {
      await manager.createWorkspace('W1');
      await manager.createWorkspace('W2');
      await manager.createWorkspace('W3');

      const cleared = await manager.clear();

      expect(cleared).toBe(true);

      const count = await manager.getWorkspaceCount();
      expect(count).toBe(0);
    });

    it('应返回true当清空空工作区列表', async () => {
      const cleared = await manager.clear();

      expect(cleared).toBe(true);
    });
  });

  // ============ 向后兼容性测试 ============

  describe('向后兼容性', () => {
    it('应支持单独使用ProjectRegistry（无工作区模式）', async () => {
      const result = await mockRegistry.registerProject('/standalone/project', 'StandaloneProject');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空工作区名称', async () => {
      const result = await manager.createWorkspace('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应处理空项目路径', async () => {
      const workspaceResult = await manager.createWorkspace('TestWorkspace');

      const addResult = await manager.addProject(workspaceResult.workspaceId!, '', 'TestProject');

      // 空路径时，ProjectRegistry 会拒绝（返回错误）
      expect(addResult.success).toBe(false);
      expect(addResult.error).toBeDefined();
    });

    it('应处理特殊字符在名称中', async () => {
      const result = await manager.createWorkspace('Workspace-With-Special_Chars');

      expect(result.success).toBe(true);

      const workspace = await manager.getWorkspace(result.workspaceId!);
      expect(workspace?.name).toBe('Workspace-With-Special_Chars');
    });
  });
});
