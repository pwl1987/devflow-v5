/**
 * DevFlow v5 - 统一状态管理接口
 *
 * 禁止Skill直接读写_state文件，必须通过此接口
 */

import { ProjectContext } from './ProjectContext.js';
import { Checkpoint } from '../checkpoint/Checkpoint.js';

export interface ExecutionEvent {
  timestamp: string;
  skill_id: string;
  execution_id: string;
  action: 'preCheck' | 'execute' | 'postProcess' | 'rollback';
  status: 'started' | 'completed' | 'failed';
  duration_ms?: number;
  error?: string;
  data?: any;
}

/**
 * 状态管理器
 */
export class StateManager {
  private statePath: string;
  private context: ProjectContext | null = null;

  constructor(projectRoot: string) {
    this.statePath = `${projectRoot}/_state`;
  }

  /**
   * 初始化状态管理器
   */
  async initialize(): Promise<void> {
    // 确保_state目录存在
    await this.ensureDirectories();

    // 加载或创建项目上下文
    this.context = await this.loadOrCreateContext();
  }

  /**
   * 读取项目上下文（只读视图）
   */
  async readContext(): Promise<Readonly<ProjectContext>> {
    if (!this.context) {
      throw new Error('StateManager not initialized');
    }
    return Object.freeze(this.context);
  }

  /**
   * 更新项目上下文（部分更新）
   */
  async updateContext(
    updates: Partial<ProjectContext>,
    source: string
  ): Promise<void> {
    if (!this.context) {
      throw new Error('StateManager not initialized');
    }

    // 合并更新
    this.context = this.mergeDeep(this.context, updates);

    // 更新时间戳
    this.context.meta.updated_at = new Date().toISOString();

    // 记录更新来源
    await this.logExecution({
      timestamp: new Date().toISOString(),
      skill_id: source,
      execution_id: this.generateId(),
      action: 'execute',
      status: 'completed',
      data: { updates }
    });

    // 持久化
    await this.saveContext();
  }

