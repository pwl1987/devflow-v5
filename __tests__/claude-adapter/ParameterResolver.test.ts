/**
 * DevFlow v5 - ParameterResolver 单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  ParameterResolver
} from '../../lib/claude-adapter/ParameterResolver';
import type {
  ClaudeSkillInput,
  ResolvedCommand,
  ValidationResult
} from '../../lib/claude-adapter/types';
import {
  Command,
  FlowMode,
  FailureStrategy
} from '../../lib/claude-adapter/types';

describe('ParameterResolver', () => {
  let resolver: ParameterResolver;

  beforeEach(() => {
    resolver = new ParameterResolver();
  });

  describe('resolve - 基本参数解析', () => {
    it('应该解析完整的命令参数', () => {
      const input: ClaudeSkillInput = {
        command: 'batch',
        mode: 'standard',
        batchSize: 5,
        onFailure: 'skip',
        params: { custom: 'value' }
      };

      const result: ResolvedCommand = resolver.resolve(input);

      expect(result.command).toBe(Command.BATCH);
      expect(result.mode).toBe(FlowMode.STANDARD);
      expect(result.batchConfig.enabled).toBe(true);
      expect(result.batchConfig.size).toBe(5);
      expect(result.batchConfig.onFailure).toBe(FailureStrategy.SKIP);
      expect(result.options.custom).toBe('value');
    });

    it('应该使用默认值解析部分参数', () => {
      const input: ClaudeSkillInput = {
        command: 'status'
      };

      const result: ResolvedCommand = resolver.resolve(input);

      expect(result.command).toBe(Command.STATUS);
      expect(result.mode).toBe(FlowMode.STANDARD);
      expect(result.batchConfig.enabled).toBe(false);
      expect(result.batchConfig.onFailure).toBe(FailureStrategy.PAUSE);
    });

    it('应该解析故事ID参数', () => {
      const input: ClaudeSkillInput = {
        command: 'story',
        storyId: 'E000-S001'
      };

      const result: ResolvedCommand = resolver.resolve(input);

      expect(result.command).toBe(Command.STORY);
      expect(result.targetStoryId).toBe('E000-S001');
    });
  });

  describe('resolve - 模式映射', () => {
    it('应该将小写模式映射到枚举', () => {
      const input1: ClaudeSkillInput = { command: 'new', mode: 'quick' };
      const result1 = resolver.resolve(input1);
      expect(result1.mode).toBe(FlowMode.QUICK);

      const input2: ClaudeSkillInput = { command: 'new', mode: 'rigorous' };
      const result2 = resolver.resolve(input2);
      expect(result2.mode).toBe(FlowMode.RIGOROUS);
    });

    it('应该对无效模式使用标准模式作为默认值', () => {
      const input: ClaudeSkillInput = {
        command: 'new',
        mode: 'invalid' as any
      };

      const result: ResolvedCommand = resolver.resolve(input);
      expect(result.mode).toBe(FlowMode.STANDARD);
    });
  });

  describe('resolve - 批量配置', () => {
    it('应该根据批量大小启用批量配置', () => {
      const input: ClaudeSkillInput = {
        command: 'batch',
        batchSize: 3
      };

      const result: ResolvedCommand = resolver.resolve(input);

      expect(result.batchConfig.enabled).toBe(true);
      expect(result.batchConfig.size).toBe(3);
    });

    it('应该限制批量大小在合理范围', () => {
      const input1: ClaudeSkillInput = { command: 'batch', batchSize: 0 };
      const result1 = resolver.resolve(input1);
      expect(result1.batchConfig.size).toBe(1); // 最小值

      const input2: ClaudeSkillInput = { command: 'batch', batchSize: 100 };
      const result2 = resolver.resolve(input2);
      expect(result2.batchConfig.size).toBe(10); // 最大值
    });

    it('应该映射失败策略字符串到枚举', () => {
      const input: ClaudeSkillInput = {
        command: 'batch',
        onFailure: 'record'
      };

      const result: ResolvedCommand = resolver.resolve(input);
      expect(result.batchConfig.onFailure).toBe(FailureStrategy.RECORD);
    });
  });

  describe('validate - 参数验证', () => {
    it('应该验证有效的参数', () => {
      const input: ClaudeSkillInput = {
        command: 'new',
        mode: 'standard'
      };

      const result: ValidationResult = resolver.validate(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('应该拒绝无效的批量大小', () => {
      const input: ClaudeSkillInput = {
        command: 'batch',
        batchSize: -1
      };

      const result: ValidationResult = resolver.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('批量大小必须为正数');
    });

    it('应该拒绝无效的故事ID格式', () => {
      const input: ClaudeSkillInput = {
        command: 'story',
        storyId: 'INVALID'
      };

      const result: ValidationResult = resolver.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('故事ID格式无效，应为 E###-S### 格式');
    });

    it('应该提供警告而非错误用于可修正问题', () => {
      const input: ClaudeSkillInput = {
        command: 'continue'
        // 缺少mode，会使用默认值
      };

      const result: ValidationResult = resolver.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('未指定流程模式，将使用标准模式');
    });
  });

  describe('extractIntent - 自然语言意图提取', () => {
    it('应该从"查看状态"提取状态命令', () => {
      const result: ResolvedCommand = resolver.extractIntent('查看状态');
      expect(result.command).toBe(Command.STATUS);
    });

    it('应该从"继续开发"提取续传命令', () => {
      const result: ResolvedCommand = resolver.extractIntent('继续开发');
      expect(result.command).toBe(Command.CONTINUE);
    });

    it('应该从"开始新项目"提取新建命令', () => {
      const result: ResolvedCommand = resolver.extractIntent('开始新项目');
      expect(result.command).toBe(Command.NEW);
    });

    it('应该从"批量处理5个"提取批量命令和大小', () => {
      const result: ResolvedCommand = resolver.extractIntent('批量处理5个故事');
      expect(result.command).toBe(Command.BATCH);
      expect(result.batchConfig.enabled).toBe(true);
      expect(result.batchConfig.size).toBe(5);
    });

    it('应该从"开发故事E000-S001"提取故事命令和ID', () => {
      const result: ResolvedCommand = resolver.extractIntent('开发故事E000-S001');
      expect(result.command).toBe(Command.STORY);
      expect(result.targetStoryId).toBe('E000-S001');
    });

    it('应该从模糊输入推断合理的默认命令', () => {
      const result1: ResolvedCommand = resolver.extractIntent('我该做什么');
      expect(result1.command).toBe(Command.STATUS);

      const result2: ResolvedCommand = resolver.extractIntent('继续');
      expect(result2.command).toBe(Command.CONTINUE);
    });

    it('应该处理包含同义词的表达', () => {
      const synonyms = [
        '项目进度',
        '进度报告',
        '仪表盘',
        '当前状态'
      ];

      synonyms.forEach(expr => {
        const result: ResolvedCommand = resolver.extractIntent(expr);
        expect(result.command).toBe(Command.STATUS);
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空输入', () => {
      const input: ClaudeSkillInput = {};

      const result: ResolvedCommand = resolver.resolve(input);
      expect(result.command).toBe(Command.STATUS); // 默认命令
      expect(result.mode).toBe(FlowMode.STANDARD);
    });

    it('应该处理undefined输入', () => {
      const result: ResolvedCommand = resolver.resolve(undefined as any);
      expect(result.command).toBe(Command.STATUS);
    });

    it('应该处理null输入', () => {
      const result: ResolvedCommand = resolver.resolve(null as any);
      expect(result.command).toBe(Command.STATUS);
    });
  });

  describe('命令字符串映射', () => {
    it('应该将各种命令字符串映射到正确枚举', () => {
      const testCases = [
        { input: 'status', expected: Command.STATUS },
        { input: 'new', expected: Command.NEW },
        { input: 'continue', expected: Command.CONTINUE },
        { input: 'batch', expected: Command.BATCH },
        { input: 'story', expected: Command.STORY },
        { input: 'review', expected: Command.REVIEW },
        { input: 'test', expected: Command.TEST },
        { input: 'commit', expected: Command.COMMIT },
        { input: 'help', expected: Command.HELP }
      ];

      testCases.forEach(({ input, expected }) => {
        const cmdInput: ClaudeSkillInput = { command: input };
        const result = resolver.resolve(cmdInput);
        expect(result.command).toBe(expected);
      });
    });

    it('应该处理中文命令别名', () => {
      const result1 = resolver.extractIntent('帮助');
      expect(result1.command).toBe(Command.HELP);

      const result2 = resolver.extractIntent('测试');
      expect(result2.command).toBe(Command.TEST);

      const result3 = resolver.extractIntent('评审');
      expect(result3.command).toBe(Command.REVIEW);
    });
  });
});
