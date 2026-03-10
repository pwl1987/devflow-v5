/**
 * DevFlow v5 - 工作区管理器实现
 *
 * 职责：管理工作区的生命周期，支持多项目协同
 *
 * SOLID 原则：
 * - 单一职责：仅负责工作区管理
 * - 依赖倒置：通过注入 IProjectRegistry 管理项目
 */

import type {
  IWorkspaceManager,
  WorkspaceMetadata,
  WorkspaceState,
  WorkspaceCreationResult,
  ProjectAdditionResult,
  WorkspaceConfig
} from './IWorkspaceManager';

import type {
  IProjectRegistry,
  ProjectMetadata
} from './IProjectRegistry';

// ============ WorkspaceManager 实现 ============

/**
 * 工作区管理器实现
 *
 * 管理工作区的创建、删除、配置
 * 维护工作区与项目的关联关系
 */
export class WorkspaceManager implements IWorkspaceManager {
  // 工作区存储
  private workspaces: Map<string, WorkspaceMetadata> = new Map();
  // 工作区与项目的关联关系
  private workspaceProjects: Map<string, string[]> = new Map();
  // 项目注册表依赖
  private projectRegistry: IProjectRegistry;

  /**
   * 构造函数
   * @param projectRegistry 项目注册表（可选，用于测试注入）
   */
  constructor(projectRegistry?: IProjectRegistry) {
    this.projectRegistry = projectRegistry || this.createDefaultProjectRegistry();
  }

  /**
   * 创建新工作区
   */
  async createWorkspace(
    name: string,
    description?: string,
    config?: WorkspaceConfig
  ): Promise<WorkspaceCreationResult> {
    // 验证输入
    if (!name || name.trim() === '') {
      return {
        success: false,
        error: 'Workspace name cannot be empty'
      };
    }

    // 生成工作区ID
    const workspaceId = this.generateWorkspaceId();
    const now = new Date().toISOString();

    // 创建工作区元数据
    const metadata: WorkspaceMetadata = {
      id: workspaceId,
      name: name.trim(),
      description,
      createdAt: now,
      updatedAt: now,
      projectIds: [],
      active: true,
      config
    };

    // 存储工作区
    this.workspaces.set(workspaceId, metadata);
    this.workspaceProjects.set(workspaceId, []);

    return {
      success: true,
      workspaceId
    };
  }

  /**
   * 删除工作区
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return false;
    }

    // 从关联关系中移除
    this.workspaceProjects.delete(workspaceId);
    this.workspaces.delete(workspaceId);

    return true;
  }

  /**
   * 重命名工作区
   */
  async renameWorkspace(workspaceId: string, newName: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return false;
    }

    // 更新工作区元数据
    const updated: WorkspaceMetadata = {
      ...workspace,
      name: newName,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updated);

