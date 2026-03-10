/**
 * DevFlow v5 - 变更检测器
 *
 * 职责：检测用户手动修改，文件哈希对比，分级处理策略
 *
 * 架构原则：
 * - 单向依赖：只读 ContextDataBus 和 FileManager
 * - 哈希检测：基于文件内容哈希检测变更
 * - 分级处理：安全/警告/危险三级处理策略
 * - 备份机制：自动备份被修改的资产文件
 */

import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ProjectContext, AssetInfo } from '../state/ProjectContext';

// ============ 文件哈希信息 ============
export interface FileHashInfo {
  filePath: string;
  hash: string;        // SHA-256 哈希值
  size: number;        // 文件大小（字节）
  lastModified: string; // ISO 8601 时间戳
}

// ============ 变更检测结果 ============
export interface ChangeDetectionResult {
  filePath: string;
  hasChanged: boolean;
  changeType: 'none' | 'modified' | 'deleted' | 'created';
  oldHash?: string;
  newHash?: string;
  isAsset: boolean;  // 是否是核心资产文件
  assetKey?: string;
}

// ============ 变更分级 ============
export type ChangeSeverity = 'safe' | 'warning' | 'danger';

// ============ 变更处理建议 ============
export interface ChangeHandlingAction {
  severity: ChangeSeverity;
  action: 'preserve' | 'merge' | 'overwrite' | 'conflict' | 'backup';
  reason: string;
  requiresConfirmation: boolean;
}

// ============ 批量变更报告 ============
export interface ChangeReport {
  scanTime: string;
  totalFiles: number;
  changedFiles: number;
  changes: ChangeDetectionResult[];
  assetChanges: ChangeDetectionResult[];
  requiresAttention: boolean;  // 是否有需要用户确认的变更
}

// ============ 文件写入策略（与 FileManager 对齐）============
export type WriteStrategy = 'overwrite' | 'preserve' | 'merge' | 'conflict';

// ============ 变更检测器接口 ============

/**
 * 变更检测器接口
 */
export interface IChangeDetector {
  /**
   * 检测指定文件是否变更
   * @param filePath - 文件路径
   * @param storedHash - 存储的哈希值
   * @returns 变更检测结果
   */
  detectFileChange(filePath: string, storedHash: string): Promise<ChangeDetectionResult>;

  /**
   * 扫描项目所有文件变更
   * @param projectRoot - 项目根目录
   * @returns 变更报告
   */
  scanProjectChanges(projectRoot: string): Promise<ChangeReport>;

  /**
   * 获取文件哈希
   * @param filePath - 文件路径
   * @returns 文件哈希信息
   */
  getFileHash(filePath: string): Promise<FileHashInfo>;

  /**
   * 批量获取文件哈希
   * @param filePaths - 文件路径数组
   * @returns 文件哈希信息映射
   */
  batchGetFileHashes(filePaths: string[]): Promise<Map<string, FileHashInfo>>;

  /**
   * 评估变更严重程度
   * @param change - 变更检测结果
   * @param context - 项目上下文
   * @returns 处理建议
   */
  evaluateChangeSeverity(
    change: ChangeDetectionResult,
    context: ProjectContext
  ): Promise<ChangeHandlingAction>;

  /**
   * 备份文件
   * @param filePath - 文件路径
   * @param backupDir - 备份目录
   * @returns 备份文件路径
   */
  backupFile(filePath: string, backupDir: string): Promise<string>;

  /**
   * 检测资产文件变更
   * @param assetKey - 资产键
   * @param context - 项目上下文
   * @returns 变更检测结果
   */
  detectAssetChange(assetKey: string, context: ProjectContext): Promise<ChangeDetectionResult | null>;

  /**
   * 应用写入策略
   * @param filePath - 目标文件路径
   * @param newContent - 新内容
   * @param strategy - 写入策略
   * @returns 是否写入成功
   */
  applyWriteStrategy(
    filePath: string,
    newContent: string,
    strategy: WriteStrategy
  ): Promise<boolean>;
}

// ============ ChangeDetector 实现类 ============

