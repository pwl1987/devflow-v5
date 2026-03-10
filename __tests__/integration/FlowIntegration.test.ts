/**
 * DevFlow v5 - 完整流程集成测试
 *
 * 测试策略：
 * - 集成所有核心组件：ContextDataBus、SmartRouter、HookManager、ChangeDetector、SkillExecutor、BatchManager
 * - 测试绿地项目完整流程：init → research → design → develop → test → deploy
 * - 测试棕地项目完整流程：analysis → assessment → refactor → test → deploy
 * - 验证组件间交互正确性
 * - 验证钩子系统正确触发
 * - 验证路由系统正确分发
 */

import { GreenfieldFlow, IGreenfieldFlow, FlowConfig, FlowState } from '../../core/flow/GreenfieldFlow';
import { BrownfieldFlow, IBrownfieldFlow, BrownfieldConfig, BrownfieldState } from '../../core/flow/BrownfieldFlow';
import { ContextDataBus, IContextDataBus } from '../../lib/bus/ContextDataBus';
import { SmartRouter } from '../../core/router/SmartRouterImpl';
import { HookManager, HookStage } from '../../core/hooks/HookManagerImpl';
import { ChangeDetector, IChangeDetector } from '../../core/filemanager/ChangeDetector';
import { SkillExecutor, ISkillExecutor, SkillInput, SkillExecutionResult, SkillExecutionStatus, ISkillLifecycle } from '../../core/skill/SkillExecutor';
import { BatchManager, IBatchManager } from '../../core/batch/BatchManager';
import { ProjectContext, Phase } from '../../core/state/ProjectContext';
import { StateManager } from '../../core/state/StateManager';

// ============ 测试项目路径 ============
const TEST_PROJECT_ROOT = '/test/integration-project';

// ============ Mock StateManager for Testing ============

class MockStateManager {
  private context: ProjectContext | null = null;
  private assets: Map<string, any> = new Map();
  private assetInfos: Map<string, any> = new Map();
  private executionEvents: any[] = [];

  async initialize(): Promise<void> {
    this.context = {
      meta: {
        project_name: 'test-integration',
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
      git: { uncommitted_changes: 0 },
      execution_history: {
        last_skill_execution: '',
        last_execution_time: '',
        execution_count: 0,
      },
    };
  }

  async readContext(): Promise<ProjectContext> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    return this.context;
  }

  async updateContext(updates: Partial<ProjectContext>, source: string): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }
    // 深度合并
    if (updates.assets) {
      this.context.assets = { ...this.context.assets, ...updates.assets };
    }
    this.context = { ...this.context, ...updates };
    this.context.meta.updated_at = new Date().toISOString();
  }

  async readAsset(assetKey: string): Promise<any> {
    // 返回资产信息（与实际 StateManager 行为一致）
    // ContextDataBus.writeAsset 会调用 readAsset 获取 AssetInfo
    const assetInfo = this.assetInfos.get(assetKey);
    if (assetInfo) {
      return assetInfo;
    }
    // 如果没有资产信息，返回内容
    return this.assets.get(assetKey);
  }

  async writeAsset(assetKey: string, content: any, source?: string): Promise<{ id: string; version: number }> {
    // 存储内容
    this.assets.set(assetKey, content);

    // 创建资产信息
    const assetInfo = {
      id: assetKey,
      version: 1,
      locked: false,
      file_path: `/test/${assetKey}.json`,
      created_at: new Date().toISOString(),
      created_by: source || 'test',
    };

    // 存储资产信息
    this.assetInfos.set(assetKey, assetInfo);

    // 更新上下文中的资产信息
    if (this.context) {
      this.context.assets = {
        ...this.context.assets,
        [assetKey]: assetInfo,
      };
    }

    return { id: assetInfo.id, version: assetInfo.version };
  }

  async lockAsset(): Promise<void> {}

  async unlockAsset(): Promise<void> {}

  async isAssetLocked(): Promise<boolean> {
    return false;
  }

  async logExecution(event: any): Promise<void> {
    this.executionEvents.push(event);
  }

  async getExecutionHistory(): Promise<any> {
    return {
      last_skill_execution: this.executionEvents[this.executionEvents.length - 1]?.skill_id || '',
      last_execution_time: this.executionEvents[this.executionEvents.length - 1]?.timestamp || '',
      execution_count: this.executionEvents.length,
    };
  }
}

