/**
 * DevFlow v5 - 工作区上下文类型定义
 *
 * 职责：定义工作区相关的数据类型和状态结构
 */

import { WorkspaceMetadata, WorkspaceConfig } from './IWorkspaceManager';
import { ProjectMetadata } from './IProjectRegistry';

// ============ 扩展 ProjectContext ============

/**
 * 工作区元信息（用于扩展 ProjectContext）
 */
export interface WorkspaceMeta {
  /** 所属工作区ID（可选，单项目模式为空） */
  workspaceId?: string;
  /** 工作区名称 */
  workspaceName?: string;
  /** 是否启用工作区模式 */
  workspaceEnabled: boolean;
  /** 工作区配置快照 */
  workspaceConfig?: WorkspaceConfig;
  /** 关联项目ID列表 */
  relatedProjectIds?: string[];
}

// ============ 工作区项目关联 ============

/**
 * 工作区项目关联信息
 */
export interface WorkspaceProjectRelation {
  /** 工作区ID */
  workspaceId: string;
  /** 项目ID */
  projectId: string;
  /** 关联类型 */
  relationType: 'primary' | 'secondary' | 'dependency';
  /** 关联时间 */
  associatedAt: string;
  /** 关联元数据 */
  metadata?: Record<string, any>;
}

// ============ 工作区统计信息 ============

/**
 * 工作区统计信息
 */
export interface WorkspaceStats {
  /** 工作区ID */
  workspaceId: string;
  /** 项目总数 */
  totalProjects: number;
  /** 激活项目数 */
  activeProjects: number;
  /** 总故事数 */
  totalStories: number;
  /** 完成故事数 */
  completedStories: number;
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功执行次数 */
  successfulExecutions: number;
  /** 失败执行次数 */
  failedExecutions: number;
  /** 最后更新时间 */
  lastUpdated: string;
}

// ============ 跨项目操作类型 ============

/**
 * 跨项目操作类型
 */
export type MultiProjectOperationType =
  | 'batch-story-execution'
  | 'cross-project-refactor'
  | 'shared-asset-update'
  | 'workspace-config-sync'
  | 'aggregate-report';

/**
 * 跨项目操作状态
 */
export type MultiProjectOperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial';

/**
 * 跨项目操作结果
 */
export interface MultiProjectOperationResult {
  /** 操作ID */
  operationId: string;
  /** 操作类型 */
  operationType: MultiProjectOperationType;
  /** 工作区ID */
  workspaceId: string;
  /** 涉及的项目ID列表 */
  projectIds: string[];
  /** 操作状态 */
  status: MultiProjectOperationStatus;
  /** 开始时间 */
  startTime: string;
  /** 结束时间（可选） */
  endTime?: string;
  /** 每个项目的执行结果 */
  projectResults: Map<string, {
    /** 项目ID */
    projectId: string;
    /** 是否成功 */
    success: boolean;
    /** 错误信息（失败时） */
    error?: string;
    /** 执行数据 */
    data?: any;
  }>;
  /** 总体错误信息（可选） */
  error?: string;
}