  /**
   * 读取特定资产
   */
  async readAsset(asset_key: string): Promise<any> {
    const assetPath = `${this.statePath}/assets/${asset_key}.json`;

    try {
      const content = await this.readFile(assetPath);
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Asset not found: ${asset_key}`);
    }
  }

  /**
   * 写入核心资产（带版本锁定）
   */
  async writeAsset(
    asset_key: string,
    content: any,
    source: string
  ): Promise<{ id: string; version: number }> {
    const assetsDir = `${this.statePath}/assets`;
    await this.ensureDir(assetsDir);

    // 检查是否已锁定
    const existingAsset = this.context?.assets[asset_key as keyof ProjectContext['assets']];
    if (existingAsset?.locked) {
      throw new Error(`Asset ${asset_key} is locked and cannot be modified`);
    }

    // 版本号递增
    const version = existingAsset ? existingAsset.version + 1 : 1;

    // 写入文件
    const assetPath = `${assetsDir}/${asset_key}.json`;
    await this.writeFile(assetPath, JSON.stringify(content, null, 2));

    // 更新上下文
    const assetInfo = {
      id: this.generateId(),
      version,
      locked: false,
      file_path: assetPath,
      created_at: new Date().toISOString(),
      created_by: source
    };

    await this.updateContext({
      assets: {
        [asset_key]: assetInfo
      }
    } as any, source);

    return { id: assetInfo.id, version };
  }

  /**
   * 锁定核心资产
   */
  async lockAsset(asset_key: string): Promise<void> {
    if (!this.context?.assets[asset_key as keyof ProjectContext['assets']]) {
      throw new Error(`Asset not found: ${asset_key}`);
    }

    const asset = this.context.assets[asset_key as keyof ProjectContext['assets']];
    asset.locked = true;

    await this.saveContext();
  }

  /**
   * 解锁核心资产
   */
  async unlockAsset(asset_key: string): Promise<void> {
    if (!this.context?.assets[asset_key as keyof ProjectContext['assets']]) {
      throw new Error(`Asset not found: ${asset_key}`);
    }

    const asset = this.context.assets[asset_key as keyof ProjectContext['assets']];
    asset.locked = false;

    await this.saveContext();
  }
    if (!this.context?.assets[asset_key as keyof ProjectContext['assets']]) {
      throw new Error(`Asset not found: ${asset_key}`);
    }

    const asset = this.context.assets[asset_key as keyof ProjectContext['assets']];
    asset.locked = true;

    await this.saveContext();
  }

  /**
   * 创建checkpoint
   */
  async createCheckpoint(
    type: 'phase' | 'story' | 'step',
    data: any
  ): Promise<string> {
    const checkpointId = this.generateId();
    const checkpointsDir = `${this.statePath}/checkpoints/${type}s`;
    await this.ensureDir(checkpointsDir);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      type,
      created_at: new Date().toISOString(),
      associated_skill: data.skill_id,
      associated_story: data.story_id,
      associated_phase: data.phase_id,
      snapshot: {
        project_context: JSON.parse(JSON.stringify(this.context)),
        file_hashes: data.file_hashes || {},
        git_commit: data.git_commit
      },
      rollback_info: {
        files_created: data.files_created || [],
        files_modified: data.files_modified || [],
        files_deleted: data.files_deleted || [],
        state_changes: data.state_changes || {}
      }
    };

    await this.writeFile(
      `${checkpointsDir}/${checkpointId}.json`,
      JSON.stringify(checkpoint, null, 2)
    );

    return checkpointId;
  }

  /**
   * 列出checkpoint
   */
  async listCheckpoints(filters?: {
    type?: string;
    story_id?: string;
    limit?: number;
  }): Promise<Checkpoint[]> {
    // 实现checkpoint列表逻辑
    return [];
  }

  /**
   * 恢复checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    // 实现checkpoint恢复逻辑
  }

  /**
   * 记录执行历史
   */
  async logExecution(event: ExecutionEvent): Promise<void> {
    const auditLog = `${this.statePath}/audit/execution.log`;
    await this.ensureDir(`${this.statePath}/audit`);

    const logEntry = JSON.stringify(event) + '\n';
    await this.appendFile(auditLog, logEntry);
  }

  /**
   * 读取执行历史
   */
  async getExecutionHistory(filters?: any): Promise<ExecutionEvent[]> {
    // 实现执行历史查询逻辑
    return [];
  }

  // ============ 私有方法 ============

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.statePath,
      `${this.statePath}/assets`,
      `${this.statePath}/checkpoints/phases`,
      `${this.statePath}/checkpoints/stories`,
      `${this.statePath}/checkpoints/steps`,
      `${this.statePath}/audit`
    ];

    for (const dir of dirs) {
      await this.ensureDir(dir);
    }
  }

  private async loadOrCreateContext(): Promise<ProjectContext> {
    const contextPath = `${this.statePath}/project-context.json`;

    try {
      const content = await this.readFile(contextPath);
      return JSON.parse(content);
    } catch {
      // 创建新的上下文
      const newContext: ProjectContext = {
        meta: {
          project_name: 'Untitled Project',
          project_type: 'greenfield',
          flow_mode: 'standard',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: '5.0.0'
        },
        status: {
          current_phase: 'idle',
          current_story: null,
          last_story: null,
          completed_stories: [],
          total_stories: 0,
          progress_percentage: 0
        },
        tech_stack: {},
        assets: {},
        git: {
          uncommitted_changes: 0
        },
        execution_history: {
          last_skill_execution: '',
          last_execution_time: '',
          execution_count: 0
        }
      };

      await this.saveContextDirect(newContext);
      return newContext;
    }
  }

  private async saveContext(): Promise<void> {
    if (!this.context) {
      throw new Error('No context to save');
    }
    await this.saveContextDirect(this.context);
  }

  private async saveContextDirect(context: ProjectContext): Promise<void> {
    const contextPath = `${this.statePath}/project-context.json`;
    await this.writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  private mergeDeep(target: any, source: any): any {
    // 深度合并实现
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ 文件操作抽象 ============

  private async readFile(path: string): Promise<string> {
    // 实际实现会使用Bash工具读取文件
    return '';
  }

  private async writeFile(path: string, content: string): Promise<void> {
    // 实际实现会使用Bash工具写入文件
  }

  private async appendFile(path: string, content: string): Promise<void> {
    // 实际实现会使用Bash工具追加文件
  }

  private async ensureDir(path: string): Promise<void> {
    // 实际实现会使用Bash工具创建目录
  }
}
