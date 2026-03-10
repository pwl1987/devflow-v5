/**
 * DevFlow v5 - Claude Skills 错误适配器
 *
 * 职责：将核心模块错误转换为 Claude 友好的格式
 */

import type {
  IErrorAdapter,
  DevFlowCoreError,
  ClaudeCompatibleError
} from './types';
import {
  ErrorCategory
} from './types';

/**
 * 错误类型映射
 */
const ERROR_TYPE_MAP: Record<ErrorCategory, string> = {
  [ErrorCategory.VALIDATION]: 'ValidationError',
  [ErrorCategory.PERMISSION]: 'PermissionError',
  [ErrorCategory.FILE_OPERATION]: 'FileOperationError',
  [ErrorCategory.STATE_MANAGEMENT]: 'StateManagementError',
  [ErrorCategory.EXECUTION]: 'ExecutionError',
  [ErrorCategory.NETWORK]: 'NetworkError',
  [ErrorCategory.UNKNOWN]: 'UnknownError'
};

/**
 * 错误描述模板
 */
const ERROR_DESCRIPTIONS: Record<string, string> = {
  'FILE_NOT_FOUND': '系统无法找到指定的文件。这可能是因为文件路径错误、文件已被删除或移动。',
  'PERMISSION_DENIED': '您没有足够的权限执行此操作。请检查文件权限或联系管理员。',
  'INVALID_PARAMETER': '提供的参数不符合要求。请检查参数类型和格式是否正确。',
  'STATE_CORRUPTED': '项目状态文件已损坏。可能由于意外关闭或并发修改导致。',
  'DEPENDENCY_MISSING': '缺少必需的依赖项。请安装所需的依赖后再试。',
  'NETWORK_ERROR': '网络连接出现问题。请检查网络连接并重试。',
  'TIMEOUT': '操作超时。请稍后重试或增加超时时间。'
};

/**
 * 错误解决建议库
 */
const ERROR_SUGGESTIONS: Record<string, string[]> = {
  'FILE_NOT_FOUND': [
    '检查文件路径是否正确存在',
    '确认文件是否存在于指定位置',
    '检查文件名和扩展名是否拼写正确',
    '尝试使用绝对路径而非相对路径'
  ],
  'PERMISSION_DENIED': [
    '检查文件和目录的访问权限',
    '确保当前用户有读取/写入权限',
    '尝试使用 sudo 或以管理员身份运行',
    '联系系统管理员获取所需权限'
  ],
  'INVALID_PARAMETER': [
    '检查参数类型是否正确',
    '查看文档了解正确的参数格式',
    '确保所有必需参数都已提供',
    '验证参数值在有效范围内'
  ],
  'STATE_CORRUPTED': [
    '尝试使用 `/devflow --resync` 重新同步状态',
    '删除损坏的状态文件并重新开始',
    '检查是否有其他进程正在修改状态文件',
    '从备份中恢复状态文件'
  ],
  'DEPENDENCY_MISSING': [
    '运行 `npm install` 或相应的包管理器命令',
    '检查 package.json 中的依赖项',
    '确保所有依赖项版本兼容',
    '尝试清理缓存后重新安装'
  ],
  'NETWORK_ERROR': [
    '检查网络连接是否正常',
    '确认防火墙设置没有阻止连接',
    '验证目标服务器是否在线',
    '稍后重试或检查代理设置'
  ],
  'TIMEOUT': [
    '增加操作的超时时间',
    '检查网络速度和稳定性',
    '减少单次操作的数据量',
    '尝试在非高峰时段执行'
  ],
  'INSUFFICIENT_PERMISSION': [
    '检查文件系统的访问权限设置',
    '确保以正确的用户身份运行',
    '验证所需的访问权限是否完整',
    '联系管理员获取所需权限'
  ],
  'MULTI_STEP_ERROR': [
    '检查每个步骤的错误日志',
    '逐步排查问题的源头',
    '尝试跳过失败的步骤（如果可能）',
    '联系技术支持获取更多帮助'
  ]
};

/**
 * 本地化错误消息（中文）
 */
