/**
 * SkillExecutor 单元测试
 *
 * 测试策略：
 * - Mock IContextDataBus 依赖
 * - 测试 Skill 生命周期执行顺序
 * - 测试异常处理和 rollback
 * - 测试 dryRun 模式
 *
 * TDD 流程：RED → GREEN → IMPROVE
 */

import { SkillExecutor, SkillExecutionResult, SkillInput, SkillExecutionStatus, SkillMetadata, ISkillExecutor, ISkillLifecycle } from '../../core/skill/SkillExecutor';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ProjectContext } from '../../core/state/ProjectContext';

// ============ Mock ContextDataBus ============

class MockContextDataBus implements IContextDataBus {
  public executionLog: { skill: string; action: string; status: string }[] = [];

  async getContext(): Promise<ProjectContext> {
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

  async updateContext(): Promise<void> {
    // Mock implementation
  }

  async getAsset(): Promise<any> {
    return null;
  }

  async writeAsset(): Promise<any> {
    return null;
  }

  async lockAsset(): Promise<void> {
    // Mock implementation
  }

  async unlockAsset(): Promise<void> {
    // Mock implementation
  }

  async hasContext(): Promise<boolean> {
    return true;
  }

  async logExecution(skill: string, action: string, status: 'success' | 'failure'): Promise<void> {
    this.executionLog.push({ skill, action, status });
  }

  async getExecutionHistory(): Promise<any> {
    return this.executionLog;
  }

  async isAssetLocked(): Promise<boolean> {
    return false;
  }
}

// ============ Mock Skill 实现 ============

class MockSuccessSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    return { success: true, data: 'test-result' };
  }

  async preCheck(input: SkillInput): Promise<boolean> {
    return true;
  }

  async postProcess(result: any, input: SkillInput): Promise<void> {
    // Mock implementation
  }

  async rollback(input: SkillInput): Promise<boolean> {
    return true;
  }

  async dryRun(input: SkillInput): Promise<any> {
    return { dryRun: true, expectedResult: 'test-result' };
  }
}

class MockFailureSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    throw new Error('Skill execution failed');
  }

  async rollback(input: SkillInput): Promise<boolean> {
    return true;
  }
}

class MockRollbackFailureSkill implements ISkillLifecycle {
  async execute(input: SkillInput): Promise<any> {
    throw new Error('Skill execution failed');
  }

  async rollback(input: SkillInput): Promise<boolean> {
    throw new Error('Rollback failed');
  }
}

class MockPreCheckFailSkill implements ISkillLifecycle {
  async preCheck(input: SkillInput): Promise<boolean> {
    return false;
  }

  async execute(input: SkillInput): Promise<any> {
    return { success: true };
  }
}

// ============ Test Suite ============

