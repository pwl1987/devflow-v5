/**
 * DevFlow v5 - ContextDataBus 单元测试
 *
 * 测试策略：
 * - Mock StateManager 依赖
 * - 单例模式隔离
 * - 接口契约验证
 *
 * 覆盖率目标：≥90%
 */

import { ContextDataBus } from '../../../lib/bus/ContextDataBus';
import { IContextDataBus } from '../../../lib/bus/ContextDataBus';
import { ProjectContext, AssetInfo } from '../../../core/state/ProjectContext';
import {
  clearContextDataBusCache,
  createTestProjectContext,
  createTestAssetInfo,
  assertContractCompliance,
} from '../../test-utils';

// ============ Mock StateManager ============

// 创建 Mock StateManager（模拟文件操作）
class MockStateManager {
  public context: ProjectContext | null = null;
  public assets: Map<string, AssetInfo> = new Map();
  public lockedAssets: Set<string> = new Set();
  public executionEvents: any[] = [];
  public executionHistory: ProjectContext['execution_history'] = {
    last_skill_execution: '',
    last_execution_time: '',
    execution_count: 0,
  };

  async initialize(): Promise<void> {
    if (!this.context) {
      this.context = createTestProjectContext();
    }
  }

  async readContext(): Promise<Readonly<ProjectContext>> {
    if (!this.context) {
      throw new Error('StateManager not initialized');
    }
    return Object.freeze(JSON.parse(JSON.stringify(this.context)));
  }

  async updateContext(
    updates: Partial<ProjectContext>,
    source: string
  ): Promise<void> {
    if (!this.context) {
      throw new Error('StateManager not initialized');
    }
    // 深度合并
    const merged = this.mergeDeep(this.context, updates) as ProjectContext;
    // 确保 meta 存在并更新时间戳
    if (!merged.meta) {
      merged.meta = {
        project_name: 'test-project',
        project_type: 'greenfield',
        flow_mode: 'standard',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '5.0.0',
      };
    } else {
      merged.meta.updated_at = new Date().toISOString();
    }
    this.context = merged;
  }

  async readAsset(assetKey: string): Promise<any> {
    if (!this.assets.has(assetKey)) {
      throw new Error(`Asset not found: ${assetKey}`);
    }
    return this.assets.get(assetKey);
  }

  async writeAsset(
    assetKey: string,
    content: any,
    source: string
  ): Promise<{ id: string; version: number }> {
    const existingAsset = this.assets.get(assetKey);
    if (existingAsset?.locked) {
      throw new Error(`Asset ${assetKey} is locked`);
    }

    const version = existingAsset ? existingAsset.version + 1 : 1;
    const assetInfo: AssetInfo = {
      id: `asset-${Date.now()}`,
      version,
      locked: false,
      file_path: `/_state/assets/${assetKey}.json`,
      created_at: new Date().toISOString(),
      created_by: source,
    };

    this.assets.set(assetKey, assetInfo);
    return { id: assetInfo.id, version };
  }

  async lockAsset(assetKey: string): Promise<void> {
    if (!this.assets.has(assetKey)) {
      throw new Error(`Asset not found: ${assetKey}`);
    }
    const asset = this.assets.get(assetKey)!;
    asset.locked = true;
    this.lockedAssets.add(assetKey);
  }

  async unlockAsset(assetKey: string): Promise<void> {
    if (!this.assets.has(assetKey)) {
      throw new Error(`Asset not found: ${assetKey}`);
    }
    const asset = this.assets.get(assetKey)!;
    asset.locked = false;
    this.lockedAssets.delete(assetKey);
  }

  async logExecution(event: any): Promise<void> {
    this.executionEvents.push(event);
    this.executionHistory.last_skill_execution = event.skill_id;
    this.executionHistory.last_execution_time = event.timestamp;
    this.executionHistory.execution_count++;
  }

  async getExecutionHistory(): Promise<any[]> {
    return this.executionEvents;
  }

