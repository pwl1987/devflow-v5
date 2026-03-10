/**
 * DevFlow v5 - 审计日志系统类型定义
 *
 * 职责：定义审计事件、日志记录、查询的核心数据结构
 */

// ============ 审计事件类型 ============

/**
 * 审计事件类别
 */
export enum AuditCategory {
  /** 身份认证事件 */
  AUTH = 'auth',
  /** 授权事件 */
  AUTHORIZATION = 'authorization',
  /** 资源访问事件 */
  RESOURCE_ACCESS = 'resource_access',
  /** 数据修改事件 */
  DATA_MODIFICATION = 'data_modification',
  /** 系统配置事件 */
  SYSTEM_CONFIG = 'system_config',
  /** 工作区管理事件 */
  WORKSPACE_MANAGEMENT = 'workspace_management',
  /** 项目管理事件 */
  PROJECT_MANAGEMENT = 'project_management',
  /** 用户管理事件 */
  USER_MANAGEMENT = 'user_management',
  /** 角色管理事件 */
  ROLE_MANAGEMENT = 'role_management',
  /** 批量操作事件 */
  BATCH_OPERATION = 'batch_operation'
}

/**
 * 审计事件动作
 */
export enum AuditAction {
  // 通用动作
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  EXPORT = 'export',
  IMPORT = 'import',

  // 认证相关
  LOGIN = 'login',
  LOGOUT = 'logout',
  FAILED_LOGIN = 'failed_login',

  // 授权相关
  GRANT = 'grant',
  REVOKE = 'revoke',
  CHECK = 'check',

  // 管理相关
  ASSIGN = 'assign',
  UNASSIGN = 'unassign',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  RENAME = 'rename',

  // 批量操作
  BATCH_START = 'batch_start',
  BATCH_COMPLETE = 'batch_complete',
  BATCH_FAIL = 'batch_fail'
}

/**
 * 审计事件严重级别
 */
export enum AuditSeverity {
  /** 信息级别 */
  INFO = 'info',
  /** 警告级别 */
  WARNING = 'warning',
  /** 错误级别 */
  ERROR = 'error',
  /** 关键级别 */
  CRITICAL = 'critical'
}

/**
 * 审计事件状态
 */
export enum AuditStatus {
  /** 成功 */
  SUCCESS = 'success',
  /** 失败 */
  FAILURE = 'failure',
  /** 进行中 */
  IN_PROGRESS = 'in_progress',
  /** 已跳过 */
  SKIPPED = 'skipped'
}

// ============ 审计事件定义 ============

/**
 * 审计事件主体
 */
export interface AuditEvent {
  /** 事件唯一ID */
  id: string;
  /** 事件类别 */
  category: AuditCategory;
  /** 事件动作 */
  action: AuditAction;
  /** 事件严重级别 */
  severity: AuditSeverity;
  /** 事件状态 */
  status: AuditStatus;
  /** 事件发生时间（ISO 8601格式） */
  timestamp: string;
  /** 执行操作的用户ID */
  userId: string;
  /** 用户主体信息 */
  principal: AuditPrincipal;
  /** 目标资源 */
  resource: AuditResource;
  /** 操作结果 */
  result?: AuditResult;
  /** 客户端信息 */
  client?: AuditClient;
  /** 事件详情（扩展数据） */
  details?: Record<string, any>;
  /** 关联事件ID（用于批量操作或事件链） */
  correlationId?: string;
  /** 父事件ID（用于嵌套操作） */
  parentEventId?: string;
}

/**
 * 用户主体信息
 */
export interface AuditPrincipal {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username?: string;
  /** 用户邮箱 */
  email?: string;
  /** 用户角色列表 */
  roles?: string[];
  /** 用户IP地址 */
  ipAddress?: string;
  /** 用户会话ID */
  sessionId?: string;
}

/**
 * 审计目标资源
 */
export interface AuditResource {
  /** 资源类型 */
  type: string;
  /** 资源ID */
  id?: string;
  /** 资源名称 */
  name?: string;
  /** 所属工作区ID */
  workspaceId?: string;
  /** 所属项目ID */
  projectId?: string;
  /** 资源路径（用于文件资源） */
  path?: string;
}