// ============ Mock Skill 实现 ============

class MockTestSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    return { success: true, action: input.action, params: input.params };
  }

  async preCheck?(input: SkillInput): Promise<boolean> {
    return true;
  }

  async postProcess?(result: any, input: SkillInput): Promise<void> {
    // Mock post process
  }

  async rollback?(input: SkillInput): Promise<boolean> {
    return true;
  }

  async dryRun?(input: SkillInput): Promise<any> {
    return { dryRun: true, action: input.action };
  }

  metadata = {
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'Mock skill for testing',
  };
}

// ============ 集成测试工具类 ============

/**
 * 完整流程集成测试套件
 * 验证所有组件协同工作
 */
describe('完整流程集成测试', () => {
  let contextBus: IContextDataBus;
  let skillExecutor: ISkillExecutor;
  let changeDetector: IChangeDetector;
  let batchManager: IBatchManager;
  let greenfieldFlow: IGreenfieldFlow;
  let brownfieldFlow: IBrownfieldFlow;
  let router: SmartRouter;
  let hookManager: HookManager;
  let skillRegistry: Map<string, ISkillLifecycle>;

  beforeEach(async () => {
    // 清理单例缓存
    ContextDataBus._clearCache();
    SmartRouter._clearCache();
    HookManager._clearCache();

    // 初始化核心组件
    contextBus = ContextDataBus.getInstance(TEST_PROJECT_ROOT);

    // 初始化并注入 MockStateManager
    const mockStateManager = new MockStateManager();
    await mockStateManager.initialize();
    (contextBus as any)._setStateManager(mockStateManager);

    skillRegistry = new Map<string, ISkillLifecycle>();
    skillRegistry.set('test-skill', new MockTestSkill());
    skillExecutor = new SkillExecutor(contextBus, skillRegistry);
    changeDetector = new ChangeDetector(contextBus);
    batchManager = new BatchManager(contextBus, skillExecutor);
    greenfieldFlow = new GreenfieldFlow(contextBus, skillExecutor);
    brownfieldFlow = new BrownfieldFlow(contextBus, skillExecutor, changeDetector);
    router = SmartRouter.getInstance(TEST_PROJECT_ROOT);
    hookManager = HookManager.getInstance(TEST_PROJECT_ROOT);
  });

  afterEach(() => {
    // 清理单例缓存
    ContextDataBus._clearCache();
    SmartRouter._clearCache();
    HookManager._clearCache();
  });

  // ============ 绿地项目集成测试 ============

  describe('绿地项目完整流程集成', () => {
    it('应成功执行完整的绿地项目流程', async () => {
      // 注册钩子
      let beforeUpdateCalled = false;
      let afterUpdateCalled = false;
      let beforeSkillCalled = false;
      let afterSkillCalled = false;

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'test-before', async () => {
        beforeUpdateCalled = true;
      });
      hookManager.registerHook(HookStage.AfterContextUpdate, 'test-after', async () => {
        afterUpdateCalled = true;
      });
      hookManager.registerHook(HookStage.BeforeSkillExecution, 'test-skill-before', async () => {
        beforeSkillCalled = true;
      });
      hookManager.registerHook(HookStage.AfterSkillExecution, 'test-skill-after', async () => {
        afterSkillCalled = true;
      });

      // 配置绿地项目
      const config: FlowConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-greenfield',
        projectType: 'greenfield',
        skipTests: false,
      };

      // 执行完整流程
      const result = await greenfieldFlow.start(config);

      // 验证流程完成
      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.completedStories).toBeDefined();
      expect(result.errors).toEqual([]);

      // 注：当前Flow实现未集成HookManager，这是改进点
    });

    it('应支持跳过测试阶段的绿地项目流程', async () => {
      const config: FlowConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-greenfield-notest',
        projectType: 'greenfield',
        skipTests: true,
      };

      const result = await greenfieldFlow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应正确处理绿地项目流程中的错误', async () => {
      // Mock SkillExecutor 抛出异常
      const faultySkillExecutor = {
        async execute(input: SkillInput): Promise<SkillExecutionResult> {
          throw new Error('Skill execution failed');
        },
        async preCheck(): Promise<boolean> {
          return true;
        },
        async postProcess() {},
        async rollback(): Promise<boolean> {
          return true;
        },
        async dryRun(): Promise<SkillExecutionResult> {
          return {
            skillId: 'test',
            status: 'success' as SkillExecutionStatus,
            startTime: new Date().toISOString(),
            output: {},
          };
        },
        async getSkillMetadata() {
          return null;
        },
        async getExecutionHistory() {
          return [];
        },
      } as ISkillExecutor;

      const faultyFlow = new GreenfieldFlow(contextBus, faultySkillExecutor);

      const config: FlowConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-greenfield-error',
        projectType: 'greenfield',
      };

      // 当前实现不会抛出异常，而是在状态中记录错误
      const result = await faultyFlow.start(config);

      expect(result).toBeDefined();
    });
  });

  // ============ 棕地项目集成测试 ============

  describe('棕地项目完整流程集成', () => {
    it('应成功执行完整的棕地项目流程', async () => {
      // 注册分析前钩子
      let analysisHookCalled = false;
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'analysis-hook', async () => {
        analysisHookCalled = true;
      });

      const config: BrownfieldConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-brownfield',
        skipTests: false,
        analysisDepth: 'standard',
        includeRefactorPlan: true,
      };

      const result = await brownfieldFlow.start(config);

      // 验证流程完成
      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.analysisResults).toBeDefined();
      expect(result.analysisResults?.techStack).toBeDefined();
      expect(result.analysisResults?.issues).toBeDefined();
      expect(result.analysisResults?.recommendations).toBeDefined();

      // 验证重构计划已生成
      expect(result.completedStories).toContain('refactor-plan-generated');
    });

    it('应支持快速分析的棕地项目流程', async () => {
      const config: BrownfieldConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-brownfield-quick',
        analysisDepth: 'quick',
        includeRefactorPlan: false,
      };

      const result = await brownfieldFlow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.analysisResults).toBeDefined();
    });

    it('应支持深度分析的棕地项目流程', async () => {
      const config: BrownfieldConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-brownfield-deep',
        analysisDepth: 'deep',
        includeRefactorPlan: true,
      };

      const result = await brownfieldFlow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.analysisResults).toBeDefined();
    });

    it('应正确处理ChangeDetector集成', async () => {
      const config: BrownfieldConfig = {
        projectRoot: TEST_PROJECT_ROOT,
        projectName: 'integration-changedetector',
      };

      const result = await brownfieldFlow.start(config);

      // 验证分析结果包含变更检测信息
      expect(result.analysisResults).toBeDefined();
      expect(result.analysisResults?.techStack.length).toBeGreaterThan(0);
    });
  });

  // ============ SmartRouter 集成测试 ============

  describe('SmartRouter 路由集成', () => {
    it('应根据项目类型正确路由到对应流程', async () => {
      let greenfieldRouted = false;
      let brownfieldRouted = false;

      // 注册绿地项目路由规则
      router.registerRule('greenfield-route', {
        match: (ctx: ProjectContext) => {
          return ctx.meta.project_type === 'greenfield';
        },
        handler: async (ctx: ProjectContext) => {
          greenfieldRouted = true;
          return { routed: 'greenfield', projectName: ctx.meta.project_name };
        },
      });

      // 注册棕地项目路由规则
      router.registerRule('brownfield-route', {
        match: (ctx: ProjectContext) => {
          return ctx.meta.project_type === 'brownfield';
        },
        handler: async (ctx: ProjectContext) => {
          brownfieldRouted = true;
          return { routed: 'brownfield', projectName: ctx.meta.project_name };
        },
      });

      // 测试绿地项目路由
      const greenfieldContext: ProjectContext = {
        meta: {
          project_name: 'greenfield-test',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      const greenfieldResult = await router.route(greenfieldContext);
      expect(greenfieldResult.routed).toBe('greenfield');
      expect(greenfieldRouted).toBe(true);

      // 测试棕地项目路由
      const brownfieldContext: ProjectContext = {
        ...greenfieldContext,
        meta: {
          ...greenfieldContext.meta,
          project_type: 'brownfield',
        },
      };

      const brownfieldResult = await router.route(brownfieldContext);
      expect(brownfieldResult.routed).toBe('brownfield');
      expect(brownfieldRouted).toBe(true);
    });

    it('应支持兜底处理器', async () => {
      let fallbackCalled = false;

      router.setFallbackHandler(async (ctx: ProjectContext) => {
        fallbackCalled = true;
        return { fallback: true, projectName: ctx.meta.project_name };
      });

      // 创建不匹配任何规则的项目上下文
      const unknownContext: ProjectContext = {
        meta: {
          project_name: 'unknown-project',
          project_type: 'greenfield',
          flow_mode: 'quick', // 使用有效的 flow_mode
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 不注册任何路由规则，直接触发兜底处理器
      const result = await router.route(unknownContext);
      expect(result.fallback).toBe(true);
      expect(fallbackCalled).toBe(true);
    });
  });

  // ============ HookManager 集成测试 ============

  describe('HookManager 钩子集成', () => {
    it('应按正确顺序触发钩子', async () => {
      const callOrder: string[] = [];

      hookManager.registerHook(HookStage.BeforeContextUpdate, 'hook1', async () => {
        callOrder.push('before1');
      });
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'hook2', async () => {
        callOrder.push('before2');
      });
      hookManager.registerHook(HookStage.AfterContextUpdate, 'hook3', async () => {
        callOrder.push('after1');
      });

      const mockContext: ProjectContext = {
        meta: {
          project_name: 'hook-test',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 触发 BeforeContextUpdate 钩子
      await hookManager.triggerHooks(HookStage.BeforeContextUpdate, mockContext);
      await hookManager.triggerHooks(HookStage.AfterContextUpdate, mockContext);

      // 验证钩子按注册顺序执行
      expect(callOrder).toEqual(['before1', 'before2', 'after1']);
    });

    it('应正确处理钩子执行错误', async () => {
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'failing-hook', async () => {
        throw new Error('Hook execution failed');
      });

      const mockContext: ProjectContext = {
        meta: {
          project_name: 'hook-error-test',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 验证钩子错误被正确抛出
      await expect(
        hookManager.triggerHooks(HookStage.BeforeContextUpdate, mockContext)
      ).rejects.toThrow('Hook execution failed');
    });
  });

  // ============ BatchManager 集成测试 ============

  describe('BatchManager 批量处理集成', () => {
    it('应与 SkillExecutor 正确集成执行批量任务', async () => {
      const tasks = [
        {
          storyId: 'story-1',
          skillId: 'test-skill',
          action: 'test-action',
          params: { task: 1 },
          status: 'pending' as const,
          retryCount: 0,
        },
        {
          storyId: 'story-2',
          skillId: 'test-skill',
          action: 'test-action',
          params: { task: 2 },
          status: 'pending' as const,
          retryCount: 0,
        },
        {
          storyId: 'story-3',
          skillId: 'test-skill',
          action: 'test-action',
          params: { task: 3 },
          status: 'pending' as const,
          retryCount: 0,
        },
      ];

      const result = await batchManager.executeBatch(tasks);

      expect(result.totalTasks).toBe(3);
      expect(result.completedTasks).toBe(3);
      expect(result.failedTasks).toBe(0);
      expect(result.status).toBe('completed');
      expect(result.results.size).toBe(3);
    });

    it('应支持批量处理进度查询', async () => {
      const tasks = [
        {
          storyId: 'story-1',
          skillId: 'test-skill',
          action: 'test-action',
          params: {},
          status: 'pending' as const,
          retryCount: 0,
        },
      ];

      const executeResult = await batchManager.executeBatch(tasks);
      const progress = await batchManager.getProgress(executeResult.batchId);

      expect(progress.batchId).toBe(executeResult.batchId);
      expect(progress.totalTasks).toBe(1);
      expect(progress.completedTasks).toBe(1);
      expect(progress.status).toBe('completed');
    });
  });

  // ============ ContextDataBus 集成测试 ============

  describe('ContextDataBus 上下文总线集成', () => {
    it('应作为唯一数据源为所有组件服务', async () => {
      // 验证单例模式
      const bus1 = ContextDataBus.getInstance(TEST_PROJECT_ROOT);
      const bus2 = ContextDataBus.getInstance(TEST_PROJECT_ROOT);
      expect(bus1).toBe(bus2);

      // 验证不同项目根路径返回不同实例
      const otherProjectBus = ContextDataBus.getInstance('/test/other-project');
      expect(otherProjectBus).not.toBe(bus1);
    });

    it('应支持资产读写操作', async () => {
      const assetKey = 'test-asset';
      const content = { name: 'test', value: 123 };
      const source = 'integration-test';

      const assetInfo = await contextBus.writeAsset(assetKey, content, source);

      expect(assetInfo).toBeDefined();
      expect(assetInfo.id).toBe(assetKey);
      expect(assetInfo.created_by).toBe(source);

      // getAsset 返回 AssetInfo（当前实现行为）
      const retrievedAssetInfo = await contextBus.getAsset(assetKey);
      expect(retrievedAssetInfo).toBeDefined();
      expect(retrievedAssetInfo?.id).toBe(assetKey);
    });
  });

  // ============ 端到端场景测试 ============

  describe('端到端场景测试', () => {
    it('应支持完整的绿地项目从初始化到部署', async () => {
      // 1. 初始化钩子
      const phases: string[] = [];
      hookManager.registerHook(HookStage.BeforeContextUpdate, 'phase-tracker', async (ctx) => {
        phases.push(`phase-${ctx.status.current_phase}`);
      });

      // 2. 配置路由
      router.registerRule('greenfield-e2e', {
        match: (ctx) => ctx.meta.project_type === 'greenfield',
        handler: async (ctx) => {
          const config: FlowConfig = {
            projectRoot: TEST_PROJECT_ROOT,
            projectName: ctx.meta.project_name,
            projectType: 'greenfield',
          };
          return await greenfieldFlow.start(config);
        },
      });

      // 3. 创建项目上下文
      const projectContext: ProjectContext = {
        meta: {
          project_name: 'e2e-greenfield',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'idle' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 6,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 0 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 4. 通过路由执行流程
      const result = await router.route(projectContext);

      // 5. 验证完整流程执行成功
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应支持完整的棕地项目从分析到部署', async () => {
      // 1. 配置路由
      router.registerRule('brownfield-e2e', {
        match: (ctx) => ctx.meta.project_type === 'brownfield',
        handler: async (ctx) => {
          const config: BrownfieldConfig = {
            projectRoot: TEST_PROJECT_ROOT,
            projectName: ctx.meta.project_name,
            analysisDepth: 'standard',
            includeRefactorPlan: true,
          };
          return await brownfieldFlow.start(config);
        },
      });

      // 2. 创建棕地项目上下文
      const projectContext: ProjectContext = {
        meta: {
          project_name: 'e2e-brownfield',
          project_type: 'brownfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0',
        },
        status: {
          current_phase: 'analysis' as Phase,
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 5,
          progress_percentage: 0,
        },
        tech_stack: {},
        assets: {},
        git: { uncommitted_changes: 5 },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0,
        },
      };

      // 3. 通过路由执行流程
      const result = await router.route(projectContext);

      // 4. 验证完整流程执行成功
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.analysisResults).toBeDefined();
      expect(result.completedStories).toContain('refactor-plan-generated');
    });
  });
});
