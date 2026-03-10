/**
 * DevFlow v5 - 标准化项目上下文数据模型
 *
 * 这是全局唯一的上下文数据结构标准，所有Skill必须遵循
 */

export interface ProjectContext {
  // ============ 基础元数据 ============
  meta: {
    project_name: string;
    project_type: 'greenfield' | 'brownfield' | 'mid-project';
    flow_mode: 'quick' | 'standard' | 'rigorous';
    created_at: string;
    updated_at: string;
    version: string;
  };

  // ============ 项目状态 ============
  status: {
    current_phase: Phase;
    current_story: string | null;
    last_story: string | null;
    completed_stories: string[];
    total_stories: number;
    progress_percentage: number;
  };

  // ============ 技术栈信息 ============
  tech_stack: TechStack;

  // ============ 核心资产（带版本锁定）============
  assets: {
    product_brief?: AssetInfo;
    prd?: AssetInfo;
    architecture?: AssetInfo;
    ux_design?: AssetInfo;
    stories?: AssetInfo;
  };

  // ============ Git信息 ============
  git: GitInfo;

  // ============ 执行历史 ============
  execution_history: ExecutionHistory;

  // ============ 批量处理状态 ============
  batch_state?: BatchState;

  // ============ 用户偏好 ============
  preferences?: Preferences;

  // ============ 工作区元信息（企业级特性）============
  workspace_meta?: WorkspaceMeta;
}

export type Phase =
  | 'idle'
  | 'analysis'
  | 'planning'
  | 'solutioning'
  | 'implementation'
  | 'completed';

export interface TechStack {
  frontend?: {
    framework: string;
    version: string;
    language: 'typescript' | 'javascript';
  };
  backend?: {
    framework: string;
    version: string;
    language: 'python' | 'javascript' | 'java' | 'go';
  };
  database?: string;
  test_framework?: string[];
  code_quality?: string[];
}

export interface AssetInfo {
  id: string;
  version: number;
  locked: boolean;
  file_path: string;
  created_at: string;
  created_by: string;
}

export interface GitInfo {
  remote_url?: string;
  branch?: string;
  last_commit?: string;
  uncommitted_changes: number;
}

export interface ExecutionHistory {
  last_skill_execution: string;
  last_execution_time: string;
  execution_count: number;
}

export interface BatchState {
  is_active: boolean;
  current_batch_index: number;
  total_batches: number;
  completed_stories_in_batch: number;
  on_failure_strategy: 'pause' | 'skip' | 'record';
}

export interface Preferences {
  auto_commit: boolean;
  test_coverage_threshold: number;
  code_quality_gate: boolean;
  notification_enabled: boolean;
  hooks?: HookConfig[];
}

export interface HookConfig {
  phase: HookPhase;
  command: string;
  run_condition?: 'always' | 'on_success' | 'on_failure';
  blocking?: boolean;
  timeout_seconds?: number;
}

export type HookPhase =
  | 'pre-project'
  | 'post-project'
  | 'pre-phase'
  | 'post-phase'
  | 'pre-story'
  | 'post-story'
  | 'pre-skill'
  | 'post-skill'
  | 'pre-commit'
  | 'post-commit';

// ============ 工作区元信息（阶段4：企业级特性）============

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