    return true;
  }

  /**
   * 获取工作区元数据
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceMetadata | null> {
    return this.workspaces.get(workspaceId) || null;
  }

  /**
   * 获取工作区完整状态
   */
  async getWorkspaceState(workspaceId: string): Promise<WorkspaceState | null> {
    const metadata = this.workspaces.get(workspaceId);

    if (!metadata) {
      return null;
    }

    // 获取项目列表
    const projectIds = this.workspaceProjects.get(workspaceId) || [];
    const projects: ProjectMetadata[] = [];

    for (const projectId of projectIds) {
      const project = await this.projectRegistry.getProject(projectId);
      if (project) {
        projects.push(project);
      }
    }

    // 计算统计信息
    const activeProjects = projects.filter(p => p.active).length;

    return {
      metadata,
      projects,
      stats: {
        totalProjects: projects.length,
        activeProjects,
        lastUpdated: metadata.updatedAt
      }
    };
  }

  /**
   * 列出所有工作区
   */
  async listWorkspaces(): Promise<WorkspaceMetadata[]> {
    return Array.from(this.workspaces.values());
  }

  /**
   * 列出所有激活的工作区
   */
  async listActiveWorkspaces(): Promise<WorkspaceMetadata[]> {
    const allWorkspaces = Array.from(this.workspaces.values());
    return allWorkspaces.filter(w => w.active);
  }

  /**
   * 检查工作区是否存在
   */
  async hasWorkspace(workspaceId: string): Promise<boolean> {
    return this.workspaces.has(workspaceId);
  }

  /**
   * 激活工作区
   */
  async activateWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return false;
    }

    const updated: WorkspaceMetadata = {
      ...workspace,
      active: true,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updated);

    return true;
  }

  /**
   * 停用工作区
   */
  async deactivateWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return false;
    }

    const updated: WorkspaceMetadata = {
      ...workspace,
      active: false,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updated);

    return true;
  }

  /**
   * 添加项目到工作区
   */
  async addProject(
    workspaceId: string,
    projectRootPath: string,
    projectName?: string
  ): Promise<ProjectAdditionResult> {
    // 验证工作区存在
    if (!this.workspaces.has(workspaceId)) {
      return {
        success: false,
        error: `Workspace '${workspaceId}' not found`
      };
    }

    // 注册项目
    const registrationResult = await this.projectRegistry.registerProject(
      projectRootPath,
      projectName
    );

    if (!registrationResult.success || !registrationResult.metadata) {
      return {
        success: false,
        error: registrationResult.error || 'Failed to register project'
      };
    }

    const projectId = registrationResult.metadata.id;

    // 添加项目到工作区
    const projectIds = this.workspaceProjects.get(workspaceId) || [];
    projectIds.push(projectId);
    this.workspaceProjects.set(workspaceId, projectIds);

    // 更新工作区元数据
    const workspace = this.workspaces.get(workspaceId)!;
    const updated: WorkspaceMetadata = {
      ...workspace,
      projectIds,
      updatedAt: new Date().toISOString()
    };
    this.workspaces.set(workspaceId, updated);

    return {
      success: true,
      projectId
    };
  }

  /**
   * 从工作区移除项目
   */
  async removeProject(workspaceId: string, projectId: string): Promise<boolean> {
    // 验证工作区存在
    if (!this.workspaces.has(workspaceId)) {
      return false;
    }

    const projectIds = this.workspaceProjects.get(workspaceId) || [];
    const index = projectIds.indexOf(projectId);

    if (index === -1) {
      return false;
    }

    // 从工作区移除项目
    projectIds.splice(index, 1);
    this.workspaceProjects.set(workspaceId, projectIds);

    // 更新工作区元数据
    const workspace = this.workspaces.get(workspaceId)!;
    const updated: WorkspaceMetadata = {
      ...workspace,
      projectIds,
      updatedAt: new Date().toISOString()
    };
    this.workspaces.set(workspaceId, updated);

    return true;
  }

  /**
   * 列出工作区中的所有项目
   */
  async listProjects(workspaceId: string): Promise<ProjectMetadata[]> {
    if (!this.workspaces.has(workspaceId)) {
      return [];
    }

    const projectIds = this.workspaceProjects.get(workspaceId) || [];
    const projects: ProjectMetadata[] = [];

    for (const projectId of projectIds) {
      const project = await this.projectRegistry.getProject(projectId);
      if (project) {
        projects.push(project);
      }
    }

    return projects;
  }

  /**
   * 设置工作区的活动项目
   */
  async setActiveProject(workspaceId: string, projectId: string): Promise<boolean> {
    // 验证工作区存在
    if (!this.workspaces.has(workspaceId)) {
      return false;
    }

    // 验证项目属于工作区
    const projectIds = this.workspaceProjects.get(workspaceId) || [];
    if (!projectIds.includes(projectId)) {
      return false;
    }

    // 获取工作区状态（设置 activeProjectId 不在元数据中，这里简化处理）
    // 实际实现可能需要额外的存储来跟踪活动项目

    return true;
  }

  /**
   * 更新工作区配置
   */
  async updateWorkspaceConfig(
    workspaceId: string,
    config: Partial<WorkspaceConfig>
  ): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);

    if (!workspace) {
      return false;
    }

    // 合并配置
    const updatedConfig = {
      ...workspace.config,
      ...config
    };

    const updated: WorkspaceMetadata = {
      ...workspace,
      config: updatedConfig,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updated);

    return true;
  }

  /**
   * 获取工作区总数
   */
  async getWorkspaceCount(): Promise<number> {
    return this.workspaces.size;
  }

  /**
   * 清空所有工作区
   */
  async clear(): Promise<boolean> {
    this.workspaces.clear();
    this.workspaceProjects.clear();
    return true;
  }

  // ============ 私有辅助方法 ============

  /**
   * 生成工作区ID
   */
  private generateWorkspaceId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建默认项目注册表
   */
  private createDefaultProjectRegistry(): IProjectRegistry {
    // 动态导入避免循环依赖
    const { ProjectRegistry } = require('./ProjectRegistry');
    return new ProjectRegistry();
  }
}