/**
 * 变更检测器实现
 *
 * 设计模式：
 * - 单向依赖：只读 ContextDataBus
 * - 哈希缓存：减少重复计算
 * - 分级处理：根据变更类型和资产重要性决定处理方式
 */
export class ChangeDetector implements IChangeDetector {
  private contextBus: IContextDataBus;
  private hashCache: Map<string, FileHashInfo> = new Map();

  constructor(contextBus: IContextDataBus) {
    this.contextBus = contextBus;
  }

  async detectFileChange(filePath: string, storedHash: string): Promise<ChangeDetectionResult> {
    // 检查文件是否存在
    const exists = await this.fileExists(filePath);

    if (!exists) {
      return {
        filePath,
        hasChanged: true,
        changeType: 'deleted',
        oldHash: storedHash,
        isAsset: false,
      };
    }

    // 计算当前哈希
    const currentHash = await this.getFileHash(filePath);

    if (currentHash.hash !== storedHash) {
      return {
        filePath,
        hasChanged: true,
        changeType: 'modified',
        oldHash: storedHash,
        newHash: currentHash.hash,
        isAsset: false,
      };
    }

    return {
      filePath,
      hasChanged: false,
      changeType: 'none',
      oldHash: storedHash,
      newHash: currentHash.hash,
      isAsset: false,
    };
  }

  async scanProjectChanges(projectRoot: string): Promise<ChangeReport> {
    const changes: ChangeDetectionResult[] = [];
    const assetChanges: ChangeDetectionResult[] = [];
    let totalFiles = 0;

    try {
      // 获取项目上下文
      const context = await this.contextBus.getContext();

      // 扫描核心资产文件
      for (const [assetKey, asset] of Object.entries(context.assets)) {
        if (!asset || !asset.file_path) continue;

        totalFiles++;
        const result = await this.detectAssetChange(assetKey, context);
        if (result && result.hasChanged) {
          changes.push(result);
          assetChanges.push(result);
        }
      }

      // TODO: 阶段2 - 扫描其他已跟踪的文件
      // 这里可以添加更多文件的扫描逻辑
    } catch (error) {
      // 如果上下文不可用，返回空报告
      // 这是合理的行为，因为项目可能尚未初始化
    }

    // 检查是否有需要用户确认的变更
    const requiresAttention = assetChanges.length > 0;

    return {
      scanTime: new Date().toISOString(),
      totalFiles,
      changedFiles: changes.length,
      changes,
      assetChanges,
      requiresAttention,
    };
  }

  async getFileHash(filePath: string): Promise<FileHashInfo> {
    // 检查缓存
    if (this.hashCache.has(filePath)) {
      const cached = this.hashCache.get(filePath)!;
      // 验证缓存是否过期（通过文件修改时间）
      const stats = await this.getFileStats(filePath);
      if (stats.lastModified === cached.lastModified) {
        return cached;
      }
    }

    // 计算文件哈希
    const hash = await this.calculateFileSHA256(filePath);
    const stats = await this.getFileStats(filePath);

    const hashInfo: FileHashInfo = {
      filePath,
      hash,
      size: stats.size,
      lastModified: stats.lastModified,
    };

    // 更新缓存
    this.hashCache.set(filePath, hashInfo);

    return hashInfo;
  }

  async batchGetFileHashes(filePaths: string[]): Promise<Map<string, FileHashInfo>> {
    const results = new Map<string, FileHashInfo>();

    // 并行计算哈希
    await Promise.all(
      filePaths.map(async (path) => {
        try {
          const hash = await this.getFileHash(path);
          results.set(path, hash);
        } catch {
          // 忽略无法访问的文件
        }
      })
    );

    return results;
  }