const LOCALIZED_MESSAGES: Record<string, string> = {
  'FILE_NOT_FOUND': '找不到指定的文件',
  'PERMISSION_DENIED': '权限不足，无法访问',
  'INVALID_PARAMETER': '参数无效或格式错误',
  'STATE_CORRUPTED': '状态文件已损坏',
  'DEPENDENCY_MISSING': '缺少必需的依赖',
  'NETWORK_ERROR': '网络连接失败',
  'TIMEOUT': '操作超时',
  'UNKNOWN_ERROR': '发生未知错误'
};

/**
 * 错误适配器实现
 */
export class ErrorAdapter implements IErrorAdapter {
  /**
   * 将核心错误转换为 Claude 兼容格式
   */
  public adaptToClaude(error: DevFlowCoreError): ClaudeCompatibleError {
    if (!error) {
      return this.createEmptyClaudeError();
    }

    const errorType = ERROR_TYPE_MAP[error.category] || 'UnknownError';

    return {
      type: errorType,
      message: error.message,
      description: ERROR_DESCRIPTIONS[error.code] || this.generateGenericDescription(error),
      suggestions: this.generateContextualSuggestions(error),
      code: error.code,
      docLink: this.getDocumentationLink(error.code)
    };
  }

  /**
   * 从标准错误创建核心错误
   */
  public fromStandardError(standardError: Error, category: ErrorCategory): DevFlowCoreError {
    if (!standardError) {
      return {
        code: 'NULL_ERROR',
        message: '错误对象为空',
        category: ErrorCategory.UNKNOWN
      };
    }

    const coreError: DevFlowCoreError = {
      code: this.extractErrorCode(standardError),
      message: standardError.message || '未知错误',
      category,
      originalError: standardError
    };

    // 提取自定义属性
    if ('code' in standardError) {
      coreError.code = (standardError as any).code;
    }

    if ('details' in standardError) {
      coreError.context = {
        details: (standardError as any).details
      };
    }

    return coreError;
  }

  /**
   * 本地化错误消息
   */
  public localize(error: DevFlowCoreError, locale: string = 'zh-CN'): string {
    const key = error.code;

    // 英文本地化
    if (locale === 'en-US' || locale.startsWith('en')) {
      const englishMessages: Record<string, string> = {
        'FILE_NOT_FOUND': 'File not found',
        'PERMISSION_DENIED': 'Permission denied',
        'INVALID_PARAMETER': 'Invalid parameter',
        'STATE_CORRUPTED': 'State file corrupted',
        'DEPENDENCY_MISSING': 'Missing required dependency',
        'NETWORK_ERROR': 'Network connection failed',
        'TIMEOUT': 'Operation timed out',
        'UNKNOWN_ERROR': 'An unknown error occurred'
      };

      if (englishMessages[key]) {
        return englishMessages[key];
      }

      const genericEnglishMessages: Record<string, string> = {
        [ErrorCategory.VALIDATION]: 'Input validation failed',
        [ErrorCategory.PERMISSION]: 'Insufficient permissions',
        [ErrorCategory.FILE_OPERATION]: 'File operation failed',
        [ErrorCategory.STATE_MANAGEMENT]: 'State management error',
        [ErrorCategory.EXECUTION]: 'Execution failed',
        [ErrorCategory.NETWORK]: 'Network error',
        [ErrorCategory.UNKNOWN]: 'An error occurred'
      };

      return genericEnglishMessages[error.category] || error.message;
    }

    // 中文本地化（默认）
    const localized = LOCALIZED_MESSAGES[key];

    if (localized) {
      return localized;
    }

    // 根据类别返回通用消息
    const genericMessages: Record<string, string> = {
      [ErrorCategory.VALIDATION]: '输入验证失败',
      [ErrorCategory.PERMISSION]: '权限不足',
      [ErrorCategory.FILE_OPERATION]: '文件操作失败',
      [ErrorCategory.STATE_MANAGEMENT]: '状态管理错误',
      [ErrorCategory.EXECUTION]: '执行失败',
      [ErrorCategory.NETWORK]: '网络错误',
      [ErrorCategory.UNKNOWN]: '发生错误'
    };

    return genericMessages[error.category] || error.message;
  }

