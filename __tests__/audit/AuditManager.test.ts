/**
 * AuditManager 单元测试
 *
 * TDD 流程：RED → GREEN → IMPROVE
 *
 * 测试策略：
 * - 测试审计事件记录
 * - 测试审计日志查询
 * - 测试统计分析功能
 * - 测试事件构建器
 * - 测试数据脱敏
 */

import { AuditManager, AuditEventBuilder, IAuditManager, AuditCategory, AuditAction, AuditSeverity, AuditStatus } from '../../core/audit';

describe('AuditManager', () => {
  let auditManager: AuditManager;

  beforeEach(() => {
    auditManager = new AuditManager() as AuditManager;
  });

  afterEach(async () => {
    await auditManager.clear();
  });

  // ============ logEvent() 测试 ============

  describe('logEvent() - 记录审计事件', () => {
    it('应成功记录审计事件', async () => {
      const eventData = {
        category: AuditCategory.AUTH,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.INFO,
        status: AuditStatus.SUCCESS,
        userId: 'user-123',
        principal: { userId: 'user-123', username: 'testuser' },
        resource: { type: 'session' }
      };

      const eventId = await auditManager.logEvent(eventData);

      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^audit-\d+-[a-z0-9]+$/);

      const event = await auditManager.getEventById(eventId);
      expect(event).toBeDefined();
      expect(event?.category).toBe(AuditCategory.AUTH);
      expect(event?.action).toBe(AuditAction.LOGIN);
      expect(event?.timestamp).toBeDefined();
    });

    it('应自动生成事件ID和时间戳', async () => {
      const eventData = {
        category: AuditCategory.RESOURCE_ACCESS,
        action: AuditAction.READ,
        severity: AuditSeverity.INFO,
        status: AuditStatus.SUCCESS,
        userId: 'user-456',
        principal: { userId: 'user-456' },
        resource: { type: 'file', id: 'file-1' }
      };

      const eventId = await auditManager.logEvent(eventData);
      const event = await auditManager.getEventById(eventId);

      expect(event?.id).toBeDefined();
      expect(event?.timestamp).toBeDefined();
      expect(event?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应拒绝记录当审计日志被禁用', async () => {
      await auditManager.updateConfig({ enabled: false });

      const eventData = {
        category: AuditCategory.AUTH,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.INFO,
        status: AuditStatus.SUCCESS,
        userId: 'user-123',
        principal: { userId: 'user-123' },
        resource: { type: 'session' }
      };

      await expect(auditManager.logEvent(eventData)).rejects.toThrow('Audit logging is disabled');
    });

    it('应对敏感字段进行脱敏', async () => {
      await auditManager.updateConfig({ maskedFields: ['password', 'token'] });

      const eventData = {
        category: AuditCategory.AUTH,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.INFO,
        status: AuditStatus.SUCCESS,
        userId: 'user-123',
        principal: { userId: 'user-123' },
        resource: { type: 'session' },
        details: {
          password: 'secret123',
          token: 'abc123',
          username: 'testuser'
        }
      };

      const eventId = await auditManager.logEvent(eventData);
      const event = await auditManager.getEventById(eventId);

      expect(event?.details?.password).toBe('***MASKED***');
      expect(event?.details?.token).toBe('***MASKED***');
      expect(event?.details?.username).toBe('testuser');
    });
  });

  // ============ logEvents() 批量记录测试 ============

  describe('logEvents() - 批量记录事件', () => {
    it('应批量记录多个事件', async () => {
      const eventsData = [
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        },
        {
          category: AuditCategory.RESOURCE_ACCESS,
          action: AuditAction.READ,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'file', id: 'file-1' }
        }
      ];

      const eventIds = await auditManager.logEvents(eventsData);

      expect(eventIds).toHaveLength(2);
      expect(eventIds[0]).not.toBe(eventIds[1]);

      const event1 = await auditManager.getEventById(eventIds[0]);
      const event2 = await auditManager.getEventById(eventIds[1]);
      expect(event1?.category).toBe(AuditCategory.AUTH);
      expect(event2?.category).toBe(AuditCategory.RESOURCE_ACCESS);
    });
  });

  // ============ queryLogs() 查询测试 ============

  describe('queryLogs() - 查询审计日志', () => {
    beforeEach(async () => {
      // 添加测试数据
      await auditManager.logEvents([
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        },
        {
          category: AuditCategory.RESOURCE_ACCESS,
          action: AuditAction.READ,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'file', id: 'file-1', workspaceId: 'ws-1' }
        },
        {
          category: AuditCategory.DATA_MODIFICATION,
          action: AuditAction.UPDATE,
          severity: AuditSeverity.WARNING,
          status: AuditStatus.FAILURE,
          userId: 'user-2',
          principal: { userId: 'user-2' },
          resource: { type: 'file', id: 'file-2' },
          result: { success: false, message: 'Permission denied' }
        }
      ]);
    });

    it('应查询所有日志', async () => {
      const result = await auditManager.queryLogs({});

      expect(result.events).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('应按用户ID过滤', async () => {
      const result = await auditManager.queryLogs({ userIds: ['user-1'] });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.userId === 'user-1')).toBe(true);
    });

    it('应按类别过滤', async () => {
      const result = await auditManager.queryLogs({ categories: [AuditCategory.AUTH] });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].category).toBe(AuditCategory.AUTH);
    });

    it('应按状态过滤', async () => {
      const result = await auditManager.queryLogs({ statuses: [AuditStatus.FAILURE] });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].status).toBe(AuditStatus.FAILURE);
    });

    it('应按工作区ID过滤', async () => {
      const result = await auditManager.queryLogs({ workspaceIds: ['ws-1'] });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].resource.workspaceId).toBe('ws-1');
    });

    it('应支持分页', async () => {
      const result = await auditManager.queryLogs({
        pagination: { page: 1, pageSize: 2 }
      });

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(true);
    });

    it('应支持排序', async () => {
      const result = await auditManager.queryLogs({
        sort: { field: 'timestamp', direction: 'asc' }
      });

      // 验证排序：按时间戳升序排列
      const timestamps = result.events.map(e => new Date(e.timestamp).getTime());
      expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
    });
  });

  // ============ getSummary() 统计测试 ============

  describe('getSummary() - 审计统计', () => {
    beforeEach(async () => {
      await auditManager.logEvents([
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        },
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGOUT,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        },
        {
          category: AuditCategory.RESOURCE_ACCESS,
          action: AuditAction.READ,
          severity: AuditSeverity.WARNING,
          status: AuditStatus.FAILURE,
          userId: 'user-2',
          principal: { userId: 'user-2' },
          resource: { type: 'file' }
        }
      ]);
    });

    it('应生成正确的统计摘要', async () => {
      const summary = await auditManager.getSummary();

      expect(summary.totalEvents).toBe(3);
      expect(summary.byCategory[AuditCategory.AUTH]).toBe(2);
      expect(summary.byCategory[AuditCategory.RESOURCE_ACCESS]).toBe(1);
      expect(summary.byStatus[AuditStatus.SUCCESS]).toBe(2);
      expect(summary.byStatus[AuditStatus.FAILURE]).toBe(1);
      expect(summary.failureCount).toBe(1);
      expect(summary.successRate).toBeCloseTo(66.67, 1);
    });

    it('应支持自定义时间范围', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

      const summary = await auditManager.getSummary(twoHoursAgo, oneHourAgo);

      expect(summary.timeRange.start).toBe(twoHoursAgo);
      expect(summary.timeRange.end).toBe(oneHourAgo);
    });
  });

  // ============ getUserActivity() 用户活动测试 ============

  describe('getUserActivity() - 用户活动摘要', () => {
    beforeEach(async () => {
      await auditManager.logEvents([
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1', username: 'testuser' },
          resource: { type: 'session' }
        },
        {
          category: AuditCategory.RESOURCE_ACCESS,
          action: AuditAction.READ,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1', username: 'testuser' },
          resource: { type: 'file' }
        },
        {
          category: AuditCategory.RESOURCE_ACCESS,
          action: AuditAction.READ,
          severity: AuditSeverity.INFO,
          status: AuditStatus.FAILURE,
          userId: 'user-1',
          principal: { userId: 'user-1', username: 'testuser' },
          resource: { type: 'file' }
        }
      ]);
    });

    it('应生成用户活动摘要', async () => {
      const activity = await auditManager.getUserActivity('user-1');

      expect(activity.userId).toBe('user-1');
      expect(activity.username).toBe('testuser');
      expect(activity.totalActions).toBe(3);
      expect(activity.failureCount).toBe(1);
      expect(activity.topActions.length).toBeGreaterThan(0);
      expect(activity.topActions[0].action).toBe(AuditAction.READ);
      expect(activity.topActions[0].count).toBe(2);
    });
  });

  // ============ clear() 清除测试 ============

  describe('clear() - 清空审计日志', () => {
    it('应清空所有日志', async () => {
      await auditManager.logEvents([
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        }
      ]);

      const count = await auditManager.clear();
      expect(count).toBe(1);

      const summary = await auditManager.getSummary();
      expect(summary.totalEvents).toBe(0);
    });

    it('应清除指定时间之前的日志', async () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const recentTime = new Date().toISOString();

      // 记录旧事件（需要手动设置时间戳，这里简化为只测试接口）
      await auditManager.logEvents([
        {
          category: AuditCategory.AUTH,
          action: AuditAction.LOGIN,
          severity: AuditSeverity.INFO,
          status: AuditStatus.SUCCESS,
          userId: 'user-1',
          principal: { userId: 'user-1' },
          resource: { type: 'session' }
        }
      ]);

      // 清除一小时前的日志
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const count = await auditManager.clear(oneHourAgo);

      // 由于所有事件都是刚创建的，不应该被清除
      expect(count).toBe(0);
    });
  });

  // ============ AuditEventBuilder 测试 ============

  describe('AuditEventBuilder - 事件构建器', () => {
    it('应使用构建器创建事件', async () => {
      const builder = auditManager.createEventBuilder('user-123');

      const eventId = await builder
        .setCategory(AuditCategory.AUTH)
        .setAction(AuditAction.LOGIN)
        .setPrincipal('user-123', 'testuser')
        .setResource('session', 'session-1')
        .setResult(true)
        .addDetails({ ip: '192.168.1.1' })
        .log();

      expect(eventId).toBeDefined();

      const event = await auditManager.getEventById(eventId);
      expect(event?.category).toBe(AuditCategory.AUTH);
      expect(event?.action).toBe(AuditAction.LOGIN);
      expect(event?.principal.username).toBe('testuser');
      expect(event?.resource.id).toBe('session-1');
      expect(event?.result?.success).toBe(true);
      expect(event?.details?.ip).toBe('192.168.1.1');
    });

    it('应支持工作区上下文设置', async () => {
      const builder = auditManager.createEventBuilder('user-123');

      const eventId = await builder
        .setCategory(AuditCategory.RESOURCE_ACCESS)
        .setAction(AuditAction.READ)
        .setResource('file', 'file-1')
        .setWorkspaceContext('ws-123', 'proj-456')
        .log();

      const event = await auditManager.getEventById(eventId);
      expect(event?.resource.workspaceId).toBe('ws-123');
      expect(event?.resource.projectId).toBe('proj-456');
    });

    it('应支持关联ID设置', async () => {
      const builder = auditManager.createEventBuilder('user-123');

      const eventId = await builder
        .setCategory(AuditCategory.BATCH_OPERATION)
        .setAction(AuditAction.BATCH_START)
        .setResource('batch')
        .setCorrelationId('batch-123')
        .log();

      const event = await auditManager.getEventById(eventId);
      expect(event?.correlationId).toBe('batch-123');
    });

    it('应根据结果自动设置严重级别', async () => {
      const builder = auditManager.createEventBuilder('user-123');

      // 成功操作应为INFO
      const successEvent = builder
        .setCategory(AuditCategory.DATA_MODIFICATION)
        .setAction(AuditAction.UPDATE)
        .setResource('file')
        .setResult(true)
        .build();

      expect(successEvent.severity).toBe(AuditSeverity.INFO);
      expect(successEvent.status).toBe(AuditStatus.SUCCESS);

      // 失败操作应为ERROR
      const failureEvent = builder
        .setResult(false, 'Update failed')
        .build();

      expect(failureEvent.severity).toBe(AuditSeverity.ERROR);
      expect(failureEvent.status).toBe(AuditStatus.FAILURE);
    });
  });
});
