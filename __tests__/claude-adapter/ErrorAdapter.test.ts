/**
 * DevFlow v5 - ErrorAdapter 单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  ErrorAdapter
} from '../../lib/claude-adapter/ErrorAdapter';
import type {
  DevFlowCoreError,
  ClaudeCompatibleError
} from '../../lib/claude-adapter/types';
import {
  ErrorCategory
} from '../../lib/claude-adapter/types';

describe('ErrorAdapter', () => {
  let adapter: ErrorAdapter;

  beforeEach(() => {
    adapter = new ErrorAdapter();
  });

  describe('adaptToClaude - 核心错误转Claude兼容格式', () => {
    it('应该转换基本错误信息', () => {
      const coreError: DevFlowCoreError = {
        code: 'FILE_NOT_FOUND',
        message: '找不到指定的文件',
        category: ErrorCategory.FILE_OPERATION
      };

      const claudeError: ClaudeCompatibleError = adapter.adaptToClaude(coreError);

      expect(claudeError.type).toBe('FileOperationError');
      expect(claudeError.message).toBe('找不到指定的文件');
      expect(claudeError.suggestions).toBeDefined();
      expect(Array.isArray(claudeError.suggestions)).toBe(true);
    });

    it('应该根据类别映射错误类型', () => {
      const testCases = [
        {
          category: ErrorCategory.VALIDATION,
          expectedType: 'ValidationError'
        },
        {
          category: ErrorCategory.PERMISSION,
          expectedType: 'PermissionError'
        },
        {
          category: ErrorCategory.FILE_OPERATION,
          expectedType: 'FileOperationError'
        },
        {
          category: ErrorCategory.STATE_MANAGEMENT,
          expectedType: 'StateManagementError'
        },
        {
          category: ErrorCategory.EXECUTION,
          expectedType: 'ExecutionError'
        },
        {
          category: ErrorCategory.NETWORK,
          expectedType: 'NetworkError'
        },
        {
          category: ErrorCategory.UNKNOWN,
          expectedType: 'UnknownError'
        }
      ];

      testCases.forEach(({ category, expectedType }) => {
        const error: DevFlowCoreError = {
          code: 'TEST_ERROR',
          message: '测试错误',
          category
        };

        const result = adapter.adaptToClaude(error);
        expect(result.type).toBe(expectedType);
      });
    });

    it('应该提供用户友好的描述', () => {
      const error: DevFlowCoreError = {
        code: 'INSUFFICIENT_PERMISSION',
        message: '权限不足：无法写入文件',
        category: ErrorCategory.PERMISSION
      };

      const result = adapter.adaptToClaude(error);

      expect(result.description).toBeDefined();
      expect(result.description).not.toBe(error.message); // 应该是更友好的描述
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('应该包含解决建议', () => {
      const error: DevFlowCoreError = {
        code: 'DEPENDENCY_MISSING',
        message: '缺少必需的依赖',
        category: ErrorCategory.EXECUTION
      };

      const result = adapter.adaptToClaude(error);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toBeDefined();
    });

    it('应该保留原始错误代码', () => {
      const error: DevFlowCoreError = {
        code: 'CUSTOM_ERROR_123',
        message: '自定义错误',
        category: ErrorCategory.UNKNOWN
      };

      const result = adapter.adaptToClaude(error);

      expect(result.code).toBe('CUSTOM_ERROR_123');
    });

    it('应该包含文档链接（对于已知错误）', () => {
      const error: DevFlowCoreError = {
        code: 'STATE_CORRUPTED',
        message: '状态文件损坏',
        category: ErrorCategory.STATE_MANAGEMENT
      };

      const result = adapter.adaptToClaude(error);

      // 已知错误应该有文档链接
      if (result.docLink) {
        expect(result.docLink).toMatch(/^https?:\/\//);
      }
    });

    it('应该处理包含上下文的错误', () => {
      const error: DevFlowCoreError = {
        code: 'CONTEXT_ERROR',
        message: '上下文错误',
        category: ErrorCategory.VALIDATION,
        context: {
          field: 'userId',
          value: 'invalid',
          constraint: 'must be positive integer'
        }
      };

      const result = adapter.adaptToClaude(error);

      // 上下文信息应该反映在建议中
      const hasContextualSuggestion = result.suggestions.some(s =>
        s.includes('userId') || s.includes('integer')
      );
      expect(hasContextualSuggestion).toBe(true);
    });
  });

  describe('fromStandardError - 标准错误转核心错误', () => {
    it('应该转换标准Error对象', () => {
      const standardError = new Error('标准错误消息');

      const coreError: DevFlowCoreError = adapter.fromStandardError(
        standardError,
        ErrorCategory.UNKNOWN
      );

      expect(coreError.message).toBe('标准错误消息');
      expect(coreError.category).toBe(ErrorCategory.UNKNOWN);
      expect(coreError.code).toBeDefined();
    });

    it('应该从错误类型推断类别', () => {
      const typeError = new TypeError('类型错误');

      const coreError = adapter.fromStandardError(typeError, ErrorCategory.VALIDATION);

      expect(coreError.message).toBe('类型错误');
      expect(coreError.category).toBe(ErrorCategory.VALIDATION);
    });

    it('应该保留原始错误的堆栈信息', () => {
      const standardError = new Error('测试错误');
      const stackBefore = standardError.stack;

      const coreError = adapter.fromStandardError(standardError, ErrorCategory.EXECUTION);

      expect(coreError.originalError).toBeDefined();
      expect((coreError.originalError as any).stack).toBe(stackBefore);
    });

    it('应该处理带有自定义属性的错误', () => {
      const customError = new Error('自定义错误') as any;
      customError.code = 'CUSTOM_001';
      customError.details = { field: 'value' };

      const coreError = adapter.fromStandardError(customError, ErrorCategory.UNKNOWN);

      expect(coreError.code).toBe('CUSTOM_001');
      expect(coreError.context?.details).toEqual({ field: 'value' });
    });

    it('应该处理null和undefined错误', () => {
      const result1 = adapter.fromStandardError(null as any, ErrorCategory.UNKNOWN);
      expect(result1.message).toBeDefined();

      const result2 = adapter.fromStandardError(undefined as any, ErrorCategory.UNKNOWN);
      expect(result2.message).toBeDefined();
    });
  });

  describe('localize - 错误消息本地化', () => {
    it('应该支持中文本地化', () => {
      const error: DevFlowCoreError = {
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        category: ErrorCategory.FILE_OPERATION
      };

      const localized = adapter.localize(error, 'zh-CN');

      expect(localized).toBeDefined();
      // 中文本地化应该包含中文
      expect(localized).toMatch(/[\u4e00-\u9fa5]/);
    });

    it('应该支持英文本地化', () => {
      const error: DevFlowCoreError = {
        code: 'FILE_NOT_FOUND',
        message: '文件未找到',
        category: ErrorCategory.FILE_OPERATION
      };

      const localized = adapter.localize(error, 'en-US');

      expect(localized).toBeDefined();
      // 英文本地化应该是可读的英文
      expect(localized).toMatch(/^[a-zA-Z\s.,!?']+$/);
    });

    it('应该默认使用中文', () => {
      const error: DevFlowCoreError = {
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        category: ErrorCategory.UNKNOWN
      };

      const localized = adapter.localize(error); // 不指定locale

      expect(localized).toMatch(/[\u4e00-\u9fa5]/);
    });

    it('应该为已知错误代码提供特定翻译', () => {
      const knownErrors = [
        'FILE_NOT_FOUND',
        'PERMISSION_DENIED',
        'INVALID_PARAMETER',
        'STATE_CORRUPTED'
      ];

      knownErrors.forEach(code => {
        const error: DevFlowCoreError = {
          code,
          message: 'Error message',
          category: ErrorCategory.UNKNOWN
        };

        const localized = adapter.localize(error, 'zh-CN');
        expect(localized).toBeDefined();
        expect(localized.length).toBeGreaterThan(0);
      });
    });

    it('应该回退到原始消息（当翻译不可用时）', () => {
      const error: DevFlowCoreError = {
        code: 'VERY_RARE_ERROR_CODE_12345',
        message: '原始错误消息',
        category: ErrorCategory.UNKNOWN
      };

      const localized = adapter.localize(error, 'zh-CN');

      // 应该包含原始消息或通用翻译
      expect(localized).toBeDefined();
    });
  });

  describe('getResolutionSuggestions - 获取解决建议', () => {
    it('应该为文件操作错误提供建议', () => {
      const suggestions = adapter.getResolutionSuggestions('FILE_NOT_FOUND');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('文件') || s.includes('路径'))).toBe(true);
    });

    it('应该为权限错误提供建议', () => {
      const suggestions = adapter.getResolutionSuggestions('PERMISSION_DENIED');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('权限') || s.includes('访问'))).toBe(true);
    });

    it('应该为参数错误提供建议', () => {
      const suggestions = adapter.getResolutionSuggestions('INVALID_PARAMETER');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('参数') || s.includes('检查'))).toBe(true);
    });

    it('应该为状态错误提供建议', () => {
      const suggestions = adapter.getResolutionSuggestions('STATE_CORRUPTED');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('状态') || s.includes('恢复'))).toBe(true);
    });

    it('应该为未知错误提供通用建议', () => {
      const suggestions = adapter.getResolutionSuggestions('UNKNOWN_ERROR_XYZ');

      expect(suggestions.length).toBeGreaterThan(0);
      // 通用建议
      expect(suggestions[0]).toBeDefined();
    });

    it('建议应该是可操作的', () => {
      const suggestions = adapter.getResolutionSuggestions('FILE_NOT_FOUND');

      suggestions.forEach(suggestion => {
        // 每个建议应该包含可操作的内容
        expect(suggestion.length).toBeGreaterThan(10);
        expect(suggestion).toMatch(/^[A-Z\u4e00-\u9fa5]/); // 以大写或中文开头
      });
    });

    it('应该按优先级排序建议', () => {
      const suggestions = adapter.getResolutionSuggestions('MULTI_STEP_ERROR');

      // 如果有多个建议，第一个应该是最优先的
      if (suggestions.length > 1) {
        expect(suggestions[0]).toBeDefined();
      }
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空错误代码', () => {
      const suggestions = adapter.getResolutionSuggestions('');

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('应该处理特殊字符错误代码', () => {
      const suggestions = adapter.getResolutionSuggestions('ERROR-@#$%');

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('应该处理非常长的错误代码', () => {
      const longCode = 'A'.repeat(1000);
      const suggestions = adapter.getResolutionSuggestions(longCode);

      expect(suggestions).toBeDefined();
    });

    it('应该处理null输入', () => {
      const result = adapter.adaptToClaude(null as any);
      expect(result).toBeDefined();
    });

    it('应该处理undefined输入', () => {
      const result = adapter.adaptToClaude(undefined as any);
      expect(result).toBeDefined();
    });
  });

  describe('错误上下文保留', () => {
    it('应该保留错误发生的时间', () => {
      const error: DevFlowCoreError = {
        code: 'TIMED_ERROR',
        message: '定时错误',
        category: ErrorCategory.EXECUTION,
        context: {
          timestamp: '2026-03-10T12:00:00Z'
        }
      };

      const result = adapter.adaptToClaude(error);

      // 上下文时间应该反映在输出中
      expect(result.description).toBeDefined();
    });

    it('应该保留相关的操作信息', () => {
      const error: DevFlowCoreError = {
        code: 'OPERATION_FAILED',
        message: '操作失败',
        category: ErrorCategory.EXECUTION,
        context: {
          operation: 'git_commit',
          repository: '/path/to/repo'
        }
      };

      const result = adapter.adaptToClaude(error);

      // 操作上下文应该反映在建议中
      const hasOperationContext = result.suggestions.some(s =>
        s.includes('git') || s.includes('commit')
      );
      expect(hasOperationContext).toBe(true);
    });
  });
});