  /**
   * 获取错误解决建议
   */
  public getResolutionSuggestions(errorCode: string): string[] {
    // 规范化错误代码
    const normalizedCode = errorCode.toUpperCase().trim();

    // 查找精确匹配
    if (ERROR_SUGGESTIONS[normalizedCode]) {
      return [...ERROR_SUGGESTIONS[normalizedCode]];
    }

    // 查找前缀匹配
    for (const [key, suggestions] of Object.entries(ERROR_SUGGESTIONS)) {
      if (normalizedCode.startsWith(key) || key.startsWith(normalizedCode)) {
        return [...suggestions];
      }
    }

    // 通用建议
    return [
      '检查错误日志获取更多详细信息',
      '查看文档了解正确的使用方法',
      '尝试重启操作或重新启动系统',
      '联系技术支持获取帮助'
    ];
  }

  /**
   * 创建空的 Claude 错误对象
   */
  private createEmptyClaudeError(): ClaudeCompatibleError {
    return {
      type: 'UnknownError',
      message: '未提供错误信息',
      description: '未提供错误详情',
      suggestions: ['请提供更多错误信息']
    };
  }

  /**
   * 生成通用错误描述
   */
  private generateGenericDescription(error: DevFlowCoreError): string {
    const categoryDescriptions: Record<ErrorCategory, string> = {
      [ErrorCategory.VALIDATION]: '输入验证失败。请检查提供的参数是否符合要求。',
      [ErrorCategory.PERMISSION]: '权限不足。请确认您有执行此操作所需的权限。',
      [ErrorCategory.FILE_OPERATION]: '文件操作失败。请检查文件路径和权限。',
      [ErrorCategory.STATE_MANAGEMENT]: '状态管理错误。项目状态可能已损坏或丢失。',
      [ErrorCategory.EXECUTION]: '执行失败。操作无法完成。',
      [ErrorCategory.NETWORK]: '网络错误。无法连接到服务器或资源。',
      [ErrorCategory.UNKNOWN]: '未知错误。发生了意外情况。'
    };

    return categoryDescriptions[error.category] || '发生了错误。';
  }

  /**
   * 生成上下文相关的建议
   */
  private generateContextualSuggestions(error: DevFlowCoreError): string[] {
    // 首先从错误代码获取建议
    const codeSuggestions = this.getResolutionSuggestions(error.code);

    // 如果有上下文信息，添加特定建议
    if (error.context) {
      const contextSuggestions: string[] = [];

      // 检查字段相关的上下文
      if (error.context.field) {
        contextSuggestions.push(`检查字段 "${error.context.field}" 的值`);
      }

      // 检查操作相关的上下文
      if (error.context.operation) {
        contextSuggestions.push(`验证操作 "${error.context.operation}" 的参数`);
      }

      // 检查路径相关的上下文
      if (error.context.path) {
        contextSuggestions.push(`确认路径 "${error.context.path}" 有效`);
      }

      return [...codeSuggestions, ...contextSuggestions];
    }

    return codeSuggestions;
  }

  /**
   * 提取错误代码
   */
  private extractErrorCode(error: Error): string {
    // 尝试从错误消息中提取代码
    const message = error.message || '';

    // 常见模式: CODE: message, [CODE] message, CODE - message
    const patterns = [
      /^([A-Z_0-9]+):\s*/,
      /^\[([A-Z_0-9]+)\]\s*/,
      /^([A-Z_0-9]+)\s*-\s*/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // 根据错误名称推断代码
    if (error instanceof TypeError) {
      return 'TYPE_ERROR';
    } else if (error instanceof SyntaxError) {
      return 'SYNTAX_ERROR';
    } else if (error instanceof RangeError) {
      return 'RANGE_ERROR';
    } else if (error instanceof ReferenceError) {
      return 'REFERENCE_ERROR';
    }

    // 检查自定义代码属性
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    // 生成通用代码
    return 'GENERIC_ERROR';
  }

  /**
   * 获取文档链接
   */
  private getDocumentationLink(errorCode: string): string | undefined {
    const docLinks: Record<string, string> = {
      'STATE_CORRUPTED': 'https://github.com/pwl1987/devflow-v5/wiki/Troubleshooting#state-errors',
      'DEPENDENCY_MISSING': 'https://github.com/pwl1987/devflow-v5/wiki/Installation',
      'PERMISSION_DENIED': 'https://github.com/pwl1987/devflow-v5/wiki/Permissions'
    };

    return docLinks[errorCode];
  }
}

// 导出类型
export { ErrorCategory };
export type { DevFlowCoreError, ClaudeCompatibleError };