  async evaluateChangeSeverity(
    change: ChangeDetectionResult,
    context: ProjectContext
  ): Promise<ChangeHandlingAction> {
    // 核心资产变更 → 危险级别
    if (change.isAsset && change.assetKey) {
      const asset = context.assets[change.assetKey as keyof typeof context.assets];
      if (asset?.locked) {
        return {
          severity: 'danger',
          action: 'conflict',
          reason: `核心资产 ${change.assetKey} 已锁定，禁止修改`,
          requiresConfirmation: true,
        };
      }

      return {
        severity: 'warning',
        action: 'preserve',
        reason: `核心资产 ${change.assetKey} 被手动修改，建议保留`,
        requiresConfirmation: true,
      };
    }

    // 普通文件变更 → 安全级别
    return {
      severity: 'safe',
      action: 'overwrite',
      reason: '普通文件变更，可以安全覆盖',
      requiresConfirmation: false,
    };
  }

  async backupFile(filePath: string, backupDir: string): Promise<string> {
    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true });

    // 读取源文件内容
    const content = await fs.readFile(filePath, 'utf-8');

    // 生成备份文件名：原文件名.时间戳.扩展名.bak
    const timestamp = Date.now();
    const parsedPath = filePath.split('/');
    const originalFileName = parsedPath[parsedPath.length - 1];
    const nameParts = originalFileName.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop() : '';
    const baseName = nameParts.join('.');

    const backupFileName = `${baseName}.${ext}.${timestamp}.${Math.random().toString(36).substring(7)}.bak`;
    const backupPath = `${backupDir}/${backupFileName}`;

    // 写入备份文件
    await fs.writeFile(backupPath, content, 'utf-8');

    return backupPath;
  }

  async detectAssetChange(assetKey: string, context: ProjectContext): Promise<ChangeDetectionResult | null> {
    const asset = context.assets[assetKey as keyof typeof context.assets];
    if (!asset || !asset.file_path) {
      return null;
    }

    return this.detectFileChange(asset.file_path, asset.id);
  }

  async applyWriteStrategy(
    filePath: string,
    newContent: string,
    strategy: WriteStrategy
  ): Promise<boolean> {
    switch (strategy) {
      case 'overwrite':
        // 直接覆盖
        return this.writeFile(filePath, newContent);

      case 'preserve':
        // 保留现有文件，不写入
        return false;

      case 'merge':
        // 智能合并（TODO: 阶段2实现）
        throw new Error('Merge strategy not implemented yet');

      case 'conflict':
        // 标记冲突，不自动写入
        throw new Error(`Conflict detected for ${filePath}, requires manual resolution`);

      default:
        throw new Error(`Unknown write strategy: ${strategy}`);
    }
  }

  /**
   * 检查文件是否存在
   * @internal
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件统计信息
   * @internal
   */
  private async getFileStats(filePath: string): Promise<{ size: number; lastModified: string }> {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  }

  /**
   * 计算 SHA-256 哈希值
   * @internal
   */
  private async calculateFileSHA256(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 写入文件
   * @internal
   */
  private async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清除哈希缓存
   * @internal
   */
  clearCache(): void {
    this.hashCache.clear();
  }
}

// ============ 核心资产路径映射（用于识别资产文件）============

/**
 * 核心资产键到文件路径的映射
 */
export const ASSET_FILE_PATTERNS: Record<string, RegExp[]> = {
  prd: [
    /_bmad-output\/planning-artifacts\/.*prd.*\.md$/i,
    /docs\/prd.*\.md$/i,
  ],
  architecture: [
    /_bmad-output\/planning-artifacts\/.*architecture.*\.md$/i,
    /docs\/architecture.*\.md$/i,
  ],
  ux_design: [
    /_bmad-output\/planning-artifacts\/.*ux.*\.md$/i,
    /docs\/ux.*\.md$/i,
  ],
  stories: [
    /_bmad-output\/planning-artifacts\/.*stories.*\.md$/i,
    /_bmad-output\/story-files\/.*\.md$/i,
  ],
  product_brief: [
    /_bmad-output\/planning-artifacts\/.*brief.*\.md$/i,
    /docs\/brief.*\.md$/i,
  ],
};

/**
 * 判断文件是否是核心资产
 */
export function isAssetFile(filePath: string): { isAsset: boolean; assetKey?: string } {
  for (const [key, patterns] of Object.entries(ASSET_FILE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filePath)) {
        return { isAsset: true, assetKey: key };
      }
    }
  }
  return { isAsset: false };
}
