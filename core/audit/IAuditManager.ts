/**
 * DevFlow v5 - 审计日志管理器接口
 *
 * 职责：定义审计日志记录、查询、导出的标准接口
 */

import type {
  AuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditConfig,
  AuditSummary,
  UserActivitySummary,
  AuditCategory,
  AuditAction
} from './types';

// ============ IAuditManager 接口 ============

/**
 * 审计日志管理器接口
 *
 * 功能：
 * - 审计事件记录
 * - 审计日志查询
 * - 审计统计分析
 * - 审计日志导出
 */
export interface IAuditManager {
  /**
   * 记录审计事件
   * @param event 审计事件
   * @returns 事件ID
   */
  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string>;

  /**
   * 批量记录审计事件
   * @param events 事件列表
   * @returns 事件ID列表
   */
  logEvents(events: Array<Omit<AuditEvent, 'id' | 'timestamp'>>): Promise<string[]>;

  /**
   * 查询审计日志
   * @param query 查询条件
   * @returns 查询结果
   */
  queryLogs(query: AuditQuery): Promise<AuditQueryResult>;

  /**
   * 根据ID获取审计事件
   * @param eventId 事件ID
   * @returns 审计事件，不存在时返回null
   */
  getEventById(eventId: string): Promise<AuditEvent | null>;

  /**
   * 获取审计统计摘要
   * @param startTime 开始时间（可选，默认最近24小时）
   * @param endTime 结束时间（可选，默认当前时间）
   * @returns 统计摘要
   */
  getSummary(startTime?: string, endTime?: string): Promise<AuditSummary>;

  /**
   * 获取用户活动摘要
   * @param userId 用户ID
   * @param startTime 开始时间（可选）
   * @param endTime 结束时间（可选）
   * @returns 用户活动摘要
   */
  getUserActivity(userId: string, startTime?: string, endTime?: string): Promise<UserActivitySummary>;

  /**
   * 获取审计配置
   * @returns 审计配置
   */
  getConfig(): AuditConfig;

  /**
   * 更新审计配置
   * @param config 新配置
   * @returns 是否成功
   */
  updateConfig(config: Partial<AuditConfig>): Promise<boolean>;

  /**
   * 导出审计日志
   * @param query 查询条件
   * @param format 导出格式（json、csv）
   * @param outputPath 输出文件路径
   * @returns 是否成功
   */
  exportLogs(query: AuditQuery, format: 'json' | 'csv', outputPath: string): Promise<boolean>;

  /**
   * 清空审计日志
   * @param beforeTime 清除此时间之前的日志（可选，清空全部）
   * @returns 清空的记录数
   */
  clear(beforeTime?: string): Promise<number>;

  /**
   * 创建审计事件构建器
   * @param userId 用户ID
   * @returns 事件构建器
   */
  createEventBuilder(userId: string): IAuditEventBuilder;

  /**
   * 清空审计日志
   * @param beforeTime 清除此时间之前的日志（可选，清空全部）
   * @returns 清空的记录数
   */
  clear(beforeTime?: string): Promise<number>;
}

// ============ 审计事件构建器接口 ============

/**
 * 审计事件构建器接口
 *
 * 用于方便地构建审计事件
 */
export interface IAuditEventBuilder {
  /**
   * 设置事件类别
   * @param category 事件类别
   */
  setCategory(category: AuditCategory): IAuditEventBuilder;

  /**
   * 设置事件动作
   * @param action 事件动作
   */
  setAction(action: AuditAction): IAuditEventBuilder;

  /**
   * 设置执行用户
   * @param userId 用户ID
   * @param username 用户名（可选）
   */
  setPrincipal(userId: string, username?: string): IAuditEventBuilder;

  /**
   * 设置目标资源
   * @param type 资源类型
   * @param id 资源ID（可选）
   * @param name 资源名称（可选）
   */
  setResource(type: string, id?: string, name?: string): IAuditEventBuilder;

  /**
   * 设置工作区上下文
   * @param workspaceId 工作区ID
   * @param projectId 项目ID（可选）
   */
  setWorkspaceContext(workspaceId: string, projectId?: string): IAuditEventBuilder;

  /**
   * 设置操作结果
   * @param success 是否成功
   * @param message 结果消息（可选）
   * @param code 结果代码（可选）
   */
  setResult(success: boolean, message?: string, code?: string): IAuditEventBuilder;

  /**
   * 设置关联ID（用于批量操作或事件链）
   * @param correlationId 关联ID
   */
  setCorrelationId(correlationId: string): IAuditEventBuilder;

  /**
   * 添加详情数据
   * @param details 详情对象
   */
  addDetails(details: Record<string, any>): IAuditEventBuilder;

  /**
   * 构建事件对象
   * @returns 完整的审计事件对象
   */
  build(): Omit<AuditEvent, 'id' | 'timestamp'>;

  /**
   * 构建并记录事件
   * @returns 事件ID
   */
  log(): Promise<string>;
}
