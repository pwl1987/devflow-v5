/**
 * DevFlow v5 - 项目注册表实现
 *
 * 职责：管理项目注册信息，提供项目查询和管理能力
 *
 * SOLID 原则：
 * - 单一职责：仅负责项目注册和查询
 * - 依赖倒置：实现 IProjectRegistry 接口
 */

import type {
  IProjectRegistry,
  ProjectMetadata,
  ProjectRegistrationResult
} from './IProjectRegistry';

// ============ ProjectRegistry 实现 ============

/**
 * 项目注册表实现
 *
 * 使用内存存储（Map）来管理项目信息
 * 项目ID使用 UUID 生成
 * 项目路径作为唯一键
 */
export class ProjectRegistry implements IProjectRegistry {
  // 项目存储：按 ID 索引
  private projects: Map<string, ProjectMetadata> = new Map();
  // 路径索引：快速查找项目
  private pathIndex: Map<string, string> = new Map();

  /**
   * 注册新项目
   */
  async registerProject(
    rootPath: string,
    name?: string,
    description?: string,
    tags?: string[]
  ): Promise<ProjectRegistrationResult> {
    // 验证输入 - 路径不能为空
    if (!rootPath || rootPath.trim() === '') {
      return {
        success: false,
        error: 'Project root path cannot be empty'
      };
    }

    // 标准化路径
    const normalizedPath = this.normalizePath(rootPath);

    // 再次验证标准化后的路径
    if (normalizedPath === '' || normalizedPath === '/' || normalizedPath === '.') {
      return {
        success: false,
        error: 'Project root path is invalid'
      };
    }

    // 检查路径是否已注册
    if (this.pathIndex.has(normalizedPath)) {
      return {
        success: false,
        error: `Project at path '${normalizedPath}' is already registered`
      };
    }

    // 生成项目ID
    const projectId = this.generateId();

    // 确定项目名称
    const projectName = name && name.trim() !== '' ? name : this.extractNameFromPath(normalizedPath);

    // 验证名称
    if (!projectName || projectName.trim() === '') {
      return {
        success: false,
        error: 'Project name cannot be empty'
      };
    }

    // 创建项目元数据
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

    // 存储项目信息
    this.projects.set(projectId, metadata);
    this.pathIndex.set(normalizedPath, projectId);

    return {
      success: true,
      metadata
    };
  }

  /**
   * 获取项目元数据
   */
  async getProject(projectId: string): Promise<ProjectMetadata | null> {
    return this.projects.get(projectId) || null;
  }

  /**
   * 通过路径获取项目
   */
  async getProjectByPath(rootPath: string): Promise<ProjectMetadata | null> {
    const normalizedPath = this.normalizePath(rootPath);
    const projectId = this.pathIndex.get(normalizedPath);

    if (!projectId) {
      return null;
    }

    return this.projects.get(projectId) || null;
  }

  /**
   * 列出所有项目
   */
  async listProjects(): Promise<ProjectMetadata[]> {
    return Array.from(this.projects.values());
  }

  /**
   * 列出所有激活的项目
   */
  async listActiveProjects(): Promise<ProjectMetadata[]> {
    const allProjects = Array.from(this.projects.values());
    return allProjects.filter(p => p.active);
  }

  /**
   * 移除项目
   */
  async removeProject(projectId: string): Promise<boolean> {
    const metadata = this.projects.get(projectId);

    if (!metadata) {
      return false;
    }

    // 从索引中移除
    this.pathIndex.delete(metadata.rootPath);
    this.projects.delete(projectId);

    return true;
  }

  /**
   * 通过路径移除项目
   */
  async removeProjectByPath(rootPath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(rootPath);
    const projectId = this.pathIndex.get(normalizedPath);

    if (!projectId) {
      return false;
    }

    return this.removeProject(projectId);
  }

  /**
   * 检查项目是否存在
   */
  async hasProject(projectId: string): Promise<boolean> {
    return this.projects.has(projectId);
  }

  /**
   * 检查路径是否已注册
   */
  async hasPath(rootPath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(rootPath);
    return this.pathIndex.has(normalizedPath);
  }

  /**
   * 更新项目元数据
   */
  async updateProject(
    projectId: string,
    updates: Partial<Omit<ProjectMetadata, 'id' | 'rootPath' | 'createdAt'>>
  ): Promise<boolean> {
    const metadata = this.projects.get(projectId);

    if (!metadata) {
      return false;
    }

    // 更新元数据
    const updatedMetadata: ProjectMetadata = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.projects.set(projectId, updatedMetadata);

    return true;
  }

  /**
   * 获取项目总数
   */
  async getProjectCount(): Promise<number> {
    return this.projects.size;
  }

  /**
   * 清空所有项目
   */
  async clear(): Promise<boolean> {
    this.projects.clear();
    this.pathIndex.clear();
    return true;
  }

  // ============ 私有辅助方法 ============

  /**
   * 标准化路径
   */
  private normalizePath(path: string): string {
    return path.trim();
  }

  /**
   * 从路径中提取项目名称
   */
  private extractNameFromPath(path: string): string {
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];

    // 处理 Windows 路径
    if (lastPart.includes('\\')) {
      const windowsParts = lastPart.split('\\');
      return windowsParts[windowsParts.length - 1];
    }

    return lastPart || 'unnamed-project';
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
