/**
 * DevFlow v5 - DevFlowBaseError 单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  DevFlowBaseError,
  FlowExecutionError,
  StateManagementError,
  FileNotFoundError,
  PermissionDeniedError,
  ValidationError,
  NetworkError,
  ConfigurationError,
  ErrorCategory,
  ErrorSeverity
} from '../../core/errors/DevFlowBaseError';

describe('DevFlowBaseError', () => {
  describe('基础错误类', () => {
    it('应该创建带有基本信息的错误', () => {
      const error = new DevFlowBaseError(
        'TEST_ERROR',
        '测试错误消息',
        ErrorCategory.UNKNOWN
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DevFlowBaseError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('测试错误消息');
      expect(error.category).toBe(ErrorCategory.UNKNOWN);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    it('应该支持自定义严重级别', () => {
      const error = new DevFlowBaseError(
        'CRITICAL_ERROR',
        '关键错误',
        ErrorCategory.EXECUTION,
        ErrorSeverity.CRITICAL
      );

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('应该支持上下文信息', () => {
      const context = {
        filePath: '/path/to/file',
        lineNumber: 42
      };

      const error = new DevFlowBaseError(
        'CONTEXT_ERROR',
        '带上下文的错误',
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        context
      );

      expect(error.context).toEqual(context);
    });

    it('应该支持原因链（cause）', () => {
      const cause = new Error('原始错误');
      const error = new DevFlowBaseError(
        'WRAPPED_ERROR',
        '包装的错误',
        ErrorCategory.EXECUTION,
        ErrorSeverity.ERROR,
        undefined,
        cause
      );

      expect(error.cause).toBe(cause);
    });

    it('应该生成唯一的错误ID', () => {
      const error1 = new DevFlowBaseError(
        'TEST',
        '消息',
        ErrorCategory.UNKNOWN
      );
      const error2 = new DevFlowBaseError(
        'TEST',
        '消息',
        ErrorCategory.UNKNOWN
      );

      expect(error1.id).toBeDefined();
      expect(error2.id).toBeDefined();
      expect(error1.id).not.toBe(error2.id);
    });

    it('应该正确序列化为JSON', () => {
      const error = new DevFlowBaseError(
        'SERIALIZE_ERROR',
        '可序列化错误',
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        { field: 'test' }
      );

      const serialized = error.toJSON();

      expect(serialized).toMatchObject({
        id: error.id,
        name: 'DevFlowBaseError',
        code: 'SERIALIZE_ERROR',
        message: '可序列化错误',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.WARNING,
        context: { field: 'test' },
        timestamp: error.timestamp
      });
    });
  });

  describe('FlowExecutionError - 流程执行错误', () => {
    it('应该创建流程执行错误', () => {
      const error = new FlowExecutionError(
        'STEP_FAILED',
        '步骤执行失败',
        { step: 'build', phase: 'execution' }
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('FlowExecutionError');
      expect(error.code).toBe('FLOW_STEP_FAILED');
      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.context).toEqual({ step: 'build', phase: 'execution' });
    });

    it('应该自动添加FLOW_前缀到错误代码', () => {
      const error = new FlowExecutionError('INVALID_INPUT');

      expect(error.code).toBe('FLOW_INVALID_INPUT');
    });

    it('应该提供默认错误消息', () => {
      const error = new FlowExecutionError('UNKNOWN');

      expect(error.message).toContain('流程执行');
    });
  });

  describe('StateManagementError - 状态管理错误', () => {
    it('应该创建状态管理错误', () => {
      const error = new StateManagementError(
        'STATE_LOCKED',
        '状态已被锁定',
        { stateKey: 'project-context', lockOwner: 'process-123' }
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('StateManagementError');
      expect(error.code).toBe('STATE_STATE_LOCKED');
      expect(error.category).toBe(ErrorCategory.STATE_MANAGEMENT);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });

    it('应该为状态损坏错误设置CRITICAL级别', () => {
      const error = new StateManagementError('CORRUPTED', '状态文件损坏');

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('应该自动添加STATE_前缀到错误代码', () => {
      const error = new StateManagementError('NOT_FOUND');

      expect(error.code).toBe('STATE_NOT_FOUND');
    });
  });

  describe('FileNotFoundError - 文件未找到错误', () => {
    it('应该创建文件未找到错误', () => {
      const error = new FileNotFoundError(
        '/path/to/missing.txt',
        '配置文件'
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('FileNotFoundError');
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.category).toBe(ErrorCategory.FILE_OPERATION);
      expect(error.context).toEqual({
        filePath: '/path/to/missing.txt',
        fileType: '配置文件'
      });
    });

    it('应该提供详细的错误消息', () => {
      const error = new FileNotFoundError('/path/to/file.json');

      expect(error.message).toContain('/path/to/file.json');
    });
  });

  describe('PermissionDeniedError - 权限拒绝错误', () => {
    it('应该创建权限拒绝错误', () => {
      const error = new PermissionDeniedError(
        'write',
        '/protected/file.txt'
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('PermissionDeniedError');
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.category).toBe(ErrorCategory.PERMISSION);
      expect(error.context).toEqual({
        operation: 'write',
        resourcePath: '/protected/file.txt'
      });
    });

    it('应该生成描述性的错误消息', () => {
      const error = new PermissionDeniedError('read', '/secret/config.json');

      expect(error.message).toContain('读取');
      expect(error.message).toContain('/secret/config.json');
    });
  });

  describe('ValidationError - 验证错误', () => {
    it('应该创建验证错误', () => {
      const error = new ValidationError(
        'INVALID_PARAM',
        'userId',
        '必须为正整数',
        { providedValue: -1 }
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_INVALID_PARAM');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.context).toEqual({
        field: 'userId',
        constraint: '必须为正整数',
        providedValue: -1
      });
    });

    it('应该支持多个字段验证错误', () => {
      const errors = [
        { field: 'email', message: '格式无效' },
        { field: 'age', message: '必须大于0' }
      ];

      const error = new ValidationError(
        'MULTIPLE_FIELDS',
        undefined,
        undefined,
        { validationErrors: errors }
      );

      expect(error.context?.validationErrors).toEqual(errors);
    });
  });

  describe('NetworkError - 网络错误', () => {
    it('应该创建网络错误', () => {
      const error = new NetworkError(
        'CONNECTION_FAILED',
        '无法连接到服务器',
        { url: 'https://api.example.com', timeout: 5000 }
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe('NETWORK_CONNECTION_FAILED');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.context).toEqual({
        url: 'https://api.example.com',
        timeout: 5000
      });
    });

    it('应该为超时设置特定错误消息', () => {
      const error = new NetworkError('TIMEOUT', undefined, { timeout: 30000 });

      expect(error.message).toContain('超时');
    });
  });

  describe('ConfigurationError - 配置错误', () => {
    it('应该创建配置错误', () => {
      const error = new ConfigurationError(
        'MISSING_REQUIRED',
        'config.json',
        'apiKey',
        '必需的配置项缺失'
      );

      expect(error).toBeInstanceOf(DevFlowBaseError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('CONFIG_MISSING_REQUIRED');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.context).toEqual({
        configFile: 'config.json',
        configKey: 'apiKey',
        configValue: undefined
      });
    });

    it('应该支持配置值验证错误', () => {
      const error = new ConfigurationError(
        'INVALID_VALUE',
        '.env',
        'PORT',
        '必须为数字',
        'abc'
      );

      expect(error.message).toContain('PORT');
      expect(error.message).toContain('必须为数字');
      expect(error.context?.configValue).toBe('abc');
    });
  });

  describe('错误工具方法', () => {
    it('应该判断错误是否为DevFlowBaseError', () => {
      const devFlowError = new DevFlowBaseError('TEST', 'Test', ErrorCategory.UNKNOWN);
      const regularError = new Error('Regular error');

      expect(DevFlowBaseError.isDevFlowError(devFlowError)).toBe(true);
      expect(DevFlowBaseError.isDevFlowError(regularError)).toBe(false);
      expect(DevFlowBaseError.isDevFlowError(null)).toBe(false);
      expect(DevFlowBaseError.isDevFlowError(undefined)).toBe(false);
    });

    it('应该从Error创建DevFlowBaseError', () => {
      const originalError = new Error('原始错误');
      const devFlowError = DevFlowBaseError.fromError(
        originalError,
        'WRAPPED',
        ErrorCategory.EXECUTION
      );

      expect(devFlowError).toBeInstanceOf(DevFlowBaseError);
      expect(devFlowError.message).toContain('原始错误');
      expect(devFlowError.cause).toBe(originalError);
    });

    it('应该支持错误链式操作', () => {
      const cause = new Error('底层错误');
      const error1 = new DevFlowBaseError(
        'LEVEL_1',
        '第一层',
        ErrorCategory.EXECUTION,
        ErrorSeverity.ERROR,
        undefined,
        cause
      );

      const error2 = new DevFlowBaseError(
        'LEVEL_2',
        '第二层',
        ErrorCategory.EXECUTION,
        ErrorSeverity.ERROR,
        undefined,
        error1
      );

      expect(error2.cause).toBe(error1);
      expect(error2.cause).toBeInstanceOf(DevFlowBaseError);
      expect(error2.cause?.cause).toBe(cause);
    });
  });

  describe('边界情况', () => {
    it('应该处理空错误消息', () => {
      const error = new DevFlowBaseError(
        'TEST',
        '',
        ErrorCategory.UNKNOWN
      );

      expect(error.message).toBe('');
    });

    it('应该处理undefined上下文', () => {
      const error = new DevFlowBaseError(
        'TEST',
        'Test',
        ErrorCategory.UNKNOWN,
        ErrorSeverity.ERROR,
        undefined
      );

      expect(error.context).toBeUndefined();
    });

    it('应该处理undefined原因', () => {
      const error = new DevFlowBaseError(
        'TEST',
        'Test',
        ErrorCategory.UNKNOWN,
        ErrorSeverity.ERROR,
        undefined,
        undefined
      );

      expect(error.cause).toBeUndefined();
    });
  });
});
