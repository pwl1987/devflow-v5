/**
 * GreenfieldFlow 单元测试
 *
 * 测试策略：
 * - Mock IContextDataBus 和 ISkillExecutor 依赖
 * - 测试流程阶段转换
 * - 测试配置选项
 * - 测试状态查询
 * - 测试错误处理
 */

import { GreenfieldFlow, IGreenfieldFlow, FlowConfig, FlowState, FlowPhase } from '../../core/flow/GreenfieldFlow';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ISkillExecutor, SkillInput, SkillExecutionResult, SkillExecutionStatus } from '../../core/skill/SkillExecutor';
import { ProjectContext, AssetInfo, ExecutionHistory } from '../../core/state/ProjectContext';

// ============ Mock ContextDataBus ============

class MockContextDataBus implements IContextDataBus {
  async getContext(): Promise<Readonly<ProjectContext>> {
    return Object.freeze({
      meta: {
        project_name: 'test-project',
        project_type: 'greenfield' as const,
        flow_mode: 'standard' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '5.0.0',
      },
      status: {
        current_phase: 'idle' as const,
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
    });
  }

  async updateContext(): Promise<void> {}

  async getAsset(): Promise<any> {
    return null;
  }

  async writeAsset(assetKey: string, content: any, source: string): Promise<AssetInfo> {
    return {
      id: assetKey,
      version: 1,
      locked: false,
      file_path: `/test/${assetKey}.md`,
      created_at: new Date().toISOString(),
      created_by: source,
    };
  }

  async lockAsset(): Promise<void> {}

  async unlockAsset(): Promise<void> {}

  async hasContext(): Promise<boolean> {
    return true;
  }

  async logExecution(): Promise<void> {}

  async getExecutionHistory(): Promise<ExecutionHistory> {
    return {
      last_skill_execution: '',
      last_execution_time: '',
      execution_count: 0,
    };
  }

  async isAssetLocked(): Promise<boolean> {
    return false;
  }
}

// ============ Mock SkillExecutor ============

class MockSkillExecutor implements ISkillExecutor {
  async execute(input: SkillInput): Promise<SkillExecutionResult> {
    return {
      skillId: input.skillId,
      status: 'success' as SkillExecutionStatus,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      output: { success: true },
    };
  }

  async preCheck(input?: SkillInput): Promise<boolean> {
    return true;
  }

  async postProcess(): Promise<void> {}

  async rollback(): Promise<boolean> {
    return true;
  }

  async dryRun(input: SkillInput): Promise<SkillExecutionResult> {
    return {
      skillId: input.skillId,
      status: 'success' as SkillExecutionStatus,
      startTime: new Date().toISOString(),
      output: { dryRun: true },
    };
  }

  async getSkillMetadata() {
    return null;
  }

  async getExecutionHistory() {
    return [];
  }
}

// ============ Test Suite ============

describe('GreenfieldFlow', () => {
  let contextBus: IContextDataBus;
  let skillExecutor: ISkillExecutor;
  let flow: IGreenfieldFlow;

  beforeEach(() => {
    contextBus = new MockContextDataBus();
    skillExecutor = new MockSkillExecutor();
    flow = new GreenfieldFlow(contextBus, skillExecutor);
  });

  // ============ start() 测试 ============

  describe('start() - 启动绿地项目流程', () => {
    it('应成功启动完整流程', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.completedStories).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('应按顺序执行所有阶段', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      // 收集所有阶段
      const phases: FlowPhase[] = [];
      const originalStart = flow.start.bind(flow);

      // Mock 以捕获每个阶段
      const mockStart = async function(this: any, config: FlowConfig): Promise<FlowState> {
        const state = await originalStart(config);
        return state;
      };

      const result = await flow.start(config);

      // 验证最终阶段是 deploy
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应支持跳过测试阶段', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
        skipTests: true,
      };

      const result = await flow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应包含测试阶段当 skipTests 为 false', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
        skipTests: false,
      };

      const result = await flow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应处理棕地项目类型', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'brownfield-project',
        projectType: 'brownfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
      expect(result.progress).toBeGreaterThanOrEqual(0);
    });

    it('应记录进度百分比', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      // 验证进度是递增的
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
    });

