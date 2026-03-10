/**
 * DevFlow v5 - 审计日志管理器实现
 *
 * 职责：记录审计事件、查询审计日志、统计分析
 *
 * SOLID 原则：
 * - 单一职责：仅负责审计日志的管理
 * - 依赖倒置：实现 IAuditManager 接口
 */

import type {
  IAuditManager,
  IAuditEventBuilder
} from './IAuditManager';
import type {
  AuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditConfig,
  AuditSummary,
  UserActivitySummary,
  AuditPrincipal,
  AuditResource,
  AuditResult,
  AuditClient
} from './types';
import {
  AuditCategory,
  AuditAction,
  AuditSeverity,
  AuditStatus
} from './types';

// ============ 默认配置 ============

const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  retentionDays: 90,
  includeDetails: true,
  includeStackTrace: false,
  asyncBufferSize: 100,
  maskedFields: ['password', 'token', 'secret', 'apiKey'],
  storage: {
    type: 'memory'
  }
};

// ============ AuditEventBuilder 实现 ============

/**
 * 审计事件构建器
 *
 * 提供流式API用于构建审计事件
 */
export class AuditEventBuilder implements IAuditEventBuilder {
  private event: Partial<AuditEvent> = {};

  constructor(
    private auditManager: IAuditManager,
    private userId: string
  ) {
    this.event.userId = userId;
    this.event.severity = AuditSeverity.INFO;
    this.event.status = AuditStatus.SUCCESS;
    this.event.principal = { userId };
    this.event.resource = { type: 'unknown' };
  }

  setCategory(category: AuditCategory): IAuditEventBuilder {
    this.event.category = category;
    return this;
  }

  setAction(action: AuditAction): IAuditEventBuilder {
    this.event.action = action;
    return this;
  }

  setPrincipal(userId: string, username?: string): IAuditEventBuilder {
    this.event.userId = userId;
    this.event.principal = { userId, username };
    return this;
  }

  setResource(type: string, id?: string, name?: string): IAuditEventBuilder {
    this.event.resource = { type, id, name };
    return this;
  }

  setWorkspaceContext(workspaceId: string, projectId?: string): IAuditEventBuilder {
    if (!this.event.resource) {
      this.event.resource = { type: 'unknown' };
    }
    this.event.resource.workspaceId = workspaceId;
    if (projectId) {
      this.event.resource.projectId = projectId;
    }
    return this;
  }

  setResult(success: boolean, message?: string, code?: string): IAuditEventBuilder {
    this.event.status = success ? AuditStatus.SUCCESS : AuditStatus.FAILURE;
    this.event.result = { success, message, code };
    if (!success) {
      this.event.severity = AuditSeverity.ERROR;
    }
    return this;
  }

  setCorrelationId(correlationId: string): IAuditEventBuilder {
    this.event.correlationId = correlationId;
    return this;
  }

  addDetails(details: Record<string, any>): IAuditEventBuilder {
    if (!this.event.details) {
      this.event.details = {};
    }
    Object.assign(this.event.details, details);
    return this;
  }

  build(): Omit<AuditEvent, 'id' | 'timestamp'> {
    if (!this.event.category || !this.event.action) {
      throw new Error('Category and action are required');
    }
    return this.event as Omit<AuditEvent, 'id' | 'timestamp'>;
  }

  async log(): Promise<string> {
    return this.auditManager.logEvent(this.build());
  }
}

// ============ AuditManager 实现 ============

/**
 * 审计日志管理器实现
 *
 * 功能：
 * - 记录审计事件
 * - 查询审计日志
 * - 统计分析
 * - 日志导出
 */
export class AuditManager implements IAuditManager {
  // 事件存储
  private events: Map<string, AuditEvent> = new Map();
  // 按用户ID索引
  private userIndex: Map<string, Set<string>> = new Map();
  // 按资源ID索引
  private resourceIndex: Map<string, Set<string>> = new Map();
  // 按类别索引
  private categoryIndex: Map<AuditCategory, Set<string>> = new Map();
  // 按工作区ID索引
  private workspaceIndex: Map<string, Set<string>> = new Map();
  // 按关联ID索引
  private correlationIndex: Map<string, Set<string>> = new Map();

  // 配置
  private config: AuditConfig = { ...DEFAULT_CONFIG };

  /**
   * 创建审计事件构建器
   * @param userId 用户ID
   * @returns 事件构建器
   */
  createEventBuilder(userId: string): IAuditEventBuilder {
    return new AuditEventBuilder(this, userId);
  }

  /**
   * 记录审计事件
   */
  async logEvent(eventData: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Audit logging is disabled');
    }

    // 生成事件ID和时间戳
    const eventId = this.generateEventId();
    const timestamp = new Date().toISOString();

    // 脱敏处理
    const sanitizedDetails = this.config.maskedFields
      ? this.sanitizeDetails(eventData.details || {})
      : eventData.details;

