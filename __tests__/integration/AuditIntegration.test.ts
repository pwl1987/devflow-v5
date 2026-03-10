/**
 * 审计日志集成测试
 *
 * 测试范围：
 * - 审计日志与权限系统集成
 * - 审计日志与工作区管理集成
 * - 审计事件追踪和关联
 * - 审计统计分析
 */

import { AuditManager, IAuditManager, AuditCategory, AuditAction, AuditSeverity, AuditStatus } from '../../core/audit';
import { RoleManager, PermissionManager, IRoleManager, IPermissionManager, SystemRole } from '../../core/permission';
import { WorkspaceManager, IWorkspaceManager } from '../../core/workspace';

describe('审计日志集成测试', () => {
  let auditManager: IAuditManager;
  let roleManager: IRoleManager;
  let permissionManager: IPermissionManager;
  let workspaceManager: IWorkspaceManager;

  beforeEach(async () => {
    auditManager = new AuditManager();
    roleManager = new RoleManager();
    permissionManager = new PermissionManager(roleManager);
    workspaceManager = new WorkspaceManager();

    // 初始化系统角色
    await roleManager.initializeSystemRoles();
  });

  afterEach(async () => {
    await auditManager.clear();
    await roleManager.clear();
    await permissionManager.clear();
    await workspaceManager.clear();
  });

  // ============ 权限系统审计集成测试 ============

  describe('权限系统审计集成', () => {
    it('应记录角色创建审计事件', async () => {
      const builder = auditManager.createEventBuilder('admin-user');

      await roleManager.createRole('custom-role', 'Custom Role', 'A custom role');

      // 记录审计事件
      await builder
        .setCategory(AuditCategory.ROLE_MANAGEMENT)
        .setAction(AuditAction.CREATE)
        .setResource('role', 'custom-role', 'Custom Role')
        .setResult(true)
        .addDetails({ description: 'A custom role' })
        .log();

      // 验证事件被记录
      const result = await auditManager.queryLogs({
        categories: [AuditCategory.ROLE_MANAGEMENT],
        actions: [AuditAction.CREATE]
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].resource.name).toBe('Custom Role');
    });

    it('应记录用户角色分配审计事件', async () => {
      const ownerRole = await roleManager.getRoleByName(SystemRole.WORKSPACE_OWNER);
      expect(ownerRole).toBeDefined();

      if (ownerRole) {
        const builder = auditManager.createEventBuilder('admin-user');

        await roleManager.assignRoleToUser(
          'user-123',
          ownerRole.id,
          'workspace-456',
          'workspace',
          'system'
        );

        // 记录审计事件
        await builder
          .setCategory(AuditCategory.AUTHORIZATION)
          .setAction(AuditAction.ASSIGN)
          .setResource('role', ownerRole.id, ownerRole.name)
          .setWorkspaceContext('workspace-456')
          .setResult(true)
          .addDetails({ userId: 'user-123', roleId: ownerRole.id })
          .log();

        // 验证事件
        const result = await auditManager.queryLogs({
          categories: [AuditCategory.AUTHORIZATION],
          actions: [AuditAction.ASSIGN]
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].details?.userId).toBe('user-123');
      }
    });

    it('应记录权限检查审计事件', async () => {
      const builder = auditManager.createEventBuilder('user-123');

      // 执行权限检查
      const result = await permissionManager.checkPermission(
        'user-123',
        'project',
        'read',
        'project-789'
      );

      // 记录审计事件
      await builder
        .setCategory(AuditCategory.AUTHORIZATION)
        .setAction(AuditAction.CHECK)
        .setResource('project', 'project-789')
        .setResult(result.granted, result.granted ? 'Permission granted' : result.reason)
        .addDetails({ resource: 'project', action: 'read' })
        .log();

      // 验证事件
      const logs = await auditManager.queryLogs({
        categories: [AuditCategory.AUTHORIZATION],
        actions: [AuditAction.CHECK]
      });

      expect(logs.events).toHaveLength(1);
    });

    it('应追踪同一操作的完整审计链', async () => {
      const correlationId = 'operation-123';

      // 步骤1：创建角色
      const step1 = auditManager.createEventBuilder('admin-user');
      await step1
        .setCategory(AuditCategory.ROLE_MANAGEMENT)
        .setAction(AuditAction.CREATE)
        .setResource('role')
        .setCorrelationId(correlationId)
        .setResult(true)
        .log();

      // 步骤2：分配角色
      const step2 = auditManager.createEventBuilder('admin-user');
      await step2
        .setCategory(AuditCategory.AUTHORIZATION)
        .setAction(AuditAction.ASSIGN)
        .setResource('assignment')
        .setCorrelationId(correlationId)
        .setResult(true)
        .log();

      // 查询相关事件
      const result = await auditManager.queryLogs({ correlationId: correlationId });

      expect(result.events).toHaveLength(2);
      expect(result.events.every(e => e.correlationId === correlationId)).toBe(true);
    });
  });

  // ============ 工作区管理审计集成测试 ============

  describe('工作区管理审计集成', () => {
    it('应记录工作区创建审计事件', async () => {
      const builder = auditManager.createEventBuilder('creator-user');

      const result = await workspaceManager.createWorkspace('Test Workspace', 'A test workspace');

      // 记录审计事件
      await builder
        .setCategory(AuditCategory.WORKSPACE_MANAGEMENT)
        .setAction(AuditAction.CREATE)
        .setResource('workspace', result.workspaceId, 'Test Workspace')
        .setResult(result.success, result.error)
        .addDetails({ description: 'A test workspace' })
        .log();

      // 验证事件
      const logs = await auditManager.queryLogs({
        categories: [AuditCategory.WORKSPACE_MANAGEMENT],
        actions: [AuditAction.CREATE]
      });

      expect(logs.events).toHaveLength(1);
      expect(logs.events[0].resource.name).toBe('Test Workspace');
    });

    it('应记录项目添加审计事件', async () => {
      // 创建工作区
      const wsResult = await workspaceManager.createWorkspace('Workspace');
      const workspaceId = wsResult.workspaceId!;

      // 添加项目
      const projResult = await workspaceManager.addProject(workspaceId, '/path/to/project', 'Project');

      // 记录审计事件
      const builder = auditManager.createEventBuilder('creator-user');
      await builder
        .setCategory(AuditCategory.PROJECT_MANAGEMENT)
        .setAction(AuditAction.CREATE)
        .setResource('project', projResult.projectId, 'Project')
        .setWorkspaceContext(workspaceId)
        .setResult(projResult.success, projResult.error)
        .addDetails({ rootPath: '/path/to/project' })
        .log();

      // 验证事件
      const logs = await auditManager.queryLogs({
        categories: [AuditCategory.PROJECT_MANAGEMENT],
        workspaceIds: [workspaceId]
      });

      expect(logs.events).toHaveLength(1);
    });
  });

  // ============ 审计统计分析测试 ============

  describe('审计统计分析', () => {
    beforeEach(async () => {
      // 添加一些测试数据 - 为每个事件创建新的 builder
      // 成功的登录事件
      await auditManager.createEventBuilder('user-1')
        .setCategory(AuditCategory.AUTH)
        .setAction(AuditAction.LOGIN)
        .setResource('session')
        .setResult(true)
        .log();

      // 失败的权限检查
      await auditManager.createEventBuilder('user-1')
        .setCategory(AuditCategory.AUTHORIZATION)
        .setAction(AuditAction.CHECK)
        .setResource('file', 'secret-file')
        .setResult(false, 'Permission denied')
        .log();

      // 角色创建
      await auditManager.createEventBuilder('user-1')
        .setCategory(AuditCategory.ROLE_MANAGEMENT)
        .setAction(AuditAction.CREATE)
        .setResource('role', 'role-1', 'New Role')
        .setResult(true)
        .log();

      // 批量操作开始
      await auditManager.createEventBuilder('user-1')
        .setCategory(AuditCategory.BATCH_OPERATION)
        .setAction(AuditAction.BATCH_START)
        .setResource('batch')
        .setCorrelationId('batch-123')
        .setResult(true)
        .log();

      // 批量操作完成
      await auditManager.createEventBuilder('user-1')
        .setCategory(AuditCategory.BATCH_OPERATION)
        .setAction(AuditAction.BATCH_COMPLETE)
        .setResource('batch')
        .setCorrelationId('batch-123')
        .setResult(true)
        .addDetails({ processedCount: 10 })
        .log();
    });

    it('应生成正确的统计摘要', async () => {
      const summary = await auditManager.getSummary();

      expect(summary.totalEvents).toBe(5);
      expect(summary.byCategory[AuditCategory.AUTH]).toBe(1);
      expect(summary.byCategory[AuditCategory.AUTHORIZATION]).toBe(1);
      expect(summary.byCategory[AuditCategory.ROLE_MANAGEMENT]).toBe(1);
      expect(summary.byCategory[AuditCategory.BATCH_OPERATION]).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.successRate).toBe(80); // 4/5 = 80%
    });

    it('应按严重级别统计', async () => {
      const summary = await auditManager.getSummary();

      expect(summary.bySeverity[AuditSeverity.INFO]).toBe(4); // 成功的事件
      expect(summary.bySeverity[AuditSeverity.ERROR]).toBe(1); // 失败的权限检查
    });

    it('应生成用户活动摘要', async () => {
      const activity = await auditManager.getUserActivity('user-1');

      expect(activity.totalActions).toBe(5);
      expect(activity.topActions.length).toBeGreaterThan(0);
      expect(activity.failureCount).toBe(1);
    });

    it('应查询特定类别的审计事件', async () => {
      const authLogs = await auditManager.queryLogs({
        categories: [AuditCategory.AUTH, AuditCategory.AUTHORIZATION]
      });

      expect(authLogs.events).toHaveLength(2);
    });

    it('应查询批量操作的关联事件', async () => {
      const batchLogs = await auditManager.queryLogs({
        correlationId: 'batch-123'
      });

      expect(batchLogs.events).toHaveLength(2);
      expect(batchLogs.events.every(e => e.correlationId === 'batch-123')).toBe(true);
    });
  });

  // ============ 数据脱敏测试 ============

  describe('数据脱敏', () => {
    it('应自动脱敏敏感字段', async () => {
      await auditManager.updateConfig({
        maskedFields: ['password', 'apiKey', 'secret']
      });

      const builder = auditManager.createEventBuilder('user-1');
      await builder
        .setCategory(AuditCategory.AUTH)
        .setAction(AuditAction.LOGIN)
        .setResource('session')
        .addDetails({
          username: 'testuser',
          password: 'secret123',
          apiKey: 'key-abc-123',
          normalField: 'visible'
        })
        .log();

      const result = await auditManager.queryLogs({});
      const event = result.events[0];

      expect(event.details?.password).toBe('***MASKED***');
      expect(event.details?.apiKey).toBe('***MASKED***');
      expect(event.details?.normalField).toBe('visible');
    });
  });

  // ============ 审计日志保留策略测试 ============

  describe('审计日志保留策略', () => {
    it('应支持按时间清除旧日志', async () => {
      const builder = auditManager.createEventBuilder('user-1');

      // 创建一些事件
      await builder
        .setCategory(AuditCategory.AUTH)
        .setAction(AuditAction.LOGIN)
        .setResource('session')
        .setResult(true)
        .log();

      await builder
        .setCategory(AuditCategory.RESOURCE_ACCESS)
        .setAction(AuditAction.READ)
        .setResource('file')
        .setResult(true)
        .log();

      // 清除一小时前的日志
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const count = await auditManager.clear(oneHourAgo);

      // 由于所有事件都是刚创建的，应该不会被清除
      expect(count).toBe(0);

      const summary = await auditManager.getSummary();
      expect(summary.totalEvents).toBe(2);
    });

    it('应支持配置日志保留天数', async () => {
      const config = auditManager.getConfig();
      expect(config.retentionDays).toBe(90); // 默认值

      await auditManager.updateConfig({ retentionDays: 30 });

      const updatedConfig = auditManager.getConfig();
      expect(updatedConfig.retentionDays).toBe(30);
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空查询结果', async () => {
      const result = await auditManager.queryLogs({
        userIds: ['non-existent-user']
      });

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('应处理无效的时间范围', async () => {
      const summary = await auditManager.getSummary('invalid-date', 'also-invalid');

      // 应该返回空摘要而不是报错
      expect(summary).toBeDefined();
      expect(summary.totalEvents).toBe(0);
    });

    it('应处理审计日志禁用状态', async () => {
      await auditManager.updateConfig({ enabled: false });

      const builder = auditManager.createEventBuilder('user-1');

      await expect(
        builder
          .setCategory(AuditCategory.AUTH)
          .setAction(AuditAction.LOGIN)
          .setResource('session')
          .log()
      ).rejects.toThrow('Audit logging is disabled');
    });
  });
});