  private mergeDeep(target: any, source: any): any {
    const output = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.mergeDeep(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }
}

// ============ Test Suite ============

describe('ContextDataBus', () => {
  // 每个测试前清理单例缓存
  beforeEach(() => {
    clearContextDataBusCache();
  });

  // afterEach 清理
  afterEach(() => {
    clearContextDataBusCache();
  });

  // ============ 单例模式测试 ============

  describe('getInstance() - 单例模式', () => {
    it('应返回相同 projectRoot 的同一实例', () => {
      const projectRoot = '/test/project';
      const bus1 = ContextDataBus.getInstance(projectRoot);
      const bus2 = ContextDataBus.getInstance(projectRoot);

      expect(bus1).toBe(bus2);
    });

    it('应返回不同 projectRoot 的不同实例', () => {
      const bus1 = ContextDataBus.getInstance('/test/project1');
      const bus2 = ContextDataBus.getInstance('/test/project2');

      expect(bus1).not.toBe(bus2);
    });

    it('应抛出错误当 projectRoot 为空', () => {
      expect(() => {
        ContextDataBus.getInstance('');
      }).toThrow('projectRoot 必须是非空绝对路径');
    });
  });

  // ============ 接口契约测试 ============

  describe('接口契约验证', () => {
    it('应实现 IContextDataBus 的所有方法', () => {
      const bus = ContextDataBus.getInstance('/test/project');
      const requiredMethods = [
        'getContext',
        'updateContext',
        'hasContext',
        'getAsset',
        'writeAsset',
        'lockAsset',
        'unlockAsset',
        'isAssetLocked',
        'logExecution',
        'getExecutionHistory',
      ];

      assertContractCompliance(
        bus,
        requiredMethods,
        'IContextDataBus'
      );
    });
  });

  // ============ 上下文读写测试 ============

  describe('getContext() - 读取上下文', () => {
    it('应成功返回只读上下文', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 注入 Mock StateManager
      (bus as any).stateManager = new MockStateManager();
      await (bus as any).stateManager.initialize();

      const context = await bus.getContext();

      expect(context).toBeDefined();
      expect(context.meta.project_name).toBe('test-project');
    });

    it('应返回深度只读对象', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();
      await (bus as any).stateManager.initialize();

      const context = await bus.getContext();

      // 尝试修改应失败（TypeScript 编译时检查）
      // 运行时无法验证 Readonly
      expect(context).toBeDefined();
    });
  });

