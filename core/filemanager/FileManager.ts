/**
 * DevFlow v5 - 标准化文件写入接口
 *
 * 禁止Skill直接写文件，必须通过此接口
 * 支持4种写入策略：overwrite | preserve | merge | conflict
 */

export type WriteStrategy = 'overwrite' | 'preserve' | 'merge' | 'conflict';

export type WriteResult =
  | { status: 'success'; action: 'created' | 'overwritten' | 'merged' | 'preserved' }
  | { status: 'skipped'; reason: 'unchanged' | 'user_preserved' }
  | { status: 'conflict'; user_changes: string; generated_content: string }
  | { status: 'error'; error: string };

export interface FileChange {
  file_path: string;
  type: 'created' | 'modified' | 'deleted';
  last_modified: string;
  current_hash: string;
  stored_hash: string;
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * 文件管理器
 */
export class FileManager {
  private projectRoot: string;
  private fileHashes: Map<string, string> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * 写入文件（带策略选择）
   */
  async writeFile(
    file_path: string,
    content: string,
    strategy: WriteStrategy
  ): Promise<WriteResult> {
    const fullPath = `${this.projectRoot}/${file_path}`;
    const newHash = this.hashContent(content);

    // 检查文件是否存在
    const exists = await this.fileExists(fullPath);

    if (!exists) {
      // 新文件，直接创建
      await this.writeFileDirect(fullPath, content);
      this.fileHashes.set(file_path, newHash);
      return { status: 'success', action: 'created' };
    }

    // 文件已存在，检查内容是否有变化
    const oldHash = this.fileHashes.get(file_path);
    if (oldHash === newHash) {
      return { status: 'skipped', reason: 'unchanged' };
    }

    // 检测用户手动修改
    const userModified = await this.detectUserModification(file_path, oldHash);

    switch (strategy) {
      case 'overwrite':
        await this.writeFileDirect(fullPath, content);
        this.fileHashes.set(file_path, newHash);
        return { status: 'success', action: 'overwritten' };

      case 'preserve':
        if (userModified) {
          return { status: 'skipped', reason: 'user_preserved' };
        }
        await this.writeFileDirect(fullPath, content);
        this.fileHashes.set(file_path, newHash);
        return { status: 'success', action: 'preserved' };

      case 'merge':
        if (userModified) {
          const merged = await this.smartMerge(fullPath, content);
          await this.writeFileDirect(fullPath, merged);
          this.fileHashes.set(file_path, this.hashContent(merged));
          return { status: 'success', action: 'merged' };
        }
        await this.writeFileDirect(fullPath, content);
        this.fileHashes.set(file_path, newHash);
        return { status: 'success', action: 'merged' };

      case 'conflict':
        if (userModified) {
          const currentContent = await this.readFileDirect(fullPath);
          return {
            status: 'conflict',
            user_changes: currentContent,
            generated_content: content
          };
        }
        await this.writeFileDirect(fullPath, content);
        this.fileHashes.set(file_path, newHash);
        return { status: 'success', action: 'created' };

      default:
        return { status: 'error', error: `Unknown strategy: ${strategy}` };
    }
  }

  /**
   * 读取文件
   */
  async readFile(file_path: string): Promise<string> {
    const fullPath = `${this.projectRoot}/${file_path}`;
    return await this.readFileDirect(fullPath);
  }

  /**
   * 检测文件变更
   */
  async detectChanges(file_path: string): Promise<FileChange | null> {
    const fullPath = `${this.projectRoot}/${file_path}`;
    const exists = await this.fileExists(fullPath);

    if (!exists) {
      return null;
    }

    const storedHash = this.fileHashes.get(file_path);
    const currentContent = await this.readFileDirect(fullPath);
    const currentHash = this.hashContent(currentContent);

    if (storedHash === currentHash) {
      return null;
    }

    const stats = await this.getFileStats(fullPath);

    return {
      file_path,
      type: storedHash ? 'modified' : 'created',
      last_modified: stats.mtime,
      current_hash: currentHash,
      stored_hash: storedHash || '',
      risk_level: this.assessRisk(file_path)
    };
  }

  /**
   * 计算文件哈希
   */
  async hashFile(file_path: string): Promise<string> {
    const content = await this.readFile(file_path);
    return this.hashContent(content);
  }

  /**
   * 创建文件备份
   */
  async backupFile(file_path: string): Promise<string> {
    const fullPath = `${this.projectRoot}/${file_path}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${fullPath}.backup-${timestamp}`;

    const content = await this.readFileDirect(fullPath);
    await this.writeFileDirect(backupPath, content);

    return backupPath;
  }

  // ============ 私有方法 ============

  private async fileExists(path: string): Promise<boolean> {
    // 实际实现会使用Bash工具检查文件是否存在
    return false;
  }

  private async readFileDirect(path: string): Promise<string> {
    // 实际实现会使用Bash工具读取文件
    return '';
  }

  private async writeFileDirect(path: string, content: string): Promise<void> {
    // 实际实现会使用Bash工具写入文件
  }

  private async getFileStats(path: string): Promise<any> {
    // 实际实现会使用Bash工具获取文件状态
    return { mtime: '' };
  }

  private hashContent(content: string): string {
    // 简单哈希实现（实际应使用crypto）
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private async detectUserModification(
    file_path: string,
    storedHash: string
  ): Promise<boolean> {
    const currentHash = this.fileHashes.get(file_path);
    return currentHash !== storedHash;
  }

  private async smartMerge(
    file_path: string,
    newContent: string
  ): Promise<string> {
    // 简单实现：实际应使用更智能的合并算法
    const currentContent = await this.readFileDirect(file_path);
    // 这里应该实现智能合并逻辑
    return newContent;
  }

  private assessRisk(file_path: string): 'low' | 'medium' | 'high' {
    // 根据文件路径评估风险等级
    if (file_path.includes('_state/')) {
      return 'high';
    }
    if (file_path.includes('package.json') || file_path.includes('requirements.txt')) {
      return 'medium';
    }
    return 'low';
  }
}