/**
 * 操作结果
 */
export interface AuditResult {
  /** 是否成功 */
  success: boolean;
  /** 结果代码 */
  code?: string;
  /** 结果消息 */
  message?: string;
  /** 错误详情 */
  error?: {
    /** 错误类型 */
    type: string;
    /** 错误消息 */
    message: string;
    /** 错误堆栈 */
    stack?: string;
  };
  /** 影响的资源数量 */
  affectedCount?: number;
}

/**
 * 客户端信息
 */
export interface AuditClient {
  /** 客户端类型（web、cli、api） */
  type: 'web' | 'cli' | 'api' | 'integration';
  /** 客户端版本 */
  version?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 客户端IP */
  ipAddress?: string;
  /** 地理位置（可选） */
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
}

// ============ 审计日志查询 ============

/**
 * 审计日志查询条件
 */
export interface AuditQuery {
  /** 开始时间（ISO 8601格式） */
  startTime?: string;
  /** 结束时间（ISO 8601格式） */
  endTime?: string;
  /** 用户ID列表 */
  userIds?: string[];
  /** 事件类别列表 */
  categories?: AuditCategory[];
  /** 事件动作列表 */
  actions?: AuditAction[];
  /** 资源类型列表 */
  resourceTypes?: string[];
  /** 资源ID列表 */
  resourceIds?: string[];
  /** 工作区ID列表 */
  workspaceIds?: string[];
  /** 项目ID列表 */
  projectIds?: string[];
  /** 事件状态列表 */
  statuses?: AuditStatus[];
  /** 事件严重级别列表 */
  severities?: AuditSeverity[];
  /** 关联ID */
  correlationId?: string;
  /** 结果代码（用于失败查询） */
  resultCode?: string;
  /** 分页参数 */
  pagination?: {
    /** 页码（从1开始） */
    page: number;
    /** 每页数量 */
    pageSize: number;
  };
  /** 排序参数 */
  sort?: {
    /** 排序字段 */
    field: 'timestamp' | 'severity' | 'category';
    /** 排序方向 */
    direction: 'asc' | 'desc';
  };
}

/**
 * 审计日志查询结果
 */
export interface AuditQueryResult {
  /** 事件列表 */
  events: AuditEvent[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
}

// ============ 审计日志配置 ============

/**
 * 审计日志配置
 */
export interface AuditConfig {
  /** 是否启用审计日志 */
  enabled: boolean;
  /** 日志保留天数（0表示永久保留） */
  retentionDays: number;
  /** 是否记录详细数据 */
  includeDetails: boolean;
  /** 是否记录错误堆栈 */
  includeStackTrace: boolean;
  /** 异步写入缓冲区大小 */
  asyncBufferSize?: number;
  /** 敏感字段脱敏配置 */
  maskedFields?: string[];
  /** 存储后端配置 */
  storage?: AuditStorageConfig;
}

/**
 * 审计日志存储配置
 */
export interface AuditStorageConfig {
  /** 存储类型 */
  type: 'memory' | 'file' | 'database';
  /** 文件路径（file类型） */
  filePath?: string;
  /** 数据库连接配置（database类型） */
  database?: {
    host: string;
    port: number;
    database: string;
    table: string;
  };
}

// ============ 审计统计 ============

/**
 * 审计统计摘要
 */
export interface AuditSummary {
  /** 总事件数 */
  totalEvents: number;
  /** 按类别统计 */
  byCategory: Record<AuditCategory, number>;
  /** 按状态统计 */
  byStatus: Record<AuditStatus, number>;
  /** 按严重级别统计 */
  bySeverity: Record<AuditSeverity, number>;
  /** 失败事件数 */
  failureCount: number;
  /** 成功率 */
  successRate: number;
  /** 时间范围 */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * 用户活动摘要
 */
export interface UserActivitySummary {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username?: string;
  /** 总操作数 */
  totalActions: number;
  /** 最后活动时间 */
  lastActivity: string;
  /** 最常用操作 */
  topActions: Array<{
    action: AuditAction;
    count: number;
  }>;
  /** 失败操作数 */
  failureCount: number;
}
