/**
 * DevFlow v5 - 统一错误体系
 *
 * 职责：提供结构化、可追踪、可序列化的错误处理
 */

/**
 * 错误类别枚举
 */
export enum ErrorCategory {
  /** 验证错误 - 输入验证失败 */
  VALIDATION = 'validation',
  /** 权限错误 - 权限不足 */
  PERMISSION = 'permission',
  /** 文件操作错误 - 文件相关操作失败 */
  FILE_OPERATION = 'file_operation',
  /** 状态管理错误 - 状态管理失败 */
  STATE_MANAGEMENT = 'state_management',
  /** 执行错误 - 流程执行失败 */
  EXECUTION = 'execution',
  /** 网络错误 - 网络相关失败 */
  NETWORK = 'network',
  /** 安全错误 - 安全相关问题 */
  SECURITY = 'security',
  /** 未知错误 - 未分类错误 */
  UNKNOWN = 'unknown'
}

/**
 * 错误严重级别枚举
 */
export enum ErrorSeverity {
  /** 信息 - 不影响系统运行 */
  INFO = 'info',
  /** 警告 - 可能的问题但可以继续 */
  WARNING = 'warning',
  /** 错误 - 操作失败但不影响整体系统 */
  ERROR = 'error',
  /** 关键 - 严重问题，需要立即处理 */
  CRITICAL = 'critical'
}

/**
 * DevFlow 基础错误类
 *
 * 所有 DevFlow 错误的基类，提供统一的错误处理接口
 */
export class DevFlowBaseError extends Error {
  /** 错误唯一ID */
  public readonly id: string;

  /** 错误名称 */
  public override name: string;

  /** 错误代码 */
  public readonly code: string;

  /** 错误类别 */
  public readonly category: ErrorCategory;

  /** 错误严重级别 */
  public readonly severity: ErrorSeverity;

  /** 错误时间戳 */
  public readonly timestamp: string;

  /** 错误上下文信息 */
  public readonly context?: Record<string, unknown>;

  /** 原始错误（错误链） */
  public readonly cause?: Error;

  /**
   * 构造函数
   * @param code 错误代码
   * @param message 错误消息
   * @param category 错误类别
   * @param severity 错误严重级别
   * @param context 错误上下文
   * @param cause 原始错误
   */
  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);

    this.name = this.constructor.name;
    this.id = this.generateErrorId();
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.cause = cause;

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // 设置原型链
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * 生成唯一错误ID
   */
  private generateErrorId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `err_${timestamp}_${random}`;
  }

  /**
   * 将错误序列化为JSON
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined,
      stack: this.stack
    };
  }

  /**
   * 判断是否为 DevFlow 错误
   */
  public static isDevFlowError(error: unknown): error is DevFlowBaseError {
    return error instanceof DevFlowBaseError;
  }

  /**
   * 从标准 Error 创建 DevFlow 错误
   */
  public static fromError(
    error: Error,
    code: string,
    category: ErrorCategory,
    context?: Record<string, unknown>
  ): DevFlowBaseError {
    return new DevFlowBaseError(
      code,
      error.message,
      category,
      ErrorSeverity.ERROR,
      context,
      error
    );
  }
}

/**
 * 流程执行错误
 */
export class FlowExecutionError extends DevFlowBaseError {
  constructor(
    errorCode: string,
    message?: string,
    context?: Record<string, unknown>
  ) {
    const fullCode = `FLOW_${errorCode}`;
    const fullMessage = message || `流程执行失败: ${errorCode}`;
    super(fullCode, fullMessage, ErrorCategory.EXECUTION, ErrorSeverity.ERROR, context);
  }
}

/**
 * 状态管理错误
 */
export class StateManagementError extends DevFlowBaseError {
  constructor(
    errorCode: string,
    message?: string,
    context?: Record<string, unknown>
  ) {
    const fullCode = `STATE_${errorCode}`;
    const fullMessage = message || `状态管理错误: ${errorCode}`;

    // 状态损坏错误设为 CRITICAL
    const severity = errorCode === 'CORRUPTED' || errorCode === 'LOST'
      ? ErrorSeverity.CRITICAL
      : ErrorSeverity.WARNING;

    super(fullCode, fullMessage, ErrorCategory.STATE_MANAGEMENT, severity, context);
  }
}

/**
 * 文件未找到错误
 */
export class FileNotFoundError extends DevFlowBaseError {
  constructor(filePath: string, fileType?: string) {
    const message = fileType
      ? `找不到${fileType}: ${filePath}`
      : `文件未找到: ${filePath}`;

    super(
      'FILE_NOT_FOUND',
      message,
      ErrorCategory.FILE_OPERATION,
      ErrorSeverity.ERROR,
      { filePath, fileType }
    );
  }
}