    // 构建完整事件
    const event: AuditEvent = {
      id: eventId,
      timestamp,
      ...eventData,
      details: sanitizedDetails
    };

    // 存储事件
    this.events.set(eventId, event);

    // 更新索引
    this.updateIndexes(event);

    return eventId;
  }

  /**
   * 批量记录审计事件
   */
  async logEvents(eventsData: Array<Omit<AuditEvent, 'id' | 'timestamp'>>): Promise<string[]> {
    const eventIds: string[] = [];

    for (const eventData of eventsData) {
      const eventId = await this.logEvent(eventData);
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * 查询审计日志
   */
  async queryLogs(query: AuditQuery): Promise<AuditQueryResult> {
    let filteredEvents = Array.from(this.events.values());

    // 应用过滤条件
    if (query.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.userIds && query.userIds.length > 0) {
      filteredEvents = filteredEvents.filter(e => query.userIds!.includes(e.userId));
    }
    if (query.categories && query.categories.length > 0) {
      filteredEvents = filteredEvents.filter(e => query.categories!.includes(e.category));
    }
    if (query.actions && query.actions.length > 0) {
      filteredEvents = filteredEvents.filter(e => query.actions!.includes(e.action));
    }
    if (query.resourceTypes && query.resourceTypes.length > 0) {
      filteredEvents = filteredEvents.filter(e =>
        e.resource.type && query.resourceTypes!.includes(e.resource.type as any)
      );
    }
    if (query.resourceIds && query.resourceIds.length > 0) {
      filteredEvents = filteredEvents.filter(e =>
        e.resource.id && query.resourceIds!.includes(e.resource.id)
      );
    }
    if (query.workspaceIds && query.workspaceIds.length > 0) {
      filteredEvents = filteredEvents.filter(e =>
        e.resource.workspaceId && query.workspaceIds!.includes(e.resource.workspaceId)
      );
    }
    if (query.projectIds && query.projectIds.length > 0) {
      filteredEvents = filteredEvents.filter(e =>
        e.resource.projectId && query.projectIds!.includes(e.resource.projectId)
      );
    }
    if (query.statuses && query.statuses.length > 0) {
      filteredEvents = filteredEvents.filter(e => query.statuses!.includes(e.status));
    }
    if (query.severities && query.severities.length > 0) {
      filteredEvents = filteredEvents.filter(e => query.severities!.includes(e.severity));
    }
    if (query.correlationId) {
      const relatedIds = this.correlationIndex.get(query.correlationId);
      if (relatedIds) {
        filteredEvents = filteredEvents.filter(e => relatedIds.has(e.id));
      } else {
        filteredEvents = [];
      }
    }

    // 排序
    if (query.sort) {
      filteredEvents.sort((a, b) => {
        const aVal = a[query.sort!.field];
        const bVal = b[query.sort!.field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.sort!.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // 默认按时间倒序
      filteredEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    // 分页
    const total = filteredEvents.length;
    const page = query.pagination?.page || 1;
    const pageSize = query.pagination?.pageSize || 50;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedEvents = filteredEvents.slice(startIndex, startIndex + pageSize);

    return {
      events: paginatedEvents,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages
    };
  }

  /**
   * 根据ID获取审计事件
   */
  async getEventById(eventId: string): Promise<AuditEvent | null> {
    return this.events.get(eventId) || null;
  }

  /**
   * 获取审计统计摘要
   */
  async getSummary(startTime?: string, endTime?: string): Promise<AuditSummary> {
    const end = endTime || new Date().toISOString();
    const start = startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let filteredEvents = Array.from(this.events.values())
      .filter(e => e.timestamp >= start && e.timestamp <= end);

    const totalEvents = filteredEvents.length;

    // 按类别统计
    const byCategory: Record<AuditCategory, number> = {
      [AuditCategory.AUTH]: 0,
      [AuditCategory.AUTHORIZATION]: 0,
      [AuditCategory.RESOURCE_ACCESS]: 0,
      [AuditCategory.DATA_MODIFICATION]: 0,
      [AuditCategory.SYSTEM_CONFIG]: 0,
      [AuditCategory.WORKSPACE_MANAGEMENT]: 0,
      [AuditCategory.PROJECT_MANAGEMENT]: 0,
      [AuditCategory.USER_MANAGEMENT]: 0,
      [AuditCategory.ROLE_MANAGEMENT]: 0,
      [AuditCategory.BATCH_OPERATION]: 0
    };

    // 按状态统计
    const byStatus: Record<AuditStatus, number> = {
      [AuditStatus.SUCCESS]: 0,
      [AuditStatus.FAILURE]: 0,
      [AuditStatus.IN_PROGRESS]: 0,
      [AuditStatus.SKIPPED]: 0
    };

    // 按严重级别统计
    const bySeverity: Record<AuditSeverity, number> = {
      [AuditSeverity.INFO]: 0,
      [AuditSeverity.WARNING]: 0,
      [AuditSeverity.ERROR]: 0,
      [AuditSeverity.CRITICAL]: 0
    };

    let failureCount = 0;

    for (const event of filteredEvents) {
      byCategory[event.category]++;
      byStatus[event.status]++;
      bySeverity[event.severity]++;
      if (event.status === AuditStatus.FAILURE) {
        failureCount++;
      }
    }

    const successRate = totalEvents > 0 ? (byStatus[AuditStatus.SUCCESS] / totalEvents) * 100 : 0;

    return {
      totalEvents,
      byCategory,
      byStatus,
      bySeverity,
      failureCount,
      successRate,
      timeRange: { start, end }
    };
  }

  /**
   * 获取用户活动摘要
   */
  async getUserActivity(userId: string, startTime?: string, endTime?: string): Promise<UserActivitySummary> {
    const end = endTime || new Date().toISOString();
    const start = startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const userEvents = Array.from(this.events.values())
      .filter(e => e.userId === userId && e.timestamp >= start && e.timestamp <= end);

    const totalActions = userEvents.length;
    const lastActivity = userEvents.length > 0
      ? userEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0].timestamp
      : start;

    // 统计最常用操作
    const actionCounts = new Map<AuditAction, number>();
    let failureCount = 0;

    for (const event of userEvents) {
      actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
      if (event.status === AuditStatus.FAILURE) {
        failureCount++;
      }
    }

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 获取用户名
    const username = userEvents.length > 0 ? userEvents[0].principal.username : undefined;

    return {
      userId,
      username,
      totalActions,
      lastActivity,
      topActions,
      failureCount
    };
  }

  /**
   * 获取审计配置
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * 更新审计配置
   */
  async updateConfig(config: Partial<AuditConfig>): Promise<boolean> {
    this.config = { ...this.config, ...config };
    return true;
  }

  /**
   * 导出审计日志
   */
  async exportLogs(query: AuditQuery, format: 'json' | 'csv', outputPath: string): Promise<boolean> {
    const result = await this.queryLogs(query);

    if (format === 'json') {
      const data = JSON.stringify(result.events, null, 2);
      // 这里应该写入文件，简化实现
      return true;
    } else if (format === 'csv') {
      // CSV导出逻辑
      return true;
    }

    return false;
  }

  /**
   * 清空审计日志
   */
  async clear(beforeTime?: string): Promise<number> {
    if (beforeTime) {
      let count = 0;
      for (const [id, event] of this.events.entries()) {
        if (event.timestamp < beforeTime) {
          this.events.delete(id);
          count++;
        }
      }
      // 重建索引
      this.rebuildIndexes();
      return count;
    } else {
      const count = this.events.size;
      this.events.clear();
      this.clearIndexes();
      return count;
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 脱敏处理
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };
    for (const field of this.config.maskedFields || []) {
      if (field in sanitized) {
        sanitized[field] = '***MASKED***';
      }
    }
    return sanitized;
  }

  /**
   * 更新索引
   */
  private updateIndexes(event: AuditEvent): void {
    // 用户索引
    if (!this.userIndex.has(event.userId)) {
      this.userIndex.set(event.userId, new Set());
    }
    this.userIndex.get(event.userId)!.add(event.id);

    // 资源索引
    if (event.resource.id) {
      if (!this.resourceIndex.has(event.resource.id)) {
        this.resourceIndex.set(event.resource.id, new Set());
      }
      this.resourceIndex.get(event.resource.id)!.add(event.id);
    }

    // 类别索引
    if (!this.categoryIndex.has(event.category)) {
      this.categoryIndex.set(event.category, new Set());
    }
    this.categoryIndex.get(event.category)!.add(event.id);

    // 工作区索引
    if (event.resource.workspaceId) {
      if (!this.workspaceIndex.has(event.resource.workspaceId)) {
        this.workspaceIndex.set(event.resource.workspaceId, new Set());
      }
      this.workspaceIndex.get(event.resource.workspaceId)!.add(event.id);
    }

    // 关联ID索引
    if (event.correlationId) {
      if (!this.correlationIndex.has(event.correlationId)) {
        this.correlationIndex.set(event.correlationId, new Set());
      }
      this.correlationIndex.get(event.correlationId)!.add(event.id);
    }
  }

  /**
   * 重建索引
   */
  private rebuildIndexes(): void {
    this.clearIndexes();
    for (const event of this.events.values()) {
      this.updateIndexes(event);
    }
  }

  /**
   * 清空索引
   */
  private clearIndexes(): void {
    this.userIndex.clear();
    this.resourceIndex.clear();
    this.categoryIndex.clear();
    this.workspaceIndex.clear();
    this.correlationIndex.clear();
  }
}
