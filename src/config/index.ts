/**
 * DevFlow v5 - 配置管理模块
 *
 * 职责：加载和管理应用配置，提供默认值和类型安全
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 冲突解决策略枚举
 */
export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'LWW',
  FIRST_WRITE_WINS = 'FWW',
  MANUAL = 'MANUAL',
  HIGHEST_VERSION = 'HIGHEST_VERSION',
  SOURCE_PRIORITY = 'SOURCE_PRIORITY',
  TARGET_PRIORITY = 'TARGET_PRIORITY',
  MERGE = 'MERGE'
}

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  /** 最大并发流程数 */
  maxConcurrentFlows: number;
  /** 默认操作超时时间（毫秒） */
  defaultTimeout: number;
  /** 批量处理默认大小 */
  defaultBatchSize: number;
  /** 批量处理最大大小 */
  maxBatchSize: number;
}

/**
 * 文件管理配置接口
 */
export interface FileManagerConfig {
  /** 允许的文件扩展名 */
  allowedFileTypes: string[];
  /** 最大文件大小（字节） */
  maxFileSize: number;
  /** 允许的路径 */
  allowedPaths: string[];
}

/**
 * 断点恢复配置接口
 */
export interface CheckpointConfig {
  /** 断点存储目录 */
  checkpointDir: string;
  /** 断点保留天数 */
  retentionDays: number;
  /** 是否启用校验和验证 */
  enableChecksumValidation: boolean;
}

/**
 * 审计日志配置接口
 */
export interface AuditConfig {
  /** 审计日志保留天数 */
  retentionDays: number;
  /** 是否启用审计日志 */
  enabled: boolean;
}

/**
 * 分布式状态配置接口
 */
export interface DistributedStateConfig {
  /** 状态同步间隔（毫秒） */
  syncInterval: number;
  /** 默认冲突解决策略 */
  defaultConflictResolution: ConflictResolutionStrategy;
}

/**
 * 开发配置接口
 */
export interface DevelopmentConfig {
  /** 是否启用调试模式 */
  debug: boolean;
  /** 测试覆盖率阈值 */
  coverageThreshold: number;
}

/**
 * 完整应用配置接口
 */
export interface AppConfig {
  /** 基础配置 */
  nodeEnv: string;
  logLevel: LogLevel;
  /** 性能配置 */
  performance: PerformanceConfig;
  /** 文件管理配置 */
  fileManager: FileManagerConfig;
  /** 断点恢复配置 */
  checkpoint: CheckpointConfig;
  /** 审计日志配置 */
  audit: AuditConfig;
  /** 分布式状态配置 */
  distributedState: DistributedStateConfig;
  /** 开发配置 */
  development: DevelopmentConfig;
}

/**
 * 环境变量名称常量
 */
const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  LOG_LEVEL: 'LOG_LEVEL',
  MAX_CONCURRENT_FLOWS: 'MAX_CONCURRENT_FLOWS',
  DEFAULT_TIMEOUT_MS: 'DEFAULT_TIMEOUT_MS',
  DEFAULT_BATCH_SIZE: 'DEFAULT_BATCH_SIZE',
  MAX_BATCH_SIZE: 'MAX_BATCH_SIZE',
  ALLOWED_FILE_TYPES: 'ALLOWED_FILE_TYPES',
  MAX_FILE_SIZE: 'MAX_FILE_SIZE',
  ALLOWED_PATHS: 'ALLOWED_PATHS',
  CHECKPOINT_DIR: 'CHECKPOINT_DIR',
  CHECKPOINT_RETENTION_DAYS: 'CHECKPOINT_RETENTION_DAYS',
  ENABLE_CHECKSUM_VALIDATION: 'ENABLE_CHECKSUM_VALIDATION',
  AUDIT_LOG_RETENTION_DAYS: 'AUDIT_LOG_RETENTION_DAYS',
  AUDIT_ENABLED: 'AUDIT_ENABLED',
  STATE_SYNC_INTERVAL: 'STATE_SYNC_INTERVAL',
  DEFAULT_CONFLICT_RESOLUTION: 'DEFAULT_CONFLICT_RESOLUTION',
  DEBUG: 'DEBUG',
  COVERAGE_THRESHOLD: 'COVERAGE_THRESHOLD'
} as const;

/**
 * 获取环境变量值，支持默认值
 */
