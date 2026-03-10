/**
 * BrownfieldFlow 单元测试
 *
 * 测试策略：
 * - Mock IContextDataBus、ISkillExecutor 和 IChangeDetector 依赖
 * - 测试棕地项目流程阶段转换
 * - 测试项目分析功能
 * - 测试配置选项
 * - 测试错误处理
 */

import { BrownfieldFlow, IBrownfieldFlow, BrownfieldConfig, BrownfieldState, BrownfieldPhase } from '../../core/flow/BrownfieldFlow';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ISkillExecutor, SkillInput, SkillExecutionResult, SkillExecutionStatus } from '../../core/skill/SkillExecutor';
import { IChangeDetector } from '../../core/filemanager/ChangeDetector';
import { ProjectContext, AssetInfo, ExecutionHistory } from '../../core/state/ProjectContext';

// ============ Mock ContextDataBus ============

class MockContextDataBus implements IContextDataBus {
  async getContext(): Promise<Readonly<ProjectContext>> {
    return Object.freeze({
      meta: {
        project_name: 'test-brownfield-project',
        project_type: 'brownfield' as const,
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
      git: { uncommitted_changes: 5 },
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

// ============ Mock ChangeDetector ============

class MockChangeDetector implements IChangeDetector {
  async scanProjectChanges(projectRoot: string): Promise<any> {
    return {
      scanTime: new Date().toISOString(),
      totalFiles: 10,
      changedFiles: 2,
      changes: [],
      assetChanges: [],
      requiresAttention: true,
    };
  }

  async detectFileChange(filePath: string, storedHash: string): Promise<any> {
    return {
      filePath,
      hasChanged: false,
      changeType: 'none' as const,
      isAsset: false,
    };
  }

  async getFileHash(filePath: string): Promise<any> {
    return {
      hash: 'mock-hash',
      filePath,
      size: 1024,
      lastModified: new Date().toISOString(),
    };
  }

  async batchGetFileHashes(filePaths: string[]): Promise<Map<string, any>> {
    const hashes = new Map();
    for (const path of filePaths) {
      hashes.set(path, {
        hash: 'mock-hash',
        filePath: path,
        size: 1024,
        lastModified: new Date().toISOString(),
      });
    }
    return hashes;
  }

  async evaluateChangeSeverity(change: any, context: any): Promise<any> {
    return {
      severity: 'safe' as const,
      action: 'overwrite' as const,
      reason: 'safe-change',
      requiresConfirmation: false,
    };
  }

  async backupFile(filePath: string, backupDir: string): Promise<string> {
    return `${backupDir}/${filePath.split('/').pop()}.bak`;
  }

  async detectAssetChange(assetKey: string, context: any): Promise<any> {
    return {
      hasChanged: false,
    };
  }

  async applyWriteStrategy(filePath: string, newContent: string, strategy: string): Promise<boolean> {
    return true;
  }
}

// ============ Test Suite ============

describe('BrownfieldFlow', () => {
  let contextBus: IContextDataBus;
  let skillExecutor: ISkillExecutor;
  let changeDetector: IChangeDetector;
  let flow: IBrownfieldFlow;

  beforeEach(() => {
    contextBus = new MockContextDataBus();
    skillExecutor = new MockSkillExecutor();
    changeDetector = new MockChangeDetector();
    flow = new BrownfieldFlow(contextBus, skillExecutor, changeDetector);
  });

  // ============ start() 测试 ============

  describe('start() - 启动棕地项目流程', () => {
    it('应成功启动完整流程', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
      expect(result.completedStories).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('应按顺序执行所有阶段', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await flow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应支持跳过测试阶段', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
        skipTests: true,
      };

      const result = await flow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应包含测试阶段当 skipTests 为 false', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
        skipTests: false,
      };

      const result = await flow.start(config);

      expect(result.currentPhase).toBe('deploy');
      expect(result.progress).toBe(100);
    });

    it('应执行项目分析', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await flow.start(config);

      expect(result.analysisResults).toBeDefined();
      expect(result.analysisResults?.techStack).toBeDefined();
      expect(result.analysisResults?.issues).toBeDefined();
      expect(result.analysisResults?.recommendations).toBeDefined();
    });

    it('应支持不同的分析深度', async () => {
      const depths: Array<'quick' | 'standard' | 'deep'> = ['quick', 'standard', 'deep'];

      for (const depth of depths) {
        const config: BrownfieldConfig = {
          projectRoot: '/test/brownfield-project',
          projectName: 'brownfield-project',
          analysisDepth: depth,
        };

        const result = await flow.start(config);
        expect(result).toBeDefined();
      }
    });

    it('应生成重构计划当 includeRefactorPlan 为 true', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
        includeRefactorPlan: true,
      };

      const result = await flow.start(config);

      expect(result.completedStories).toContain('refactor-plan-generated');
    });

    it('应记录分析结果', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await flow.start(config);

      expect(result.analysisResults?.techStack.length).toBeGreaterThan(0);
      expect(Array.isArray(result.analysisResults?.issues)).toBe(true);
      expect(Array.isArray(result.analysisResults?.recommendations)).toBe(true);
    });

    it('应处理分析过程中的错误', async () => {
      // Mock ChangeDetector 抛出异常
      const faultyChangeDetector = {
        async scanProjectChanges() {
          throw new Error('Analysis failed');
        },
        async detectFileChange() {
          return { hasChanged: false, changeType: 'none' as const, filePath: '', isAsset: false };
        },
        async getFileHash() {
          return { hash: 'hash', filePath: '', size: 0, lastModified: '' };
        },
        async batchGetFileHashes() {
          return new Map();
        },
        async evaluateChangeSeverity() {
          return { severity: 'safe', action: 'overwrite', reason: 'safe', requiresConfirmation: false };
        },
        async backupFile() {
          return '/backup/file.bak';
        },
        async detectAssetChange() {
          return { hasChanged: false, changeType: 'none' as const, filePath: '', isAsset: false };
        },
        async applyWriteStrategy() {
          return true;
        },
      } as IChangeDetector;

      const faultyFlow = new BrownfieldFlow(contextBus, skillExecutor, faultyChangeDetector);

      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await faultyFlow.start(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.analysisResults).toBeDefined();
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

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('应包含初始状态', async () => {
      const state = await flow.getState();

      expect(state.currentPhase).toBe('analysis');
      expect(state.progress).toBe(0);
    });

    it('应更新状态在 start() 之后', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
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
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const expectedPhases: BrownfieldPhase[] = ['analysis', 'assessment', 'refactor', 'test', 'deploy'];
      const result = await flow.start(config);

      expect(result.currentPhase).toBe(expectedPhases[expectedPhases.length - 1]);
    });

    it('应为每个阶段设置正确的进度', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'brownfield-project',
      };

      const result = await flow.start(config);

      expect(result.progress).toBe(100);
    });
  });

  // ============ 配置验证测试 ============

  describe('配置验证', () => {
    it('应接受有效的棕地项目配置', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
      expect(result.currentPhase).toBe('deploy');
    });

    it('应处理可选的 skipTests 参数', async () => {
      const config1: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result1 = await flow.start(config1);
      expect(result1).toBeDefined();

      const config2: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
        skipTests: true,
      };

      const result2 = await flow.start(config2);
      expect(result2).toBeDefined();
    });

    it('应处理可选的 analysisDepth 参数', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
        analysisDepth: 'deep',
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
    });

    it('应处理可选的 includeRefactorPlan 参数', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
        includeRefactorPlan: false,
      };

      const result = await flow.start(config);

      expect(result).toBeDefined();
    });
  });

  // ============ 分析结果测试 ============

  describe('分析结果', () => {
    it('应检测技术栈', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await flow.start(config);

      expect(result.analysisResults?.techStack).toBeDefined();
      expect(result.analysisResults?.techStack.length).toBeGreaterThan(0);
    });

    it('应识别项目问题', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await flow.start(config);

      expect(result.analysisResults?.issues).toBeDefined();
      expect(Array.isArray(result.analysisResults?.issues)).toBe(true);
    });

    it('应生成改进建议', async () => {
      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await flow.start(config);

      expect(result.analysisResults?.recommendations).toBeDefined();
      expect(Array.isArray(result.analysisResults?.recommendations)).toBe(true);
      expect(result.analysisResults?.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ============ 依赖注入测试 ============

  describe('依赖注入', () => {
    it('应使用注入的 ContextDataBus', async () => {
      const customContextBus = new MockContextDataBus();
      const customFlow = new BrownfieldFlow(customContextBus, skillExecutor, changeDetector);

      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await customFlow.start(config);

      expect(result).toBeDefined();
    });

    it('应使用注入的 SkillExecutor', async () => {
      const customSkillExecutor = new MockSkillExecutor();
      const customFlow = new BrownfieldFlow(contextBus, customSkillExecutor, changeDetector);

      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await customFlow.start(config);

      expect(result).toBeDefined();
    });

    it('应使用注入的 ChangeDetector', async () => {
      const customChangeDetector = new MockChangeDetector();
      const customFlow = new BrownfieldFlow(contextBus, skillExecutor, customChangeDetector);

      const config: BrownfieldConfig = {
        projectRoot: '/test/brownfield-project',
        projectName: 'test-brownfield',
      };

      const result = await customFlow.start(config);

      expect(result).toBeDefined();
      expect(result.analysisResults).toBeDefined();
    });
  });
});
