/**
 * DevFlow v5 - Claude Skills 适配器类型定义
 *
 * 职责：定义 Claude Skills 与核心模块之间的适配接口
 */

// ============ Claude 输入类型 ============

/**
 * Claude Skills 原始输入参数
 */
export interface ClaudeSkillInput {
  /** 命令类型 */
  command?: string;
  /** 流程模式 */
  mode?: 'quick' | 'standard' | 'rigorous';
  /** 批量处理数量 */
  batchSize?: number;
  /** 失败处理策略 */
  onFailure?: 'pause' | 'skip' | 'record';
  /** 故事ID */
  storyId?: string;
  /** 原始用户输入 */
  userInput?: string;
  /** 附加参数 */
  params?: Record<string, unknown>;
}

/**
 * 解析后的命令参数
 */
export interface ResolvedCommand {
  /** 命令类型 */
  command: Command;
  /** 流程模式 */
  mode: FlowMode;
  /** 批量配置 */
  batchConfig: BatchConfig;
  /** 目标故事ID */
  targetStoryId?: string;
  /** 附加选项 */
  options: Record<string, unknown>;
}

/**
 * 命令类型枚举
 */
export enum Command {
  /** 查看状态 */
  STATUS = 'status',
  /** 启动新项目 */
  NEW = 'new',
  /** 断点续传 */
  CONTINUE = 'continue',
  /** 批量处理 */
  BATCH = 'batch',
  /** 单故事开发 */
  STORY = 'story',
  /** 代码评审 */
  REVIEW = 'review',
  /** 运行测试 */
  TEST = 'test',
  /** 智能提交 */
  COMMIT = 'commit',
  /** 帮助信息 */
  HELP = 'help'
}

/**
 * 流程模式枚举
 */
export enum FlowMode {
  /** 快速模式：最小仪式，快速启动 */
  QUICK = 'quick',
  /** 标准模式：平衡效率与质量 */
  STANDARD = 'standard',
  /** 严格模式：质量优先，完整流程 */
  RIGOROUS = 'rigorous'
}

/**
 * 批量配置
 */
export interface BatchConfig {
  /** 是否启用批量 */
  enabled: boolean;
  /** 批量大小 */
  size: number;
  /** 失败策略 */
  onFailure: FailureStrategy;
}

/**
 * 失败处理策略
 */
export enum FailureStrategy {
  /** 暂停：遇到失败立即停止 */
  PAUSE = 'pause',
  /** 跳过：跳过失败项继续 */
  SKIP = 'skip',
  /** 记录：记录失败但继续 */
  RECORD = 'record'
}

// ============ Claude 输出类型 ============

/**
 * Claude 格式化输出
 */
export interface ClaudeSkillOutput {
  /** 是否成功 */
  success: boolean;
  /** 输出内容（Markdown格式） */
  content: string;
  /** 状态信息 */
  status?: OutputStatus;
  /** 推荐操作 */
  recommendations?: string[];
  /** 下一步建议 */
  nextSteps?: string[];
  /** 错误信息 */
  errors?: FormattedError[];
  /** 元数据 */
  metadata?: OutputMetadata;
}

/**
 * 输出状态
 */
export enum OutputStatus {
  /** 成功 */
  SUCCESS = 'success',
  /** 部分成功 */
  PARTIAL = 'partial',
  /** 失败 */
  FAILED = 'failed',
  /** 警告 */
  WARNING = 'warning'
}

/**
 * 格式化的错误信息
 */
export interface FormattedError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误级别 */
  severity: ErrorSeverity;
  /** 解决建议 */
  resolution?: string;
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 信息 */
  INFO = 'info',
  /** 警告 */
  WARNING = 'warning',
  /** 错误 */
  ERROR = 'error',
  /** 关键 */
  CRITICAL = 'critical'
}

/**
 * 输出元数据
 */
export interface OutputMetadata {
  /** 执行时间戳 */
  timestamp: string;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 项目上下文 */
  projectContext?: {
    name?: string;
    type?: string;
    path?: string;
  };
  /** 统计信息 */
  statistics?: {
    completedTasks?: number;
    totalTasks?: number;
    passedTests?: number;
    failedTests?: number;
  };
}

// ============ 错误适配类型 ============

/**
 * DevFlow 核心错误
 */