describe('SkillExecutor', () => {
  let contextBus: MockContextDataBus;
  let skillExecutor: ISkillExecutor;
  let skillRegistry: Map<string, ISkillLifecycle>;

  beforeEach(() => {
    contextBus = new MockContextDataBus();
    skillRegistry = new Map();
    skillExecutor = new SkillExecutor(contextBus, skillRegistry);
  });

  // ============ execute() 测试 ============

  describe('execute() - 执行 Skill', () => {
    it('应成功执行 Skill', async () => {
      const skill = new MockSuccessSkill();
      skillRegistry.set('test-skill', skill);

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test-action',
        params: { key: 'value' },
      };

      const result = await skillExecutor.execute(input);

      expect(result).toBeDefined();
      expect(result.skillId).toBe('test-skill');
      expect(result.status).toBe('success');
      expect(result.output).toEqual({ success: true, data: 'test-result' });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应按顺序调用生命周期方法：preCheck → execute → postProcess', async () => {
      const callOrder: string[] = [];

      class OrderedSkill implements ISkillLifecycle {
        async preCheck(input: SkillInput): Promise<boolean> {
          callOrder.push('preCheck');
          return true;
        }

        async execute(input: SkillInput): Promise<any> {
          callOrder.push('execute');
          return { success: true };
        }

        async postProcess(result: any, input: SkillInput): Promise<void> {
          callOrder.push('postProcess');
        }
      }

      skillRegistry.set('ordered-skill', new OrderedSkill());

      const input: SkillInput = {
        skillId: 'ordered-skill',
        action: 'test',
        params: {},
      };

      await skillExecutor.execute(input);

      expect(callOrder).toEqual(['preCheck', 'execute', 'postProcess']);
    });

    it('应处理 preCheck 失败的情况', async () => {
      skillRegistry.set('precheck-fail', new MockPreCheckFailSkill());

      const input: SkillInput = {
        skillId: 'precheck-fail',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('应处理 execute 失败的情况', async () => {
      skillRegistry.set('failure-skill', new MockFailureSkill());

      const input: SkillInput = {
        skillId: 'failure-skill',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Skill execution failed');
      expect(result.rollbackAttempted).toBe(true);
      expect(result.rollbackSuccess).toBe(true);
    });

    it('应处理 rollback 失败的情况', async () => {
      skillRegistry.set('rollback-fail', new MockRollbackFailureSkill());

      const input: SkillInput = {
        skillId: 'rollback-fail',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      expect(result.status).toBe('failed');
      expect(result.rollbackAttempted).toBe(true);
      expect(result.rollbackSuccess).toBe(false);
    });

    it('应记录执行日志到 ContextDataBus', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test-action',
        params: {},
      };

      await skillExecutor.execute(input);

      expect(contextBus.executionLog).toHaveLength(1);
      expect(contextBus.executionLog[0]).toEqual({
        skill: 'test-skill',
        action: 'test-action',
        status: 'success',
      });
    });

    it('应处理不存在的 Skill', async () => {
      const input: SkillInput = {
        skillId: 'nonexistent',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.execute(input);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('not found');
    });
  });

  // ============ preCheck() 测试 ============

  describe('preCheck() - 前置检查', () => {
    it('应返回 true 当 Skill preCheck 通过', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.preCheck(input);
      expect(result).toBe(true);
    });

    it('应返回 false 当 Skill preCheck 失败', async () => {
      skillRegistry.set('precheck-fail', new MockPreCheckFailSkill());

      const input: SkillInput = {
        skillId: 'precheck-fail',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.preCheck(input);
      expect(result).toBe(false);
    });

    it('应返回 true 当 Skill 没有 preCheck 方法', async () => {
      class SkillWithoutPreCheck implements ISkillLifecycle {
        async execute(input: SkillInput): Promise<any> {
          return { success: true };
        }
      }

      skillRegistry.set('no-precheck', new SkillWithoutPreCheck());

      const input: SkillInput = {
        skillId: 'no-precheck',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.preCheck(input);
      expect(result).toBe(true);
    });
  });

  // ============ postProcess() 测试 ============

  describe('postProcess() - 后处理', () => {
    it('应执行 Skill 的 postProcess 方法', async () => {
      let postProcessCalled = false;

      class SkillWithPostProcess implements ISkillLifecycle {
        async execute(input: SkillInput): Promise<any> {
          return { success: true };
        }

        async postProcess(result: any, input: SkillInput): Promise<void> {
          postProcessCalled = true;
        }
      }

      skillRegistry.set('postprocess-skill', new SkillWithPostProcess());

      const result: SkillExecutionResult = {
        skillId: 'postprocess-skill',
        status: 'success',
        startTime: new Date().toISOString(),
      };

      await skillExecutor.postProcess(result, await contextBus.getContext());

      expect(postProcessCalled).toBe(true);
    });
  });

  // ============ rollback() 测试 ============

  describe('rollback() - 回滚操作', () => {
    it('应成功执行 rollback', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const success = await skillExecutor.rollback('test-skill');
      expect(success).toBe(true);
    });

    it('应处理 rollback 失败', async () => {
      skillRegistry.set('rollback-fail', new MockRollbackFailureSkill());

      const success = await skillExecutor.rollback('rollback-fail');
      expect(success).toBe(false);
    });

    it('应返回 true 当 Skill 没有 rollback 方法', async () => {
      class SkillWithoutRollback implements ISkillLifecycle {
        async execute(input: SkillInput): Promise<any> {
          return { success: true };
        }
      }

      skillRegistry.set('no-rollback', new SkillWithoutRollback());

      const success = await skillExecutor.rollback('no-rollback');
      expect(success).toBe(true);
    });
  });

  // ============ dryRun() 测试 ============

  describe('dryRun() - Dry Run 模式', () => {
    it('应返回预期执行结果', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test',
        params: {},
      };

      const result = await skillExecutor.dryRun(input);

      expect(result.status).toBe('success');
      expect(result.output).toEqual({ dryRun: true, expectedResult: 'test-result' });
    });

    it('应不记录执行日志', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test',
        params: {},
      };

      await skillExecutor.dryRun(input);

      expect(contextBus.executionLog).toHaveLength(0);
    });
  });

  // ============ getSkillMetadata() 测试 ============

  describe('getSkillMetadata() - 获取 Skill 元数据', () => {
    it('应返回 Skill 元数据', async () => {
      class SkillWithMetadata implements ISkillLifecycle {
        static metadata: SkillMetadata = {
          id: 'metadata-skill',
          name: 'Metadata Test Skill',
          version: '1.0.0',
          description: 'A test skill with metadata',
        };

        async execute(input: SkillInput): Promise<any> {
          return { success: true };
        }
      }

      skillRegistry.set('metadata-skill', new SkillWithMetadata());

      const metadata = await skillExecutor.getSkillMetadata('metadata-skill');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('metadata-skill');
      expect(metadata?.name).toBe('Metadata Test Skill');
    });

    it('应返回 null 当 Skill 不存在', async () => {
      const metadata = await skillExecutor.getSkillMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
  });

  // ============ getExecutionHistory() 测试 ============

  describe('getExecutionHistory() - 获取执行历史', () => {
    it('应返回所有执行历史', async () => {
      skillRegistry.set('test-skill', new MockSuccessSkill());

      const input: SkillInput = {
        skillId: 'test-skill',
        action: 'test',
        params: {},
      };

      await skillExecutor.execute(input);
      const history = await skillExecutor.getExecutionHistory();

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('应返回指定 Skill 的执行历史', async () => {
      skillRegistry.set('skill-a', new MockSuccessSkill());
      skillRegistry.set('skill-b', new MockSuccessSkill());

      await skillExecutor.execute({
        skillId: 'skill-a',
        action: 'action1',
        params: {},
      });

      await skillExecutor.execute({
        skillId: 'skill-b',
        action: 'action2',
        params: {},
      });

      const history = await skillExecutor.getExecutionHistory('skill-a');

      expect(history).toBeDefined();
      expect(history.every(h => h.skillId === 'skill-a')).toBe(true);
    });
  });
});
