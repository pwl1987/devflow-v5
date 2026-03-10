/**
 * DevFlow v5 - 配置管理器单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  ConfigManager,
  getConfig,
  LogLevel,
  ConflictResolutionStrategy,
  type AppConfig
} from '../../src/config/index';

describe('ConfigManager', () => {
  // 在每个测试前清除单例实例
  beforeEach(() => {
    ConfigManager.clearInstance();
    // 清除所有环境变量
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.MAX_CONCURRENT_FLOWS;
    delete process.env.DEFAULT_TIMEOUT_MS;
    delete process.env.DEFAULT_BATCH_SIZE;
    delete process.env.MAX_BATCH_SIZE;
    delete process.env.ALLOWED_FILE_TYPES;
    delete process.env.MAX_FILE_SIZE;
    delete process.env.ALLOWED_PATHS;
    delete process.env.CHECKPOINT_DIR;
    delete process.env.CHECKPOINT_RETENTION_DAYS;
    delete process.env.ENABLE_CHECKSUM_VALIDATION;
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    delete process.env.AUDIT_ENABLED;
    delete process.env.STATE_SYNC_INTERVAL;
    delete process.env.DEFAULT_CONFLICT_RESOLUTION;
    delete process.env.DEBUG;
    delete process.env.COVERAGE_THRESHOLD;
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('清除后应该创建新实例', () => {
      const instance1 = ConfigManager.getInstance();
      ConfigManager.clearInstance();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('基础配置', () => {
    it('应该使用默认值加载配置', () => {
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.nodeEnv).toBe('development');
      expect(config.logLevel).toBe(LogLevel.INFO);
    });

    it('应该从环境变量读取 NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.nodeEnv).toBe('production');
    });

    it('应该从环境变量读取 LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'debug';
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config.logLevel).toBe(LogLevel.DEBUG);
    });
  });

  describe('性能配置', () => {
    it('应该使用默认性能配置', () => {
      const configManager = ConfigManager.getInstance();
      const perfConfig = configManager.getPerformanceConfig();

      expect(perfConfig.maxConcurrentFlows).toBe(5);
      expect(perfConfig.defaultTimeout).toBe(300000);
      expect(perfConfig.defaultBatchSize).toBe(5);
      expect(perfConfig.maxBatchSize).toBe(10);
    });

    it('应该从环境变量读取性能配置', () => {
      process.env.MAX_CONCURRENT_FLOWS = '10';
      process.env.DEFAULT_TIMEOUT_MS = '600000';
      process.env.DEFAULT_BATCH_SIZE = '3';
      process.env.MAX_BATCH_SIZE = '15';

      const configManager = ConfigManager.getInstance();
      const perfConfig = configManager.getPerformanceConfig();

      expect(perfConfig.maxConcurrentFlows).toBe(10);
      expect(perfConfig.defaultTimeout).toBe(600000);
      expect(perfConfig.defaultBatchSize).toBe(3);
      expect(perfConfig.maxBatchSize).toBe(15);
    });

    it('应该处理无效的数字环境变量', () => {
      process.env.MAX_CONCURRENT_FLOWS = 'invalid';
      const configManager = ConfigManager.getInstance();
      const perfConfig = configManager.getPerformanceConfig();

      // 应该使用默认值
      expect(perfConfig.maxConcurrentFlows).toBe(5);
    });
  });

  describe('文件管理配置', () => {
    it('应该使用默认文件管理配置', () => {
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      expect(fmConfig.allowedFileTypes).toEqual(['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml']);
      expect(fmConfig.maxFileSize).toBe(10485760); // 10MB
      expect(fmConfig.allowedPaths).toEqual(['/src', '/lib', '/tests', '/core', '*']);
    });

    it('应该从环境变量读取文件类型配置', () => {
      process.env.ALLOWED_FILE_TYPES = '.ts,.js,.json';
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      expect(fmConfig.allowedFileTypes).toEqual(['.ts', '.js', '.json']);
    });

    it('应该从环境变量读取文件大小限制', () => {
      process.env.MAX_FILE_SIZE = '5242880'; // 5MB
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      expect(fmConfig.maxFileSize).toBe(5242880);
    });

    it('应该从环境变量读取允许路径', () => {
      process.env.ALLOWED_PATHS = '/src,/lib,*';
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      expect(fmConfig.allowedPaths).toEqual(['/src', '/lib', '*']);
    });

    it('应该处理空数组环境变量', () => {
      process.env.ALLOWED_FILE_TYPES = '';
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      // 空字符串应返回默认值
      expect(fmConfig.allowedFileTypes).toEqual(['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml']);
    });

    it('应该处理带空格的数组环境变量', () => {
      process.env.ALLOWED_FILE_TYPES = '.ts, .js , .json';
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      expect(fmConfig.allowedFileTypes).toEqual(['.ts', '.js', '.json']);
    });
  });

  describe('断点恢复配置', () => {
    it('应该使用默认断点配置', () => {
      const configManager = ConfigManager.getInstance();
      const cpConfig = configManager.getCheckpointConfig();

      expect(cpConfig.checkpointDir).toBe('_state/checkpoints');
      expect(cpConfig.retentionDays).toBe(30);
      expect(cpConfig.enableChecksumValidation).toBe(true);
    });

    it('应该从环境变量读取断点配置', () => {
      process.env.CHECKPOINT_DIR = '_custom/checkpoints';
      process.env.CHECKPOINT_RETENTION_DAYS = '60';
      process.env.ENABLE_CHECKSUM_VALIDATION = 'false';

      const configManager = ConfigManager.getInstance();
      const cpConfig = configManager.getCheckpointConfig();

      expect(cpConfig.checkpointDir).toBe('_custom/checkpoints');
      expect(cpConfig.retentionDays).toBe(60);
      expect(cpConfig.enableChecksumValidation).toBe(false);
    });

    it('应该正确解析布尔环境变量', () => {
      // true 值
      process.env.ENABLE_CHECKSUM_VALIDATION = 'true';
      let configManager = ConfigManager.getInstance();
      let cpConfig = configManager.getCheckpointConfig();
      expect(cpConfig.enableChecksumValidation).toBe(true);

      ConfigManager.clearInstance();
      process.env.ENABLE_CHECKSUM_VALIDATION = '1';
      configManager = ConfigManager.getInstance();
      cpConfig = configManager.getCheckpointConfig();
      expect(cpConfig.enableChecksumValidation).toBe(true);

      ConfigManager.clearInstance();
      // false 值
      process.env.ENABLE_CHECKSUM_VALIDATION = 'false';
      configManager = ConfigManager.getInstance();
      cpConfig = configManager.getCheckpointConfig();
      expect(cpConfig.enableChecksumValidation).toBe(false);

      ConfigManager.clearInstance();
      process.env.ENABLE_CHECKSUM_VALIDATION = '0';
      configManager = ConfigManager.getInstance();
      cpConfig = configManager.getCheckpointConfig();
      expect(cpConfig.enableChecksumValidation).toBe(false);
    });
  });

  describe('审计日志配置', () => {
    it('应该使用默认审计配置', () => {
      const configManager = ConfigManager.getInstance();
      const auditConfig = configManager.getAuditConfig();

      expect(auditConfig.retentionDays).toBe(90);
      expect(auditConfig.enabled).toBe(true);
    });

    it('应该从环境变量读取审计配置', () => {
      process.env.AUDIT_LOG_RETENTION_DAYS = '180';
      process.env.AUDIT_ENABLED = 'false';

      const configManager = ConfigManager.getInstance();
      const auditConfig = configManager.getAuditConfig();

      expect(auditConfig.retentionDays).toBe(180);
      expect(auditConfig.enabled).toBe(false);
    });
  });

  describe('分布式状态配置', () => {
    it('应该使用默认分布式状态配置', () => {
      const configManager = ConfigManager.getInstance();
      const dsConfig = configManager.getDistributedStateConfig();

      expect(dsConfig.syncInterval).toBe(60000);
      expect(dsConfig.defaultConflictResolution).toBe(ConflictResolutionStrategy.LAST_WRITE_WINS);
    });

    it('应该从环境变量读取分布式状态配置', () => {
      process.env.STATE_SYNC_INTERVAL = '120000';
      process.env.DEFAULT_CONFLICT_RESOLUTION = 'MANUAL';

      const configManager = ConfigManager.getInstance();
      const dsConfig = configManager.getDistributedStateConfig();

      expect(dsConfig.syncInterval).toBe(120000);
      expect(dsConfig.defaultConflictResolution).toBe(ConflictResolutionStrategy.MANUAL);
    });
  });

  describe('开发配置', () => {
    it('应该使用默认开发配置', () => {
      const configManager = ConfigManager.getInstance();
      const devConfig = configManager.getDevelopmentConfig();

      expect(devConfig.debug).toBe(false);
      expect(devConfig.coverageThreshold).toBe(80);
    });

    it('应该从环境变量读取开发配置', () => {
      process.env.DEBUG = 'true';
      process.env.COVERAGE_THRESHOLD = '90';

      const configManager = ConfigManager.getInstance();
      const devConfig = configManager.getDevelopmentConfig();

      expect(devConfig.debug).toBe(true);
      expect(devConfig.coverageThreshold).toBe(90);
    });
  });

  describe('环境判断方法', () => {
    it('应该正确判断生产环境', () => {
      process.env.NODE_ENV = 'production';
      const configManager = ConfigManager.getInstance();

      expect(configManager.isProduction()).toBe(true);
      expect(configManager.isDevelopment()).toBe(false);
      expect(configManager.isTest()).toBe(false);
    });

    it('应该正确判断开发环境', () => {
      process.env.NODE_ENV = 'development';
      const configManager = ConfigManager.getInstance();

      expect(configManager.isProduction()).toBe(false);
      expect(configManager.isDevelopment()).toBe(true);
      expect(configManager.isTest()).toBe(false);
    });

    it('应该正确判断测试环境', () => {
      process.env.NODE_ENV = 'test';
      const configManager = ConfigManager.getInstance();

      expect(configManager.isProduction()).toBe(false);
      expect(configManager.isDevelopment()).toBe(false);
      expect(configManager.isTest()).toBe(true);
    });

    it('应该正确判断调试模式', () => {
      process.env.DEBUG = 'true';
      const configManager = ConfigManager.getInstance();

      expect(configManager.isDebug()).toBe(true);
    });
  });

  describe('配置重载', () => {
    it('应该支持配置重载', () => {
      process.env.MAX_CONCURRENT_FLOWS = '5';
      const configManager = ConfigManager.getInstance();
      let perfConfig = configManager.getPerformanceConfig();
      expect(perfConfig.maxConcurrentFlows).toBe(5);

      // 修改环境变量
      process.env.MAX_CONCURRENT_FLOWS = '10';
      configManager.reload();
      perfConfig = configManager.getPerformanceConfig();
      expect(perfConfig.maxConcurrentFlows).toBe(10);
    });
  });

  describe('配置不可变性', () => {
    it('返回的配置应该是副本', () => {
      const configManager = ConfigManager.getInstance();
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();

      // 修改副本不应影响原始配置
      config1.nodeEnv = 'modified';
      expect(config2.nodeEnv).not.toBe('modified');
    });
  });

  describe('便捷函数', () => {
    it('getConfig 函数应该返回配置管理器实例', () => {
      const configManager = getConfig();

      expect(configManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('边界条件', () => {
    it('应该处理未定义的环境变量', () => {
      delete process.env.MAX_CONCURRENT_FLOWS;
      const configManager = ConfigManager.getInstance();
      const perfConfig = configManager.getPerformanceConfig();

      expect(perfConfig.maxConcurrentFlows).toBe(5); // 默认值
    });

    it('应该处理空字符串环境变量', () => {
      process.env.ALLOWED_FILE_TYPES = '';
      const configManager = ConfigManager.getInstance();
      const fmConfig = configManager.getFileManagerConfig();

      // 空字符串应返回默认值
      expect(fmConfig.allowedFileTypes.length).toBeGreaterThan(0);
    });

    it('应该处理负数环境变量', () => {
      process.env.MAX_BATCH_SIZE = '-5';
      const configManager = ConfigManager.getInstance();
      const perfConfig = configManager.getPerformanceConfig();

      // NaN 应该使用默认值
      expect(perfConfig.maxBatchSize).toBe(10);
    });
  });
});