export interface DevFlowCoreError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误类别 */
  category: ErrorCategory;
  /** 原始错误 */
  originalError?: unknown;
  /** 上下文信息 */
  context?: Record<string, unknown>;
}

/**
 * 错误类别
 */
export enum ErrorCategory {
  /** 验证错误 */
  VALIDATION = 'validation',
  /** 权限错误 */
  PERMISSION = 'permission',
  /** 文件操作错误 */
  FILE_OPERATION = 'file_operation',
  /** 状态管理错误 */
  STATE_MANAGEMENT = 'state_management',
  /** 执行错误 */
  EXECUTION = 'execution',
  /** 网络错误 */
  NETWORK = 'network',
  /** 未知错误 */
  UNKNOWN = 'unknown'
}

/**
 * Claude 兼容错误
 */
export interface ClaudeCompatibleError {
  /** 错误类型 */
  type: string;
  /** 错误消息 */
  message: string;
  /** 用户友好描述 */
  description: string;
  /** 解决建议 */
  suggestions: string[];
  /** 错误代码 */
  code?: string;
  /** 文档链接 */
  docLink?: string;
}

// ============ 适配器接口 ============

/**
 * 参数解析器接口
 */
export interface IParameterResolver {
  /**
   * 解析 Claude 输入参数
   * @param input Claude 原始输入
   * @returns 解析后的命令
   */
  resolve(input: ClaudeSkillInput): ResolvedCommand;

  /**
   * 验证参数有效性
   * @param input Claude 原始输入
   * @returns 验证结果
   */
  validate(input: ClaudeSkillInput): ValidationResult;

  /**
   * 从自然语言提取意图
   * @param userInput 用户输入
   * @returns 解析后的命令
   */
  extractIntent(userInput: string): ResolvedCommand;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors?: string[];
  /** 警告信息 */
  warnings?: string[];
}

/**
 * 结果格式化器接口
 */
export interface IResultFormatter {
  /**
   * 格式化成功结果
   * @param data 原始数据
   * @param metadata 元数据
   * @returns Claude 格式化输出
   */
  formatSuccess(data: unknown, metadata?: Partial<OutputMetadata>): ClaudeSkillOutput;

  /**
   * 格式化失败结果
   * @param error 错误信息
   * @param metadata 元数据
   * @returns Claude 格式化输出
   */
  formatFailure(error: DevFlowCoreError, metadata?: Partial<OutputMetadata>): ClaudeSkillOutput;

  /**
   * 格式化进度更新
   * @param progress 进度信息
   * @returns Claude 格式化输出
   */
  formatProgress(progress: ProgressInfo): ClaudeSkillOutput;

  /**
   * 格式化状态报告
   * @param status 状态信息
   * @returns Claude 格式化输出
   */
  formatStatus(status: StatusReport): ClaudeSkillOutput;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  /** 当前步骤 */
  currentStep: string;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 完成百分比 */
  percentComplete: number;
  /** 当前操作描述 */
  currentOperation?: string;
  /** 预计剩余时间（毫秒） */
  estimatedTimeRemaining?: number;
}

/**
 * 状态报告
 */
export interface StatusReport {
  /** 项目名称 */
  projectName?: string;
  /** 项目类型 */
  projectType?: string;
  /** 当前阶段 */
  currentPhase?: string;
  /** 完成故事数 */
  completedStories?: number;
  /** 总故事数 */
  totalStories?: number;
  /** 最后活动时间 */
  lastActivity?: string;
  /** 推荐操作 */
  recommendations?: string[];
}

/**
 * 错误适配器接口
 */
export interface IErrorAdapter {
  /**
   * 将核心错误转换为 Claude 兼容格式
   * @param error DevFlow 核心错误
   * @returns Claude 兼容错误
   */
  adaptToClaude(error: DevFlowCoreError): ClaudeCompatibleError;

  /**
   * 从标准错误创建核心错误
   * @param error 标准错误
   * @param category 错误类别
   * @returns DevFlow 核心错误
   */
  fromStandardError(error: Error, category: ErrorCategory): DevFlowCoreError;

  /**
   * 本地化错误消息
   * @param error 错误
   * @param locale 语言区域
   * @returns 本地化消息
   */
  localize(error: DevFlowCoreError, locale?: string): string;

  /**
   * 获取错误解决建议
   * @param errorCode 错误代码
   * @returns 解决建议列表
   */
  getResolutionSuggestions(errorCode: string): string[];
}
