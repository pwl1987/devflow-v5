/**
 * DevFlow v5 - Claude Skills 适配器模块入口
 *
 * 职责：导出所有适配器组件
 */

// 类导出
export { ParameterResolver } from './ParameterResolver';
export { ResultFormatter } from './ResultFormatter';
export { ErrorAdapter } from './ErrorAdapter';

// 接口导出（非枚举）
export type {
  IParameterResolver,
  IResultFormatter,
  IErrorAdapter,
  ClaudeSkillInput,
  ResolvedCommand,
  ValidationResult,
  ClaudeSkillOutput,
  DevFlowCoreError,
  ClaudeCompatibleError,
  ProgressInfo,
  StatusReport,
  BatchConfig,
  OutputMetadata,
  FormattedError
} from './types';

// 枚举导出（作为值）
export * from './types';