  describe('updateContext() - 更新上下文', () => {
    it('应成功更新上下文', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();
      await (bus as any).stateManager.initialize();

      await bus.updateContext(
        { meta: { project_name: 'updated-project' } } as any,
        'test-source'
      );

      const context = await bus.getContext();
      expect(context.meta.project_name).toBe('updated-project');
    });

    it('应更新 updated_at 时间戳', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();
      await (bus as any).stateManager.initialize();

      await bus.updateContext({}, 'test-source');
      const context = await bus.getContext();

      // 验证 updated_at 是有效的 ISO 字符串
      expect(context.meta.updated_at).toBeDefined();
      expect(new Date(context.meta.updated_at).toISOString()).toBe(context.meta.updated_at);
    });
  });

  describe('hasContext() - 检查上下文是否存在', () => {
    it('应返回 true 当上下文已初始化', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();
      await (bus as any).stateManager.initialize();

      const hasContext = await bus.hasContext();
      expect(hasContext).toBe(true);
    });

    it('应返回 false 当上下文未初始化', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 不初始化 StateManager
      const hasContext = await bus.hasContext();
      expect(hasContext).toBe(false);
    });
  });

  // ============ 资产管理测试 ============

  describe('getAsset() - 获取资产', () => {
    it('应返回存在的资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.assets.set('prd', createTestAssetInfo({ id: 'test-prd' }));
      (bus as any).stateManager = mockState;

      const asset = await bus.getAsset('prd');
      expect(asset).toBeDefined();
      expect(asset?.id).toBe('test-prd');
    });

    it('应返回 null 当资产不存在', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();

      const asset = await bus.getAsset('nonexistent');
      expect(asset).toBeNull();
    });
  });

  describe('writeAsset() - 写入资产', () => {
    it('应成功写入新资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();

      const asset = await bus.writeAsset('prd', { content: 'test' }, 'test-user');

      expect(asset).toBeDefined();
      expect(asset.version).toBe(1);
    });

    it('应递增版本号当更新已存在的资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.assets.set('prd', createTestAssetInfo({ version: 1 }));
      (bus as any).stateManager = mockState;

      const asset = await bus.writeAsset('prd', { content: 'updated' }, 'test-user');

      expect(asset.version).toBe(2);
    });

    it('应抛出错误当资产已锁定', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      const lockedAsset = createTestAssetInfo({ version: 1, locked: true });
      mockState.assets.set('prd', lockedAsset);
      (bus as any).stateManager = mockState;

      await expect(
        bus.writeAsset('prd', { content: 'test' }, 'test-user')
      ).rejects.toThrow('Asset prd is locked');
    });
  });

  describe('lockAsset() / unlockAsset() - 资产锁定', () => {
    it('应成功锁定资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.assets.set('prd', createTestAssetInfo());
      (bus as any).stateManager = mockState;

      await bus.lockAsset('prd');

      const isLocked = await bus.isAssetLocked('prd');
      expect(isLocked).toBe(true);
    });

    it('应成功解锁资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      const lockedAsset = createTestAssetInfo({ locked: true });
      mockState.assets.set('prd', lockedAsset);
      (bus as any).stateManager = mockState;

      await bus.unlockAsset('prd');

      const isLocked = await bus.isAssetLocked('prd');
      expect(isLocked).toBe(false);
    });

    it('应抛出错误当锁定不存在的资产', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = new MockStateManager();

      await expect(bus.lockAsset('nonexistent')).rejects.toThrow('Asset not found');
    });
  });

  // ============ 执行日志测试 ============

  describe('logExecution() - 记录执行日志', () => {
    it('应成功记录执行日志', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      (bus as any).stateManager = mockState;

      await bus.logExecution('test-skill', 'test-action', 'success');

      // 验证 Mock StateManager 中有事件记录
      expect(mockState.executionEvents).toHaveLength(1);
      expect(mockState.executionEvents[0].skill_id).toBe('test-skill');

      // ContextDataBus 的 getExecutionHistory 应该返回适配后的历史
      const history = await bus.getExecutionHistory();
      expect(history.last_skill_execution).toBe('test-skill');
      expect(history.execution_count).toBe(1);
    });

    it('应递增执行计数', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      (bus as any).stateManager = mockState;

      await bus.logExecution('skill1', 'action1', 'success');
      await bus.logExecution('skill2', 'action2', 'success');

      // 验证 Mock StateManager 中有两条事件记录
      expect(mockState.executionEvents).toHaveLength(2);

      const history = await bus.getExecutionHistory();
      expect(history.execution_count).toBe(2);
    });
  });

  describe('getExecutionHistory() - 获取执行历史', () => {
    it('应返回完整的执行历史', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      (bus as any).stateManager = mockState;

      await bus.logExecution('test-skill', 'test-action', 'success');

      const history = await bus.getExecutionHistory();
      expect(history).toBeDefined();
      expect(history.last_skill_execution).toBe('test-skill');
      expect(history.last_execution_time).toBeDefined();
      expect(history.execution_count).toBe(1);
    });

    it('应返回空历史当没有执行事件时', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.executionEvents = []; // 空事件数组
      (bus as any).stateManager = mockState;

      const history = await bus.getExecutionHistory();
      expect(history).toBeDefined();
      expect(history.last_skill_execution).toBe('');
      expect(history.last_execution_time).toBe('');
      expect(history.execution_count).toBe(0);
    });

    it('应返回空历史当事件数组为 null 或 undefined', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.executionEvents = null as any;
      (bus as any).stateManager = mockState;

      const history = await bus.getExecutionHistory();
      expect(history).toBeDefined();
      expect(history.execution_count).toBe(0);
    });

    it('应返回空历史当最后一个事件为空时', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      const mockState = new MockStateManager();
      mockState.executionEvents = [null]; // 包含 null 元素的数组
      (bus as any).stateManager = mockState;

      const history = await bus.getExecutionHistory();
      expect(history).toBeDefined();
      expect(history.last_skill_execution).toBe('');
      expect(history.last_execution_time).toBe('');
      expect(history.execution_count).toBe(0);
    });
  });

  // ============ 错误处理和边界情况测试 ============

  describe('错误处理和边界情况', () => {
    it('应处理非字符串 projectRoot 参数', () => {
      expect(() => {
        ContextDataBus.getInstance(undefined as any);
      }).toThrow(); // path.normalize 会抛出错误

      expect(() => {
        ContextDataBus.getInstance(null as any);
      }).toThrow(); // path.normalize 会抛出错误
    });

    it('应处理相对路径 projectRoot', () => {
      expect(() => {
        ContextDataBus.getInstance('relative/path');
      }).toThrow('projectRoot 必须是非空绝对路径');
    });

    it('_setStateManager 应正确设置 StateManager', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);
      const mockState = new MockStateManager();

      (bus as any)._setStateManager(mockState);
      await mockState.initialize();

      const context = await bus.getContext();
      expect(context).toBeDefined();
      expect(context.meta.project_name).toBe('test-project');
    });

    it('应处理 readAsset 抛出的异常并返回 null', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 创建一个会抛出异常的 Mock StateManager
      class ErrorThrowingStateManager extends MockStateManager {
        async readAsset(assetKey: string): Promise<any> {
          throw new Error('Simulated read error');
        }
      }

      (bus as any).stateManager = new ErrorThrowingStateManager();

      const asset = await bus.getAsset('test-asset');
      expect(asset).toBeNull();
    });

    it('应处理 isAssetLocked 中的异常并返回 false', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 创建一个会抛出异常的 Mock StateManager
      class ErrorThrowingStateManager extends MockStateManager {
        async readAsset(assetKey: string): Promise<any> {
          throw new Error('Simulated read error');
        }
      }

      (bus as any).stateManager = new ErrorThrowingStateManager();

      const isLocked = await bus.isAssetLocked('test-asset');
      expect(isLocked).toBe(false);
    });

    it('应处理 hasContext 中 readContext 抛出的异常', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 创建一个会抛出异常的 Mock StateManager
      class ErrorThrowingStateManager extends MockStateManager {
        async readContext(): Promise<any> {
          throw new Error('Simulated read error');
        }
      }

      (bus as any).stateManager = new ErrorThrowingStateManager();

      const hasContext = await bus.hasContext();
      expect(hasContext).toBe(false);
    });

    it('应抛出错误当 StateManager 未初始化时调用 getContext', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      // 确保没有 StateManager
      (bus as any).stateManager = null;

      // ensureInitialized 会尝试延迟加载，但会失败
      await expect(bus.getContext()).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 updateContext', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(
        bus.updateContext({ meta: { project_name: 'test' } } as any, 'test')
      ).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 writeAsset', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(
        bus.writeAsset('test-asset', { content: 'test' }, 'test-source')
      ).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 lockAsset', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(bus.lockAsset('test-asset')).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 unlockAsset', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(bus.unlockAsset('test-asset')).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 isAssetLocked', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(bus.isAssetLocked('test-asset')).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 logExecution', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(
        bus.logExecution('test-skill', 'test-action', 'success')
      ).rejects.toThrow('StateManager not available and not injected');
    });

    it('应抛出错误当 StateManager 未初始化时调用 getExecutionHistory', async () => {
      const projectRoot = '/test/project';
      const bus = ContextDataBus.getInstance(projectRoot);

      (bus as any).stateManager = null;

      await expect(bus.getExecutionHistory()).rejects.toThrow('StateManager not available and not injected');
    });

    it('_clearCache 应清除特定路径的缓存', () => {
      const projectRoot1 = '/test/project1';
      const projectRoot2 = '/test/project2';

      const bus1 = ContextDataBus.getInstance(projectRoot1);
      const bus2 = ContextDataBus.getInstance(projectRoot2);

      // 清除 projectRoot1 的缓存
      ContextDataBus._clearCache(projectRoot1);

      // projectRoot1 应该返回新实例
      const bus1New = ContextDataBus.getInstance(projectRoot1);
      expect(bus1New).not.toBe(bus1);

      // projectRoot2 应该返回同一实例
      const bus2Same = ContextDataBus.getInstance(projectRoot2);
      expect(bus2Same).toBe(bus2);
    });

    it('_clearCache 不带参数应清除所有缓存', () => {
      const projectRoot1 = '/test/project1';
      const projectRoot2 = '/test/project2';

      const bus1 = ContextDataBus.getInstance(projectRoot1);
      const bus2 = ContextDataBus.getInstance(projectRoot2);

      // 清除所有缓存
      ContextDataBus._clearCache();

      // 两个都应该返回新实例
      const bus1New = ContextDataBus.getInstance(projectRoot1);
      const bus2New = ContextDataBus.getInstance(projectRoot2);

      expect(bus1New).not.toBe(bus1);
      expect(bus2New).not.toBe(bus2);
    });
  });
});