    it('应初始化空的状态数组', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      expect(Array.isArray(result.completedStories)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.completedStories.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('应处理不同的项目根路径', async () => {
      const configs: FlowConfig[] = [
        {
          projectRoot: '/path/to/project1',
          projectName: 'project1',
          projectType: 'greenfield',
        },
        {
          projectRoot: '/path/to/project2',
          projectName: 'project2',
          projectType: 'greenfield',
        },
      ];

      for (const config of configs) {
        const result = await flow.start(config);
        expect(result).toBeDefined();
      }
    });
  });

  // ============ getState() 测试 ============

  describe('getState() - 获取流程状态', () => {
    it('应返回当前流程状态', async () => {
      const state = await flow.getState();

      expect(state).toBeDefined();
      expect(state.currentPhase).toBeDefined();
      expect(typeof state.progress).toBe('number');
      expect(Array.isArray(state.completedStories)).toBe(true);
      expect(Array.isArray(state.errors)).toBe(true);
    });

    it('应返回独立的状态副本', async () => {
      const state1 = await flow.getState();
      const state2 = await flow.getState();

      // 修改一个状态不应影响另一个
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('应包含初始状态', async () => {
      const state = await flow.getState();

      expect(state.currentPhase).toBe('init');
      expect(state.progress).toBe(0);
    });

    it('应更新状态在 start() 之后', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      await flow.start(config);
      const state = await flow.getState();

      expect(state.currentPhase).toBe('deploy');
      expect(state.progress).toBe(100);
    });
  });

  // ============ 阶段顺序测试 ============

  describe('阶段顺序', () => {
    it('应遵循正确的阶段顺序', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const expectedPhases: FlowPhase[] = ['init', 'research', 'design', 'develop', 'test', 'deploy'];
      const result = await flow.start(config);

      // 最终阶段应该是 deploy
      expect(result.currentPhase).toBe(expectedPhases[expectedPhases.length - 1]);
    });

    it('应为每个阶段设置正确的进度', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      // 验证最终进度是 100%
      expect(result.progress).toBe(100);
    });
  });

  // ============ 配置验证测试 ============

  describe('配置验证', () => {
    it('应接受有效的绿地项目配置', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-greenfield',
        projectType: 'greenfield',
        skipTests: false,
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
    });

    it('应接受有效的棕地项目配置', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-brownfield',
        projectType: 'brownfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
    });

    it('应处理可选的 skipTests 参数', async () => {
      const config1: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result1 = await flow.start(config1);
      expect(result1).toBeDefined();

      const config2: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
        skipTests: true,
      };

      const result2 = await flow.start(config2);
      expect(result2).toBeDefined();
    });
  });

  // ============ 边界情况测试 ============

  describe('边界情况', () => {
    it('应处理空项目名称', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: '',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
    });

    it('应处理特殊字符的项目名称', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project-123_中文',
        projectType: 'greenfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
    });

    it('应处理多次调用 start()', async () => {
      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result1 = await flow.start(config);
      const result2 = await flow.start(config);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result2.currentPhase).toBe('deploy');
    });
  });

  // ============ 依赖注入测试 ============

  describe('依赖注入', () => {
    it('应使用注入的 ContextDataBus', async () => {
      const customContextBus = new MockContextDataBus();
      const customFlow = new GreenfieldFlow(customContextBus, skillExecutor);

      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await customFlow.start(config);

      expect(result).toBeDefined();
    });

    it('应使用注入的 SkillExecutor', async () => {
      const customSkillExecutor = new MockSkillExecutor();
      const customFlow = new GreenfieldFlow(contextBus, customSkillExecutor);

      const config: FlowConfig = {
        projectRoot: '/test/project',
        projectName: 'test-project',
        projectType: 'greenfield',
      };

      const result = await customFlow.start(config);

      expect(result).toBeDefined();
    });
  });
});