function getEnvValue(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * 获取布尔环境变量值
 */
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 获取数字环境变量值
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  // 检查是否为有效数字且非负数（对于配置项，负数通常没有意义）
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

/**
 * 获取数组环境变量值（逗号分隔）
 */
function getArrayEnv(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 配置管理器类
 */
export class ConfigManager {
  private static instance: ConfigManager | null = null;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigManager {
    if (ConfigManager.instance === null) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): AppConfig {
    return {
      nodeEnv: getEnvValue(ENV_VARS.NODE_ENV, 'development'),
      logLevel: getEnvValue(ENV_VARS.LOG_LEVEL, 'info') as LogLevel,
      performance: {
        maxConcurrentFlows: getNumberEnv(ENV_VARS.MAX_CONCURRENT_FLOWS, 5),
        defaultTimeout: getNumberEnv(ENV_VARS.DEFAULT_TIMEOUT_MS, 300000),
        defaultBatchSize: getNumberEnv(ENV_VARS.DEFAULT_BATCH_SIZE, 5),
        maxBatchSize: getNumberEnv(ENV_VARS.MAX_BATCH_SIZE, 10)
      },
      fileManager: {
        allowedFileTypes: getArrayEnv(ENV_VARS.ALLOWED_FILE_TYPES, [
          '.ts',
          '.js',
          '.json',
          '.md',
          '.txt',
          '.yaml',
          '.yml'
        ]),
        maxFileSize: getNumberEnv(ENV_VARS.MAX_FILE_SIZE, 10485760), // 10MB
        allowedPaths: getArrayEnv(ENV_VARS.ALLOWED_PATHS, ['/src', '/lib', '/tests', '/core', '*'])
      },
      checkpoint: {
        checkpointDir: getEnvValue(ENV_VARS.CHECKPOINT_DIR, '_state/checkpoints'),
        retentionDays: getNumberEnv(ENV_VARS.CHECKPOINT_RETENTION_DAYS, 30),
        enableChecksumValidation: getBooleanEnv(ENV_VARS.ENABLE_CHECKSUM_VALIDATION, true)
      },
      audit: {
        retentionDays: getNumberEnv(ENV_VARS.AUDIT_LOG_RETENTION_DAYS, 90),
        enabled: getBooleanEnv(ENV_VARS.AUDIT_ENABLED, true)
      },
      distributedState: {
        syncInterval: getNumberEnv(ENV_VARS.STATE_SYNC_INTERVAL, 60000),
        defaultConflictResolution: getEnvValue(
          ENV_VARS.DEFAULT_CONFLICT_RESOLUTION,
          'LWW'
        ) as ConflictResolutionStrategy
      },
      development: {
        debug: getBooleanEnv(ENV_VARS.DEBUG, false),
        coverageThreshold: getNumberEnv(ENV_VARS.COVERAGE_THRESHOLD, 80)
      }
    };
  }

  /**
   * 获取完整配置
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * 获取性能配置
   */
  public getPerformanceConfig(): PerformanceConfig {
    return { ...this.config.performance };
  }

  /**
   * 获取文件管理配置
   */
  public getFileManagerConfig(): FileManagerConfig {
    return { ...this.config.fileManager };
  }

  /**
   * 获取断点配置
   */
  public getCheckpointConfig(): CheckpointConfig {
    return { ...this.config.checkpoint };
  }

  /**
   * 获取审计配置
   */
  public getAuditConfig(): AuditConfig {
    return { ...this.config.audit };
  }

  /**
   * 获取分布式状态配置
   */
  public getDistributedStateConfig(): DistributedStateConfig {
    return { ...this.config.distributedState };
  }

  /**
   * 获取开发配置
   */
  public getDevelopmentConfig(): DevelopmentConfig {
    return { ...this.config.development };
  }

  /**
   * 是否为生产环境
   */
  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  /**
   * 是否为开发环境
   */
  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  /**
   * 是否为测试环境
   */
  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  /**
   * 是否启用调试
   */
  public isDebug(): boolean {
    return this.config.development.debug;
  }

  /**
   * 重载配置（用于测试）
   */
  public reload(): void {
    this.config = this.loadConfig();
  }

  /**
   * 清除单例实例（用于测试）
   */
  public static clearInstance(): void {
    ConfigManager.instance = null;
  }
}

/**
 * 获取配置管理器实例（便捷方法）
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}
