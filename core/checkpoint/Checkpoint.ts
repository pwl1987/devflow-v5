/**
 * DevFlow v5 - Checkpoint数据结构与存储规范
 */

import { ProjectContext } from '../state/ProjectContext.js';

/**
 * Checkpoint数据结构
 */
export interface Checkpoint {
  id: string;
  type: 'phase' | 'story' | 'step';
  created_at: string;

  // 关联信息
  associated_skill?: string;
  associated_story?: string;
  associated_phase?: string;

  // 快照数据
  snapshot: {
    project_context: ProjectContext;
    file_hashes: Record<string, string>;
    git_commit?: string;
  };

  // 回滚信息
  rollback_info: {
    files_created: string[];
    files_modified: string[];
    files_deleted: string[];
    state_changes: any;
  };
}

/**
 * Checkpoint管理器
 */
export class CheckpointManager {
  private statePath: string;

  constructor(projectRoot: string) {
    this.statePath = `${projectRoot}/_state`;
  }

  /**
   * 创建checkpoint
   */
  async create(
    type: 'phase' | 'story' | 'step',
    snapshot: any
  ): Promise<string> {
    const checkpointId = this.generateId();
    const checkpointsDir = `${this.statePath}/checkpoints/${type}s`;

    // 确保目录存在
    await this.ensureDir(checkpointsDir);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      type,
      created_at: new Date().toISOString(),
      associated_skill: snapshot.skill_id,
      associated_story: snapshot.story_id,
      associated_phase: snapshot.phase_id,
      snapshot: {
        project_context: snapshot.project_context,
        file_hashes: snapshot.file_hashes || {},
        git_commit: snapshot.git_commit
      },
      rollback_info: {
        files_created: snapshot.files_created || [],
        files_modified: snapshot.files_modified || [],
        files_deleted: snapshot.files_deleted || [],
        state_changes: snapshot.state_changes || {}
      }
    };

    // 保存checkpoint
    const checkpointPath = `${checkpointsDir}/${checkpointId}.json`;
    await this.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

    return checkpointId;
  }

  /**
   * 列出checkpoint
   */
  async list(filters?: {
    type?: string;
    story_id?: string;
    limit?: number;
  }): Promise<Checkpoint[]> {
    const checkpoints: Checkpoint[] = [];

    // 扫描所有checkpoint目录
    const types = ['phase', 'story', 'step'];

    for (const type of types) {
      const dir = `${this.statePath}/checkpoints/${type}s`;
      const files = await this.listFiles(dir);

      for (const file of files) {
        try {
          const content = await this.readFile(`${dir}/${file}`);
          const checkpoint: Checkpoint = JSON.parse(content);

          // 应用过滤器
          if (filters?.type && checkpoint.type !== filters.type) {
            continue;
          }
          if (filters?.story_id && checkpoint.associated_story !== filters.story_id) {
            continue;
          }

          checkpoints.push(checkpoint);

          if (filters?.limit && checkpoints.length >= filters.limit) {
            break;
          }
        } catch (error) {
          // 跳过无效的checkpoint文件
          continue;
        }
      }
    }

    // 按时间倒序排列
    checkpoints.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return checkpoints;
  }

  /**
   * 恢复checkpoint
   */
  async restore(checkpointId: string): Promise<void> {
    // 查找checkpoint
    const checkpoint = await this.findCheckpoint(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // 恢复项目上下文
    const contextPath = `${this.statePath}/project-context.json`;
    await this.writeFile(
      contextPath,
      JSON.stringify(checkpoint.snapshot.project_context, null, 2)
    );

    // 恢复文件
    for (const file of checkpoint.rollback_info.files_created) {
      await this.deleteFile(file);
    }

    // TODO: 实现更复杂的恢复逻辑
    // - 恢复修改的文件
    // - 恢复删除的文件
    // - Git reset到指定commit
  }

  /**
   * 删除checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    const checkpoint = await this.findCheckpoint(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const checkpointPath = `${this.statePath}/checkpoints/${checkpoint.type}s/${checkpointId}.json`;
    await this.deleteFile(checkpointPath);
  }

  // ============ 私有方法 ============

  private async findCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const types = ['phase', 'story', 'step'];

    for (const type of types) {
      const dir = `${this.statePath}/checkpoints/${type}s`;
      const path = `${dir}/${checkpointId}.json`;

      if (await this.fileExists(path)) {
        const content = await this.readFile(path);
        return JSON.parse(content);
      }
    }

    return null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============ 文件操作抽象 ============

  private async readFile(path: string): Promise<string> {
    // 实际实现会使用Bash工具
    return '';
  }

  private async writeFile(path: string, content: string): Promise<void> {
    // 实际实现会使用Bash工具
  }

  private async deleteFile(path: string): Promise<void> {
    // 实际实现会使用Bash工具
  }

  private async fileExists(path: string): Promise<boolean> {
    // 实际实现会使用Bash工具
    return false;
  }

  private async listFiles(dir: string): Promise<string[]> {
    // 实际实现会使用Bash工具
    return [];
  }

  private async ensureDir(path: string): Promise<void> {
    // 实际实现会使用Bash工具
  }
}
