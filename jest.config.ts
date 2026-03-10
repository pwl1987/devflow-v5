/**
 * DevFlow v5 - Jest 配置
 *
 * 设计原则：
 * - ts-jest 预设，简化 TypeScript 配置
 * - Node.js 测试环境（非浏览器）
 * - 覆盖率阈值≥90%（核心逻辑）
 * - 模块隔离（支持单例测试）
 */

import type { Config } from 'jest';

const config: Config = {
  // 使用 ts-jest 预设
  preset: 'ts-jest',

  // 测试环境：Node.js（非浏览器）
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // 模块路径映射（支持 @/ 别名）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // 配置文件
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // 全局变量启用（简化测试代码）
  injectGlobals: true,

  // Mock 自动清理
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // 覆盖率配置
  collectCoverageFrom: [
    'core/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // 核心组件需要更高的覆盖率
    './lib/bus/ContextDataBus.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './core/router/SmartRouter.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './core/hooks/HookManager.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './core/filemanager/ChangeDetector.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // 忽略模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  modulePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],

  // 转换配置
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

export default config;