/**
 * 权限拒绝错误
 */
export class PermissionDeniedError extends DevFlowBaseError {
  constructor(operation: string, resourcePath: string) {
    const operationMap: Record<string, string> = {
      read: '读取',
      write: '写入',
      execute: '执行',
      delete: '删除'
    };

    const operationText = operationMap[operation] || operation;
    const message = `权限不足：无法${operationText} ${resourcePath}`;

    super(
      'PERMISSION_DENIED',
      message,
      ErrorCategory.PERMISSION,
      ErrorSeverity.ERROR,
      { operation, resourcePath }
    );
  }
}

/**
 * 验证错误
 */
export class ValidationError extends DevFlowBaseError {
  constructor(
    errorCode: string,
    field?: string,
    constraint?: string,
    context?: Record<string, unknown>
  ) {
    const fullCode = `VALIDATION_${errorCode}`;
    let message: string;

    if (field && constraint) {
      message = `验证失败: ${field} - ${constraint}`;
    } else if (field) {
      message = `验证失败: ${field}`;
    } else {
      message = `验证错误: ${errorCode}`;
    }

    super(
      fullCode,
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.WARNING,
      { field, constraint, ...context }
    );
  }
}

/**
 * 网络错误
 */
export class NetworkError extends DevFlowBaseError {
  constructor(
    errorCode: string,
    message?: string,
    context?: Record<string, unknown>
  ) {
    const fullCode = `NETWORK_${errorCode}`;
    let fullMessage = message;

    if (!fullMessage) {
      if (errorCode === 'TIMEOUT') {
        fullMessage = `网络请求超时${context?.timeout ? ` (${context.timeout}ms)` : ''}`;
      } else if (errorCode === 'CONNECTION_FAILED') {
        fullMessage = '无法连接到服务器';
      } else {
        fullMessage = `网络错误: ${errorCode}`;
      }
    }

    super(fullCode, fullMessage, ErrorCategory.NETWORK, ErrorSeverity.WARNING, context);
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends DevFlowBaseError {
  constructor(
    errorCode: string,
    configFile: string,
    configKey?: string,
    constraint?: string,
    configValue?: unknown
  ) {
    const fullCode = `CONFIG_${errorCode}`;
    let message: string;

    if (configKey && constraint) {
      message = `配置错误 [${configFile}]: ${configKey} - ${constraint}`;
    } else if (configKey) {
      message = `配置错误 [${configFile}]: ${configKey}`;
    } else {
      message = `配置错误 [${configFile}]: ${errorCode}`;
    }

    super(
      fullCode,
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.ERROR,
      { configFile, configKey, configValue }
    );
  }
}

/**
 * 路径遍历错误
 */
export class PathTraversalError extends DevFlowBaseError {
  constructor(filePath: string, reason?: string) {
    const message = reason
      ? `路径遍历检测: ${filePath} - ${reason}`
      : `路径遍历检测: ${filePath}`;

    super(
      'PATH_TRAVERSAL',
      message,
      ErrorCategory.SECURITY,
      ErrorSeverity.CRITICAL,
      { filePath, reason }
    );
  }
}

/**
 * 文件类型不允许错误
 */
export class FileTypeNotAllowedError extends DevFlowBaseError {
  constructor(filePath: string, reason?: string) {
    const message = reason
      ? `文件类型不允许: ${filePath} - ${reason}`
      : `文件类型不允许: ${filePath}`;

    super(
      'FILE_TYPE_NOT_ALLOWED',
      message,
      ErrorCategory.SECURITY,
      ErrorSeverity.ERROR,
      { filePath, reason }
    );
  }
}

/**
 * 文件大小超限错误
 */
export class FileSizeExceededError extends DevFlowBaseError {
  constructor(filePath: string, maxSize: number, reason?: string) {
    // 格式化大小显示
    let sizeText: string;
    if (maxSize >= 1024 * 1024) {
      sizeText = `${(maxSize / (1024 * 1024)).toFixed(0)}MB`;
    } else if (maxSize >= 1024) {
      sizeText = `${(maxSize / 1024).toFixed(0)}KB`;
    } else {
      sizeText = `${maxSize} bytes`;
    }

    const message = reason
      ? `文件大小超限: ${filePath} - ${reason}`
      : `文件大小超过限制 (${sizeText}): ${filePath}`;

    super(
      'FILE_SIZE_EXCEEDED',
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.ERROR,
      { filePath, maxSize, sizeText }
    );
  }
}
