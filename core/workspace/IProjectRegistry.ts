/**
 * DevFlow v5 - 项目注册表接口
 *
 * 职责：管理项目注册信息，提供项目查询和管理能力
 *
 * SOLID 原则：
 * - 单一职责：仅负责项目注册和查询
 * - 接口隔离：专一的项目管理接口
 * - 依赖倒置：高层模块依赖此抽象接口
 */

import { ProjectContext } from '../state/ProjectContext';

// ============ 项目元数据 ============

/**
 * 项目元数据
 */
export interface ProjectMetadata {
  /** 项目唯一标识符 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目根路径（绝对路径） */
  rootPath: string;
  /** 项目描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 项目标签 */
  tags?: string[];
  /** 是否激活 */
  active: boolean;
}

// ============ 项目注册结果 ============

/**
 * 项目注册结果
 */
export interface ProjectRegistrationResult {
  /** 是否成功 */
  success: boolean;
  /** 项目元数据（成功时返回） */
  metadata?: ProjectMetadata;
  /** 错误信息（失败时返回） */
  error?: string;
}

// ============ IProjectRegistry 接口 ============

/**
 * 项目注册表接口
 *
 * 功能：
 * - 注册新项目
 * - 获取项目信息
 * - 列出所有项目
 * - 移除项目
 * - 检查项目存在性
 * - 更新项目元数据
 */
export interface IProjectRegistry {
  /**
   * 注册新项目
   * @param rootPath 项目根路径（绝对路径）
   * @param name 项目名称（可选，默认使用路径最后部分）
   * @param description 项目描述（可选）
   * @param tags 项目标签（可选）
   * @returns 注册结果
   */
  registerProject(rootPath: string, name?: string, description?: string, tags?: string[]): Promise<ProjectRegistrationResult>;

  /**
   * 获取项目元数据
   * @param projectId 项目ID
   * @returns 项目元数据，不存在时返回 null
   */
  getProject(projectId: string): Promise<ProjectMetadata | null>;

  /**
   * 通过路径获取项目
   * @param rootPath 项目根路径
   * @returns 项目元数据，不存在时返回 null
   */
  getProjectByPath(rootPath: string): Promise<ProjectMetadata | null>;

  /**
   * 列出所有已注册项目
   * @returns 项目元数据数组
   */
  listProjects(): Promise<ProjectMetadata[]>;

  /**
   * 列出所有激活的项目
   * @returns 激活的项目元数据数组
   */
  listActiveProjects(): Promise<ProjectMetadata[]>;

  /**
   * 移除项目
   * @param projectId 项目ID
   * @returns 是否成功
   */
  removeProject(projectId: string): Promise<boolean>;

  /**
   * 通过路径移除项目
   * @param rootPath 项目根路径
   * @returns 是否成功
   */
  removeProjectByPath(rootPath: string): Promise<boolean>;

  /**
   * 检查项目是否存在
   * @param projectId 项目ID
   * @returns 是否存在
   */
  hasProject(projectId: string): Promise<boolean>;

  /**
   * 检查路径是否已注册
   * @param rootPath 项目根路径
   * @returns 是否已注册
   */
  hasPath(rootPath: string): Promise<boolean>;

  /**
   * 更新项目元数据
   * @param projectId 项目ID
   * @param updates 要更新的字段
   * @returns 是否成功
   */
  updateProject(projectId: string, updates: Partial<Omit<ProjectMetadata, 'id' | 'rootPath' | 'createdAt'>>): Promise<boolean>;

  /**
   * 获取注册的项目总数
   * @returns 项目总数
   */
  getProjectCount(): Promise<number>;

  /**
   * 清空所有项目（主要用于测试）
   * @returns 是否成功
   */
  clear(): Promise<boolean>;
}
