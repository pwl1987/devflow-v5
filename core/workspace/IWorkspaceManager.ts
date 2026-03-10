/**
 * DevFlow v5 - 工作区管理器接口
 *
 * 职责：管理工作区的生命周期，支持多项目协同
 *
 * SOLID 原则：
 * - 单一职责：仅负责工作区管理
 * - 接口隔离：专一的工作区管理接口
 * - 依赖倒置：高层模块依赖此抽象接口
 */

import { ProjectMetadata } from './IProjectRegistry';

// ============ 工作区元数据 ============

/**
 * 工作区元数据
 */
export interface WorkspaceMetadata {
  /** 工作区唯一标识符 */
  id: string;
  /** 工作区名称 */
  name: string;
  /** 工作区描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 包含的项目ID列表 */
  projectIds: string[];
  /** 是否激活 */
  active: boolean;
  /** 工作区配置 */
  config?: WorkspaceConfig;
}

// ============ 工作区配置 ============

/**
 * 工作区配置
 */
export interface WorkspaceConfig {
  /** 是否继承项目配置 */
  inheritProjectConfig?: boolean;
  /** 工作区级别的环境变量 */
  envVars?: Record<string, string>;
  /** 共享资产配置 */
  sharedAssets?: string[];
  /** 批量操作配置 */
  batchConfig?: {
    /** 最大并发数 */
    maxConcurrency?: number;
    /** 失败重试次数 */
    retryCount?: number;
  };
}

// ============ 工作区状态 ============

/**
 * 工作区状态
 */
export interface WorkspaceState {
  /** 工作区元数据 */
  metadata: WorkspaceMetadata;
  /** 包含的项目列表 */
  projects: ProjectMetadata[];
  /** 统计信息 */
  stats: {
    /** 项目总数 */
    totalProjects: number;
    /** 激活项目数 */
    activeProjects: number;
    /** 最后更新时间 */
    lastUpdated: string;
  };
}

// ============ 工作区操作结果 ============

/**
 * 工作区创建结果
 */
export interface WorkspaceCreationResult {
  /** 是否成功 */
  success: boolean;
  /** 工作区ID（成功时返回） */
  workspaceId?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

/**
 * 项目添加结果
 */
export interface ProjectAdditionResult {
  /** 是否成功 */
  success: boolean;
  /** 项目ID（成功时返回） */
  projectId?: string;
  /** 错误信息（失败时返回） */
  error?: string;
}

// ============ IWorkspaceManager 接口 ============

/**
 * 工作区管理器接口
 *
 * 功能：
 * - 创建/删除/重命名工作区
 * - 添加/移除项目
 * - 获取工作区状态
 * - 列出所有工作区
 * - 工作区存在性检查
 */
export interface IWorkspaceManager {
  /**
   * 创建新工作区
   * @param name 工作区名称
   * @param description 工作区描述（可选）
   * @param config 工作区配置（可选）
   * @returns 创建结果
   */
  createWorkspace(name: string, description?: string, config?: WorkspaceConfig): Promise<WorkspaceCreationResult>;

  /**
   * 删除工作区
   * @param workspaceId 工作区ID
   * @returns 是否成功
   */
  deleteWorkspace(workspaceId: string): Promise<boolean>;

  /**
   * 重命名工作区
   * @param workspaceId 工作区ID
   * @param newName 新名称
   * @returns 是否成功
   */
  renameWorkspace(workspaceId: string, newName: string): Promise<boolean>;

  /**
   * 获取工作区元数据
   * @param workspaceId 工作区ID
   * @returns 工作区元数据，不存在时返回 null
   */
  getWorkspace(workspaceId: string): Promise<WorkspaceMetadata | null>;

  /**
   * 获取工作区完整状态
   * @param workspaceId 工作区ID
   * @returns 工作区状态，不存在时返回 null
   */
  getWorkspaceState(workspaceId: string): Promise<WorkspaceState | null>;

  /**
   * 列出所有工作区
   * @returns 工作区元数据数组
   */
  listWorkspaces(): Promise<WorkspaceMetadata[]>;

  /**
   * 列出所有激活的工作区
   * @returns 激活的工作区元数据数组
   */
  listActiveWorkspaces(): Promise<WorkspaceMetadata[]>;

  /**
   * 检查工作区是否存在
   * @param workspaceId 工作区ID
   * @returns 是否存在
   */
  hasWorkspace(workspaceId: string): Promise<boolean>;

  /**
   * 激活工作区
   * @param workspaceId 工作区ID
   * @returns 是否成功
   */
  activateWorkspace(workspaceId: string): Promise<boolean>;

  /**
   * 停用工作区
   * @param workspaceId 工作区ID
   * @returns 是否成功
   */
  deactivateWorkspace(workspaceId: string): Promise<boolean>;

  /**
   * 添加项目到工作区
   * @param workspaceId 工作区ID
   * @param projectRootPath 项目根路径
   * @param projectName 项目名称（可选）
   * @returns 添加结果
   */
  addProject(workspaceId: string, projectRootPath: string, projectName?: string): Promise<ProjectAdditionResult>;

  /**
   * 从工作区移除项目
   * @param workspaceId 工作区ID
   * @param projectId 项目ID
   * @returns 是否成功
   */
  removeProject(workspaceId: string, projectId: string): Promise<boolean>;

  /**
   * 列出工作区中的所有项目
   * @param workspaceId 工作区ID
   * @returns 项目元数据数组
   */
  listProjects(workspaceId: string): Promise<ProjectMetadata[]>;

  /**
   * 设置工作区的活动项目
   * @param workspaceId 工作区ID
   * @param projectId 项目ID
   * @returns 是否成功
   */
  setActiveProject(workspaceId: string, projectId: string): Promise<boolean>;

  /**
   * 更新工作区配置
   * @param workspaceId 工作区ID
   * @param config 要更新的配置
   * @returns 是否成功
   */
  updateWorkspaceConfig(workspaceId: string, config: Partial<WorkspaceConfig>): Promise<boolean>;

  /**
   * 获取工作区总数
   * @returns 工作区总数
   */
  getWorkspaceCount(): Promise<number>;

  /**
   * 清空所有工作区（主要用于测试）
   * @returns 是否成功
   */
  clear(): Promise<boolean>;
}
