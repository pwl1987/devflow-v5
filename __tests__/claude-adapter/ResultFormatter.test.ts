/**
 * DevFlow v5 - ResultFormatter 单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  ResultFormatter
} from '../../lib/claude-adapter/ResultFormatter';
import type {
  ClaudeSkillOutput,
  DevFlowCoreError,
  ProgressInfo,
  StatusReport
} from '../../lib/claude-adapter/types';
import {
  OutputStatus,
  ErrorSeverity,
  ErrorCategory
} from '../../lib/claude-adapter/types';

describe('ResultFormatter', () => {
  let formatter: ResultFormatter;

  beforeEach(() => {
    formatter = new ResultFormatter();
  });

  describe('formatSuccess - 成功结果格式化', () => {
    it('应该格式化简单成功结果', () => {
      const data = { message: '操作成功完成' };

      const result: ClaudeSkillOutput = formatter.formatSuccess(data);

      expect(result.success).toBe(true);
      expect(result.status).toBe(OutputStatus.SUCCESS);
      expect(result.content).toContain('操作成功完成');
      expect(result.errors).toBeUndefined();
    });

    it('应该包含元数据信息', () => {
      const data = { completedTasks: 5 };
      const metadata = {
        timestamp: '2026-03-10T12:00:00Z',
        duration: 1500,
        statistics: {
          completedTasks: 5,
          totalTasks: 10
        }
      };

      const result: ClaudeSkillOutput = formatter.formatSuccess(data, metadata);

      expect(result.success).toBe(true);
      expect(result.metadata?.timestamp).toBe('2026-03-10T12:00:00Z');
      expect(result.metadata?.duration).toBe(1500);
      expect(result.metadata?.statistics?.completedTasks).toBe(5);
    });

    it('应该格式化复杂数据结构为Markdown', () => {
      const data = {
        projectName: '测试项目',
        stories: [
          { id: 'E001-S001', title: '故事1', status: 'completed' },
          { id: 'E001-S002', title: '故事2', status: 'pending' }
        ]
      };

      const result: ClaudeSkillOutput = formatter.formatSuccess(data);

      expect(result.content).toContain('# 测试项目');
      expect(result.content).toContain('E001-S001');
      expect(result.content).toContain('故事1');
      expect(result.content).toContain('✓'); // 完成标记
    });

    it('应该添加推荐操作', () => {
      const data = { status: 'ready' };
      const metadata = {
        timestamp: new Date().toISOString(),
        duration: 100
      };

      const result: ClaudeSkillOutput = formatter.formatSuccess(data, metadata);

      // 成功状态应该有推荐的下一步
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('formatFailure - 失败结果格式化', () => {
    it('应该格式化错误信息', () => {
      const error: DevFlowCoreError = {
        code: 'FILE_NOT_FOUND',
        message: '找不到指定的文件',
        category: ErrorCategory.FILE_OPERATION
      };

      const result: ClaudeSkillOutput = formatter.formatFailure(error);

      expect(result.success).toBe(false);
      expect(result.status).toBe(OutputStatus.FAILED);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0].code).toBe('FILE_NOT_FOUND');
      expect(result.errors?.[0].message).toContain('找不到指定的文件');
    });

    it('应该根据错误类别设置严重级别', () => {
      const permissionError: DevFlowCoreError = {
        code: 'ACCESS_DENIED',
        message: '权限不足',
        category: ErrorCategory.PERMISSION
      };

      const result1: ClaudeSkillOutput = formatter.formatFailure(permissionError);
      expect(result1.errors?.[0].severity).toBe(ErrorSeverity.ERROR);

      const validationError: DevFlowCoreError = {
        code: 'INVALID_PARAM',
        message: '参数无效',
        category: ErrorCategory.VALIDATION
      };

      const result2: ClaudeSkillOutput = formatter.formatFailure(validationError);
      expect(result2.errors?.[0].severity).toBe(ErrorSeverity.WARNING);
    });

    it('应该包含解决建议', () => {
      const error: DevFlowCoreError = {
        code: 'STATE_CORRUPTED',
        message: '状态文件已损坏',
        category: ErrorCategory.STATE_MANAGEMENT
      };

      const result: ClaudeSkillOutput = formatter.formatFailure(error);

      expect(result.errors?.[0].resolution).toBeDefined();
      expect(result.errors?.[0].resolution).toContain('恢复');
    });

    it('应该格式化多个错误', () => {
      const error: DevFlowCoreError = {
        code: 'MULTIPLE_ERRORS',
        message: '多个错误',
        category: ErrorCategory.EXECUTION,
        context: {
          errors: [
            { code: 'ERR1', message: '错误1' },
            { code: 'ERR2', message: '错误2' }
          ]
        }
      };

      const result: ClaudeSkillOutput = formatter.formatFailure(error);

      expect(result.errors?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('formatProgress - 进度更新格式化', () => {
    it('应该格式化进度信息', () => {
      const progress: ProgressInfo = {
        currentStep: '执行测试',
        totalSteps: 10,
        currentStepIndex: 5,
        percentComplete: 50,
        currentOperation: '运行单元测试',
        estimatedTimeRemaining: 30000
      };

      const result: ClaudeSkillOutput = formatter.formatProgress(progress);

      expect(result.success).toBe(true);
      expect(result.content).toContain('50%');
      expect(result.content).toContain('执行测试');
      expect(result.content).toContain('5/10');
    });

    it('应该显示进度条', () => {
      const progress: ProgressInfo = {
        currentStep: '步骤3',
        totalSteps: 5,
        currentStepIndex: 2,
        percentComplete: 40
      };

      const result: ClaudeSkillOutput = formatter.formatProgress(progress);

      // 应该包含可视化的进度条
      expect(result.content).toMatch(/\[=* *\]/); // 进度条模式
    });

    it('应该显示预计剩余时间', () => {
      const progress: ProgressInfo = {
        currentStep: '处理中',
        totalSteps: 10,
        currentStepIndex: 3,
        percentComplete: 30,
        estimatedTimeRemaining: 120000 // 2分钟
      };

      const result: ClaudeSkillOutput = formatter.formatProgress(progress);

      expect(result.content).toContain('剩余');
      expect(result.content).toMatch(/2\s*分钟/);
    });

    it('应该处理100%完成情况', () => {
      const progress: ProgressInfo = {
        currentStep: '完成',
        totalSteps: 10,
        currentStepIndex: 10,
        percentComplete: 100
      };

      const result: ClaudeSkillOutput = formatter.formatProgress(progress);

      expect(result.content).toContain('✓');
      expect(result.content).toContain('完成');
    });
  });

  describe('formatStatus - 状态报告格式化', () => {
    it('应该格式化项目状态报告', () => {
      const status: StatusReport = {
        projectName: '媒体AI平台',
        projectType: '绿地项目',
        currentPhase: '阶段3: 开发实施',
        completedStories: 8,
        totalStories: 12,
        lastActivity: '2026-03-10 10:30',
        recommendations: [
          '继续开发 E001-S009',
          '运行测试验证代码质量'
        ]
      };

      const result: ClaudeSkillOutput = formatter.formatStatus(status);

      expect(result.success).toBe(true);
      expect(result.content).toContain('# 媒体AI平台');
      expect(result.content).toContain('绿地项目');
      expect(result.content).toContain('阶段3');
      expect(result.content).toContain('8/12');
      expect(result.content).toContain('E001-S009');
    });

    it('应该显示完成进度百分比', () => {
      const status: StatusReport = {
        completedStories: 7,
        totalStories: 10
      };

      const result: ClaudeSkillOutput = formatter.formatStatus(status);

      expect(result.content).toContain('70%');
      expect(result.content).toContain('7/10');
    });

    it('应该包含推荐操作', () => {
      const status: StatusReport = {
        projectName: '测试项目',
        recommendations: [
          '运行测试套件',
          '提交代码更改'
        ]
      };

      const result: ClaudeSkillOutput = formatter.formatStatus(status);

      expect(result.nextSteps).toBeDefined();
      expect(result.nextSteps).toContain('运行测试套件');
      expect(result.nextSteps).toContain('提交代码更改');
    });

    it('应该处理缺少数据的状态', () => {
      const status: StatusReport = {};

      const result: ClaudeSkillOutput = formatter.formatStatus(status);

      expect(result.success).toBe(true);
      expect(result.content).toContain('未找到项目信息');
    });

    it('应该显示最近活动时间', () => {
      const status: StatusReport = {
        projectName: '测试项目',
        lastActivity: '2026-03-10 12:00'
      };

      const result: ClaudeSkillOutput = formatter.formatStatus(status);

      expect(result.content).toContain('2026-03-10');
      expect(result.content).toContain('12:00');
    });
  });

  describe('格式化细节', () => {
    it('应该使用表情符号增强可读性', () => {
      const data = { status: 'success' };
      const result: ClaudeSkillOutput = formatter.formatSuccess(data);

      // 成功应该有积极符号
      expect(result.content).toMatch(/[✓✅]/);
    });

    it('应该对错误使用警告符号', () => {
      const error: DevFlowCoreError = {
        code: 'ERROR',
        message: '发生错误',
        category: ErrorCategory.UNKNOWN
      };
      const result: ClaudeSkillOutput = formatter.formatFailure(error);

      // 错误应该有警告符号
      expect(result.content).toMatch(/[⚠❌✗]/);
    });

    it('应该使用代码块展示结构化数据', () => {
      const data = {
        config: {
          key1: 'value1',
          key2: 'value2'
        }
      };
      const result: ClaudeSkillOutput = formatter.formatSuccess(data);

      // 应该包含JSON代码块
      expect(result.content).toMatch(/```[\s\S]*json/);
    });
  });

  describe('元数据处理', () => {
    it('应该添加时间戳', () => {
      const data = {};
      const beforeTime = Date.now();

      const result: ClaudeSkillOutput = formatter.formatSuccess(data);

      const afterTime = Date.now();

      expect(result.metadata?.timestamp).toBeDefined();
      const timestamp = new Date(result.metadata!.timestamp!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime - 1000);
      expect(timestamp).toBeLessThanOrEqual(afterTime + 1000);
    });

    it('应该计算执行耗时', () => {
      const startTime = Date.now() - 1500;

      const metadata = {
        timestamp: new Date(startTime).toISOString(),
        duration: 1500
      };

      const result: ClaudeSkillOutput = formatter.formatSuccess({}, metadata);

      expect(result.metadata?.duration).toBe(1500);
    });

    it('应该包含项目上下文（当可用时）', () => {
      const data = {};
      const metadata = {
        projectContext: {
          name: '测试项目',
          type: '棕地项目',
          path: '/path/to/project'
        }
      };

      const result: ClaudeSkillOutput = formatter.formatSuccess(data, metadata);

      expect(result.metadata?.projectContext?.name).toBe('测试项目');
      expect(result.metadata?.projectContext?.type).toBe('棕地项目');
    });
  });

  describe('边界情况', () => {
    it('应该处理null数据', () => {
      const result: ClaudeSkillOutput = formatter.formatSuccess(null as any);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('应该处理undefined数据', () => {
      const result: ClaudeSkillOutput = formatter.formatSuccess(undefined as any);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('应该处理空对象', () => {
      const result: ClaudeSkillOutput = formatter.formatSuccess({});

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('应该处理循环引用', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const result: ClaudeSkillOutput = formatter.formatSuccess(circular);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      // 不应该抛出异常
    });
  });
});
