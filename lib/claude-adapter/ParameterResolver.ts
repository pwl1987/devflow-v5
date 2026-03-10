/**
 * DevFlow v5 - Claude Skills 参数解析器
 *
 * 职责：将 Claude 输入参数转换为核心模块可识别的格式
 */

import type {
  IParameterResolver,
  ClaudeSkillInput,
  ResolvedCommand,
  ValidationResult,
  Command,
  FlowMode,
  BatchConfig
} from './types';
import {
  Command as CommandEnum,
  FlowMode as FlowModeEnum,
  FailureStrategy
} from './types';

/**
 * 参数解析器实现
 */
export class ParameterResolver implements IParameterResolver {
  private readonly DEFAULT_MODE = FlowModeEnum.STANDARD;
  private readonly DEFAULT_COMMAND = CommandEnum.STATUS;
  private readonly MIN_BATCH_SIZE = 1;
  private readonly MAX_BATCH_SIZE = 10;

  /**
   * 解析 Claude 输入参数
   */
  public resolve(input: ClaudeSkillInput): ResolvedCommand {
    // 处理空/undefined/null 输入
    const safeInput = input || {};

    return {
      command: this.resolveCommand(safeInput.command),
      mode: this.resolveMode(safeInput.mode),
      batchConfig: this.resolveBatchConfig(safeInput),
      targetStoryId: safeInput.storyId,
      options: safeInput.params || {}
    };
  }

  /**
   * 验证参数有效性
   */
  public validate(input: ClaudeSkillInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input) {
      return { valid: true, warnings: ['输入为空，将使用默认值'] };
    }

    // 验证批量大小
    if (input.batchSize !== undefined) {
      if (input.batchSize < 0) {
        errors.push('批量大小必须为正数');
      } else if (input.batchSize === 0) {
        errors.push('批量大小不能为零');
      }
    }

    // 验证故事ID格式
    if (input.storyId) {
      const storyIdPattern = /^E\d+-S\d+$/;
      if (!storyIdPattern.test(input.storyId)) {
        errors.push('故事ID格式无效，应为 E###-S### 格式');
      }
    }

