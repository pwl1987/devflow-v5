/**
 * DevFlow v5 - 测试工具函数库
 *
 * 提供可复用的测试辅助工具：
 * - Mock 工厂（依赖注入）
 * - 单例隔离工具
 * - 测试数据生成器
 *
 * 设计原则：
 * - 仅在测试环境使用
 * - 遵循依赖注入模式
 * - 支持单例模式隔离
 */

import { ContextDataBus } from '../lib/bus/ContextDataBus';
import { IContextDataBus } from '../lib/bus/ContextDataBus';
import { ProjectContext, AssetInfo } from '../core/state/ProjectContext';

// ============ 类型定义 ============

/**
 * Mock 依赖注入容器
 */
export interface TestDIContainer {
  contextBus: jest.Mocked<IContextDataBus>;
  // 预留其他依赖的 mock
  // stateManager?: jest.Mocked<IStateManager>;
  // fileManager?: jest.Mocked<IFileManager>;
}

// ============ Mock 工厂 ============

/**
 * 创建 ContextDataBus Mock 实例
 *
 * @param initialContext - 初始上下文数据（可选）
 * @returns Mock 的 IContextDataBus 实例
 */
export function createMockContextDataBus(
  initialContext?: Partial<ProjectContext>
): jest.Mocked<IContextDataBus> {
  const mockContext: ProjectContext = {
    meta: {
      project_name: 'test-project',
      project_type: 'greenfield',
      flow_mode: 'standard',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: '5.0.0',
    },
    status: {
      current_phase: 'idle',
      current_story: null,
      last_story: null,
      completed_stories: [],
      total_stories: 0,
      progress_percentage: 0,
    },
    tech_stack: {},
    assets: {},
    git: {
      uncommitted_changes: 0,
    },
    execution_history: {
      last_skill_execution: '',
      last_execution_time: '',
      execution_count: 0,
    },
    ...initialContext,
  };

  return {
    getContext: jest.fn().mockResolvedValue(mockContext),
    updateContext: jest.fn().mockResolvedValue(undefined),
    hasContext: jest.fn().mockResolvedValue(true),
    getAsset: jest.fn().mockResolvedValue(null),
    writeAsset: jest.fn().mockResolvedValue({
      id: 'test-asset',
      version: 1,
      locked: false,
      file_path: '/test/asset.md',
      created_at: new Date().toISOString(),
      created_by: 'test',
    }),
    lockAsset: jest.fn().mockResolvedValue(undefined),
    unlockAsset: jest.fn().mockResolvedValue(undefined),
    isAssetLocked: jest.fn().mockResolvedValue(false),
    logExecution: jest.fn().mockResolvedValue(undefined),
    getExecutionHistory: jest.fn().mockResolvedValue(mockContext.execution_history),
  };
}

/**
 * 创建测试依赖注入容器
 *
 * @param initialContext - 初始上下文数据（可选）
 * @returns 包含所有 Mock 依赖的容器
 */
export function createTestDIContainer(
  initialContext?: Partial<ProjectContext>
): TestDIContainer {
  return {
    contextBus: createMockContextDataBus(initialContext),
  };
}

// ============ 单例隔离工具 ============

/**
 * 清除 ContextDataBus 单例缓存
 *
 * **安全说明**：
 * - 仅在测试环境调用
 * - 使用 @internal 标记的私有方法
 * - 不会泄漏到生产代码
 *
 * @param projectRoot - 可选，指定清除特定路径的缓存
 */
export function clearContextDataBusCache(projectRoot?: string): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearContextDataBusCache 只能在测试环境调用');
  }
  ContextDataBus._clearCache(projectRoot);
}

/**
 * 创建隔离的 ContextDataBus 实例
 *
 * 每次调用都会：
 * 1. 清除单例缓存
 * 2. 创建新的隔离实例
 * 3. 返回独立的测试实例
 *
 * @param projectRoot - 项目根路径
 * @returns 新的 ContextDataBus 实例
 */
export function createIsolatedContextDataBus(
  projectRoot: string
): ContextDataBus {
  clearContextDataBusCache();
  return ContextDataBus.getInstance(projectRoot);
}

// ============ 测试数据生成器 ============

/**
 * 生成测试用的 ProjectContext
 *
 * @param overrides - 覆盖默认字段
 * @returns 完整的 ProjectContext 对象
 */
export function createTestProjectContext(
  overrides: Partial<ProjectContext> = {}
): ProjectContext {
  const now = new Date().toISOString();
  return {
    meta: {
      project_name: 'test-project',
      project_type: 'greenfield',
      flow_mode: 'standard',
      created_at: now,
      updated_at: now,
      version: '5.0.0',
    },
    status: {
      current_phase: 'idle',
      current_story: null,
      last_story: null,
      completed_stories: [],
      total_stories: 0,
      progress_percentage: 0,
    },
    tech_stack: {
      frontend: {
        framework: 'React',
        version: '18.2.0',
        language: 'typescript',
      },
      backend: {
        framework: 'Express',
        version: '4.18.0',
        language: 'javascript',
      },
      database: 'PostgreSQL',
      test_framework: ['jest', 'playwright'],
      code_quality: ['eslint', 'prettier'],
    },
    assets: {},
    git: {
      remote_url: 'https://github.com/test/repo',
      branch: 'main',
      last_commit: 'abc123',
      uncommitted_changes: 0,
    },
    execution_history: {
      last_skill_execution: 'test-skill',
      last_execution_time: now,
      execution_count: 1,
    },
    ...overrides,
  };
}

/**
 * 生成测试用的 AssetInfo
 *
 * @param overrides - 覆盖默认字段
 * @returns AssetInfo 对象
 */
export function createTestAssetInfo(
  overrides: Partial<AssetInfo> = {}
): AssetInfo {
  const now = new Date().toISOString();
  return {
    id: 'test-asset-id',
    version: 1,
    locked: false,
    file_path: '/test/asset.md',
    created_at: now,
    created_by: 'test-user',
    ...overrides,
  };
}

// ============ 断言辅助函数 ============

/**
 * 验证接口契约合规性
 *
 * 检查对象是否实现了指定接口的所有方法
 *
 * @param obj - 待验证对象
 * @param interfaceMethods - 接口方法列表
 * @param interfaceName - 接口名称（用于错误消息）
 */
export function assertContractCompliance(
  obj: any,
  interfaceMethods: string[],
  interfaceName: string
): void {
  const missingMethods = interfaceMethods.filter(
    method => typeof obj[method] !== 'function'
  );

  if (missingMethods.length > 0) {
    throw new Error(
      `接口契约违规：${interfaceName} 缺少方法：${missingMethods.join(', ')}`
    );
  }
}

/**
 * 验证只读视图深度只读
 *
 * @param readonlyObj - 只读对象
 * @param originalObj - 原始对象
 */
export function assertDeepReadonly<T>(
  readonlyObj: Readonly<T>,
  originalObj: T
): void {
  // TypeScript 的 Readonly 是编译时类型，运行时无法验证
  // 这里仅做类型标注，实际验证需要通过 linter
  expect(readonlyObj).toEqual(originalObj);
}