    // 检查缺失的可选参数
    if (!input.mode && input.command) {
      warnings.push('未指定流程模式，将使用标准模式');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 从自然语言提取意图
   */
  public extractIntent(userInput: string): ResolvedCommand {
    const input = userInput.trim().toLowerCase();

    // 状态相关关键词
    if (this.matchesKeywords(input, ['查看状态', '状态', '项目进度', '进度报告', '仪表盘', '当前状态', '怎么样'])) {
      return {
        command: CommandEnum.STATUS,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 继续开发相关
    if (this.matchesKeywords(input, ['继续开发', '继续', '断点续传', '恢复开发', '接着做'])) {
      return {
        command: CommandEnum.CONTINUE,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 新项目相关
    if (this.matchesKeywords(input, ['开始新项目', '新项目', '启动项目', '创建项目', '新建'])) {
      return {
        command: CommandEnum.NEW,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 批量处理相关（带数量提取）
    const batchMatch = input.match(/批量(?:处理)?(?:\s*(\d+))?/);
    if (batchMatch) {
      const size = batchMatch[1] ? parseInt(batchMatch[1], 10) : 5;
      return {
        command: CommandEnum.BATCH,
        mode: this.DEFAULT_MODE,
        batchConfig: {
          enabled: true,
          size: this.clampBatchSize(size),
          onFailure: FailureStrategy.PAUSE
        },
        options: {}
      };
    }

    // 故事开发相关（带ID提取）
    const storyMatch = input.match(/(?:开发)?(?:故事)?[Ee](\d+)-[Ss](\d+)/);
    if (storyMatch) {
      return {
        command: CommandEnum.STORY,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        targetStoryId: `E${storyMatch[1]}-S${storyMatch[2]}`,
        options: {}
      };
    }

    if (this.matchesKeywords(input, ['开发故事', '故事开发', 'story'])) {
      return {
        command: CommandEnum.STORY,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 代码评审相关
    if (this.matchesKeywords(input, ['代码评审', '评审', 'review', '代码检查', '质量检查'])) {
      return {
        command: CommandEnum.REVIEW,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 测试相关
    if (this.matchesKeywords(input, ['测试', 'test', '运行测试', '执行测试'])) {
      return {
        command: CommandEnum.TEST,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 提交相关
    if (this.matchesKeywords(input, ['提交', 'commit', 'git提交', '推送'])) {
      return {
        command: CommandEnum.COMMIT,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 帮助相关
    if (this.matchesKeywords(input, ['帮助', 'help', '使用说明', '文档'])) {
      return {
        command: CommandEnum.HELP,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 默认：模糊输入推断为状态查看
    if (this.matchesKeywords(input, ['我该做什么', '接下来', '下一步', '建议'])) {
      return {
        command: CommandEnum.STATUS,
        mode: this.DEFAULT_MODE,
        batchConfig: this.getDefaultBatchConfig(),
        options: {}
      };
    }

    // 回退到状态命令
    return {
      command: CommandEnum.STATUS,
      mode: this.DEFAULT_MODE,
      batchConfig: this.getDefaultBatchConfig(),
      options: {}
    };
  }

  /**
   * 解析命令
   */
  private resolveCommand(command?: string): Command {
    if (!command) {
      return this.DEFAULT_COMMAND;
    }

    const commandMap: Record<string, Command> = {
      'status': CommandEnum.STATUS,
      'new': CommandEnum.NEW,
      'continue': CommandEnum.CONTINUE,
      'batch': CommandEnum.BATCH,
      'story': CommandEnum.STORY,
      'review': CommandEnum.REVIEW,
      'test': CommandEnum.TEST,
      'commit': CommandEnum.COMMIT,
      'help': CommandEnum.HELP
    };

    return commandMap[command.toLowerCase()] || this.DEFAULT_COMMAND;
  }

  /**
   * 解析流程模式
   */
  private resolveMode(mode?: string): FlowMode {
    if (!mode) {
      return this.DEFAULT_MODE;
    }

    const modeMap: Record<string, FlowMode> = {
      'quick': FlowModeEnum.QUICK,
      'standard': FlowModeEnum.STANDARD,
      'rigorous': FlowModeEnum.RIGOROUS
    };

    const resolved = modeMap[mode.toLowerCase()];
    return resolved || this.DEFAULT_MODE;
  }

  /**
   * 解析批量配置
   */
  private resolveBatchConfig(input: ClaudeSkillInput): BatchConfig {
    const batchSize = input.batchSize;
    const enabled = batchSize !== undefined && batchSize > 0;

    // 如果指定了批量大小（即使为0），也进行clamp处理
    const clampedSize = batchSize !== undefined ? this.clampBatchSize(batchSize) : 5;

    return {
      enabled,
      size: clampedSize,
      onFailure: this.resolveFailureStrategy(input.onFailure)
    };
  }

  /**
   * 解析失败策略
   */
  private resolveFailureStrategy(strategy?: string): FailureStrategy {
    if (!strategy) {
      return FailureStrategy.PAUSE;
    }

    const strategyMap: Record<string, FailureStrategy> = {
      'pause': FailureStrategy.PAUSE,
      'skip': FailureStrategy.SKIP,
      'record': FailureStrategy.RECORD
    };

    return strategyMap[strategy.toLowerCase()] || FailureStrategy.PAUSE;
  }

  /**
   * 限制批量大小在有效范围
   */
  private clampBatchSize(size: number): number {
    return Math.max(
      this.MIN_BATCH_SIZE,
      Math.min(this.MAX_BATCH_SIZE, size)
    );
  }

  /**
   * 获取默认批量配置
   */
  private getDefaultBatchConfig(): BatchConfig {
    return {
      enabled: false,
      size: 5,
      onFailure: FailureStrategy.PAUSE
    };
  }

  /**
   * 检查输入是否匹配任一关键词
   */
  private matchesKeywords(input: string, keywords: string[]): boolean {
    return keywords.some(keyword => input.includes(keyword));
  }
}

// 导出枚举类型
export { Command, FlowMode, FailureStrategy } from './types';
