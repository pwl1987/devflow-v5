/**
 * ChangeDetector 测试用例
 * 覆盖：文件变更检测、哈希计算、变更分级、资产文件检测
 */
import { ChangeDetector, ChangeDetectionResult, FileHashInfo, isAssetFile } from '../../core/filemanager/ChangeDetector';
import { IContextDataBus } from '../../lib/bus/ContextDataBus';
import { ProjectContext } from '../../core/state/ProjectContext';

// ============ Mock ContextDataBus ============

class MockContextDataBus implements IContextDataBus {
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
      assets: {
        prd: {
          id: 'prd-hash-123',
          version: 1,
          locked: false,
          file_path: '_bmad-output/planning-artifacts/prd.md',
          created_at: now,
          created_by: 'test',
        },
      },
      git: { uncommitted_changes: 0 },
      execution_history: {
        last_skill_execution: '',
        last_execution_time: '',
        execution_count: 0,
      },
    };
  }

  async updateContext(): Promise<void> {
    throw new Error('Method not implemented');
  }

  async getAsset(assetKey: string): Promise<any> {
    throw new Error('Method not implemented');
  }

  async writeAsset(assetKey: string, content: any, source: string): Promise<any> {
    throw new Error('Method not implemented');
  }

  async lockAsset(assetKey: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async unlockAsset(assetKey: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async hasContext(): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  async logExecution(skillName: string, storyId: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async getExecutionHistory(): Promise<any> {
    throw new Error('Method not implemented');
  }

  async isAssetLocked(assetKey: string): Promise<boolean> {
    throw new Error('Method not implemented');
  }
}

// ============ 测试数据生成 ============

function createTestProjectContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
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
    assets: {
      prd: {
        id: 'old-prd-hash',
        version: 1,
        file_path: '_bmad-output/planning-artifacts/prd.md',
        locked: false,
        created_at: now,
        created_by: 'test',
      },
      architecture: {
        id: 'old-arch-hash',
        version: 1,
        file_path: '_bmad-output/planning-artifacts/architecture.md',
        locked: true,
        created_at: now,
        created_by: 'test',
      },
    },
    git: { uncommitted_changes: 0 },
    execution_history: {
      last_skill_execution: '',
      last_execution_time: '',
      execution_count: 0,
    },
    ...overrides,
  };
}

// ============ 测试用例 ============

describe('ChangeDetector', () => {
  let mockContextBus: MockContextDataBus;
  let changeDetector: ChangeDetector;

  beforeEach(() => {
    mockContextBus = new MockContextDataBus();
    changeDetector = new ChangeDetector(mockContextBus);
  });

  describe('文件变更检测', () => {
    test('检测文件未变更 - 哈希相同', async () => {
      // Mock fileExists 和 getFileHash
      jest.spyOn(changeDetector as any, 'fileExists').mockResolvedValue(true);
      jest.spyOn(changeDetector as any, 'getFileHash').mockResolvedValue({
        filePath: 'test.md',
        hash: 'same-hash-123',
        size: 100,
        lastModified: new Date().toISOString(),
      });

      const result = await changeDetector.detectFileChange('test.md', 'same-hash-123');

      expect(result.hasChanged).toBe(false);
      expect(result.changeType).toBe('none');
      expect(result.filePath).toBe('test.md');
    });

    test('检测文件已修改 - 哈希不同', async () => {
      jest.spyOn(changeDetector as any, 'fileExists').mockResolvedValue(true);
      jest.spyOn(changeDetector as any, 'getFileHash').mockResolvedValue({
        filePath: 'test.md',
        hash: 'new-hash-456',
        size: 200,
        lastModified: new Date().toISOString(),
      });

      const result = await changeDetector.detectFileChange('test.md', 'old-hash-123');

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('modified');
      expect(result.oldHash).toBe('old-hash-123');
      expect(result.newHash).toBe('new-hash-456');
    });

    test('检测文件已删除', async () => {
      jest.spyOn(changeDetector as any, 'fileExists').mockResolvedValue(false);

      const result = await changeDetector.detectFileChange('deleted.md', 'old-hash-123');

      expect(result.hasChanged).toBe(true);
      expect(result.changeType).toBe('deleted');
      expect(result.oldHash).toBe('old-hash-123');
    });
  });

  describe('哈希计算与缓存', () => {
    test('首次计算哈希 - 调用底层方法', async () => {
      const mockHash: FileHashInfo = {
        filePath: 'test.md',
        hash: 'computed-hash',
        size: 150,
        lastModified: '2024-01-01T00:00:00.000Z',
      };

      jest.spyOn(changeDetector as any, 'calculateFileSHA256').mockResolvedValue(mockHash.hash);
      jest.spyOn(changeDetector as any, 'getFileStats').mockResolvedValue({
        size: mockHash.size,
        lastModified: mockHash.lastModified,
      });

      const result = await changeDetector.getFileHash('test.md');

      expect(result.hash).toBe('computed-hash');
      expect(result.size).toBe(150);
    });

    test('缓存命中 - 返回缓存结果', async () => {
      const mockHash: FileHashInfo = {
        filePath: 'test.md',
        hash: 'cached-hash',
        size: 150,
        lastModified: '2024-01-01T00:00:00.000Z',
      };

      // 第一次调用
      jest.spyOn(changeDetector as any, 'calculateFileSHA256').mockResolvedValue(mockHash.hash);
      jest.spyOn(changeDetector as any, 'getFileStats').mockResolvedValue({
        size: mockHash.size,
        lastModified: mockHash.lastModified,
      });

      await changeDetector.getFileHash('test.md');

      // 第二次调用应该使用缓存
      const result = await changeDetector.getFileHash('test.md');

      expect(result.hash).toBe('cached-hash');
    });

    test('清除缓存 - 重新计算哈希', async () => {
      const mockHash1: FileHashInfo = {
        filePath: 'test.md',
        hash: 'hash-v1',
        size: 150,
        lastModified: '2024-01-01T00:00:00.000Z',
      };

      const mockHash2: FileHashInfo = {
        filePath: 'test.md',
        hash: 'hash-v2',
        size: 200,
        lastModified: '2024-01-01T01:00:00.000Z',
      };

      jest.spyOn(changeDetector as any, 'calculateFileSHA256')
        .mockResolvedValueOnce(mockHash1.hash)
        .mockResolvedValueOnce(mockHash2.hash);

      jest.spyOn(changeDetector as any, 'getFileStats')
        .mockResolvedValueOnce({
          size: mockHash1.size,
          lastModified: mockHash1.lastModified,
        })
        .mockResolvedValueOnce({
          size: mockHash2.size,
          lastModified: mockHash2.lastModified,
        });

      const result1 = await changeDetector.getFileHash('test.md');
      expect(result1.hash).toBe('hash-v1');

      // 清除缓存
      changeDetector.clearCache();

      const result2 = await changeDetector.getFileHash('test.md');
      expect(result2.hash).toBe('hash-v2');
    });
  });

  describe('批量哈希计算', () => {
    test('批量获取文件哈希 - 并行计算', async () => {
      jest.spyOn(changeDetector, 'getFileHash')
        .mockResolvedValueOnce({
          filePath: 'file1.md',
          hash: 'hash1',
          size: 100,
          lastModified: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          filePath: 'file2.md',
          hash: 'hash2',
          size: 200,
          lastModified: new Date().toISOString(),
        });

      const results = await changeDetector.batchGetFileHashes(['file1.md', 'file2.md']);

      expect(results.size).toBe(2);
      expect(results.get('file1.md')?.hash).toBe('hash1');
      expect(results.get('file2.md')?.hash).toBe('hash2');
    });

    test('部分文件无法访问 - 继续处理其他文件', async () => {
      jest.spyOn(changeDetector, 'getFileHash')
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({
          filePath: 'file2.md',
          hash: 'hash2',
          size: 200,
          lastModified: new Date().toISOString(),
        });

      const results = await changeDetector.batchGetFileHashes(['file1.md', 'file2.md']);

      expect(results.size).toBe(1);
      expect(results.get('file2.md')?.hash).toBe('hash2');
    });
  });

  describe('变更严重程度评估', () => {
    test('普通文件变更 - 安全级别', async () => {
      const change: ChangeDetectionResult = {
        filePath: 'src/utils/helper.ts',
        hasChanged: true,
        changeType: 'modified',
        oldHash: 'old-hash',
        newHash: 'new-hash',
        isAsset: false,
      };

      const context = createTestProjectContext();
      const action = await changeDetector.evaluateChangeSeverity(change, context);

      expect(action.severity).toBe('safe');
      expect(action.action).toBe('overwrite');
      expect(action.requiresConfirmation).toBe(false);
    });

    test('核心资产变更（未锁定）- 警告级别', async () => {
      const change: ChangeDetectionResult = {
        filePath: '_bmad-output/planning-artifacts/prd.md',
        hasChanged: true,
        changeType: 'modified',
        oldHash: 'old-prd-hash',
        newHash: 'new-prd-hash',
        isAsset: true,
        assetKey: 'prd',
      };

      const context = createTestProjectContext();
      const action = await changeDetector.evaluateChangeSeverity(change, context);

      expect(action.severity).toBe('warning');
      expect(action.action).toBe('preserve');
      expect(action.requiresConfirmation).toBe(true);
    });

    test('核心资产变更（已锁定）- 危险级别', async () => {
      const change: ChangeDetectionResult = {
        filePath: '_bmad-output/planning-artifacts/architecture.md',
        hasChanged: true,
        changeType: 'modified',
        oldHash: 'old-arch-hash',
        newHash: 'new-arch-hash',
        isAsset: true,
        assetKey: 'architecture',
      };

      const context = createTestProjectContext();
      const action = await changeDetector.evaluateChangeSeverity(change, context);

      expect(action.severity).toBe('danger');
      expect(action.action).toBe('conflict');
      expect(action.requiresConfirmation).toBe(true);
      expect(action.reason).toContain('已锁定');
    });
  });

  describe('资产文件检测', () => {
    test('识别 PRD 文件', () => {
      const result = isAssetFile('_bmad-output/planning-artifacts/prd.md');
      expect(result.isAsset).toBe(true);
      expect(result.assetKey).toBe('prd');
    });

    test('识别架构文档', () => {
      const result = isAssetFile('_bmad-output/planning-artifacts/architecture-design.md');
      expect(result.isAsset).toBe(true);
      expect(result.assetKey).toBe('architecture');
    });

    test('识别 UX 设计文档', () => {
      const result = isAssetFile('_bmad-output/planning-artifacts/ux-wireframes.md');
      expect(result.isAsset).toBe(true);
      expect(result.assetKey).toBe('ux_design');
    });

    test('识别故事文件', () => {
      const result = isAssetFile('_bmad-output/story-files/E001-S001.md');
      expect(result.isAsset).toBe(true);
      expect(result.assetKey).toBe('stories');
    });

    test('普通文件 - 非资产', () => {
      const result = isAssetFile('src/components/Button.tsx');
      expect(result.isAsset).toBe(false);
    });
  });

  describe('写入策略应用', () => {
    test('overwrite 策略 - 直接覆盖', async () => {
      jest.spyOn(changeDetector as any, 'writeFile').mockResolvedValue(true);

      const result = await changeDetector.applyWriteStrategy('test.md', 'new content', 'overwrite');

      expect(result).toBe(true);
    });

    test('preserve 策略 - 不写入', async () => {
      const result = await changeDetector.applyWriteStrategy('test.md', 'new content', 'preserve');

      expect(result).toBe(false);
    });

    test('merge 策略 - 抛出未实现错误', async () => {
      await expect(
        changeDetector.applyWriteStrategy('test.md', 'new content', 'merge')
      ).rejects.toThrow('not implemented');
    });

    test('conflict 策略 - 抛出冲突错误', async () => {
      await expect(
        changeDetector.applyWriteStrategy('test.md', 'new content', 'conflict')
      ).rejects.toThrow('Conflict detected');
    });
  });

  describe('资产文件变更检测', () => {
    test('检测存在的资产变更', async () => {
      jest.spyOn(changeDetector, 'detectFileChange').mockResolvedValue({
        filePath: '_bmad-output/planning-artifacts/prd.md',
        hasChanged: true,
        changeType: 'modified',
        oldHash: 'old-prd-hash',
        newHash: 'new-prd-hash',
        isAsset: true,
        assetKey: 'prd',
      });

      const context = createTestProjectContext();
      const result = await changeDetector.detectAssetChange('prd', context);

      expect(result).not.toBeNull();
      expect(result?.hasChanged).toBe(true);
      expect(result?.assetKey).toBe('prd');
    });

    test('检测不存在的资产 - 返回 null', async () => {
      const context = createTestProjectContext();
      const result = await changeDetector.detectAssetChange('nonexistent', context);

      expect(result).toBeNull();
    });
  });

  // ============ scanProjectChanges 测试 ============

  describe('scanProjectChanges - 扫描项目变更', () => {
    test('应扫描项目文件并返回变更报告', async () => {
      const mockContext = createTestProjectContext({
        assets: {
          prd: {
            id: 'prd-hash-123',
            version: 1,
            locked: false,
            file_path: '_bmad-output/planning-artifacts/prd.md',
            created_at: new Date().toISOString(),
            created_by: 'test',
          },
        },
      });

      // Mock detectFileChange 方法
      jest.spyOn(changeDetector, 'detectFileChange')
        .mockResolvedValueOnce({
          filePath: '_bmad-output/planning-artifacts/prd.md',
          hasChanged: true,
          changeType: 'modified',
          oldHash: 'prd-hash-123',
          newHash: 'new-prd-hash',
          isAsset: true,
          assetKey: 'prd',
        })
        .mockResolvedValueOnce({
          filePath: 'src/index.ts',
          hasChanged: true,
          changeType: 'modified',
          oldHash: 'old-hash',
          newHash: 'new-hash',
          isAsset: false,
        })
        .mockResolvedValueOnce({
          filePath: 'README.md',
          hasChanged: false,
          changeType: 'none',
          oldHash: 'readme-hash',
          newHash: 'readme-hash',
          isAsset: false,
        });

      // Mock contextBus.getContext
      jest.spyOn(mockContextBus, 'getContext').mockResolvedValue(mockContext);

      const report = await changeDetector.scanProjectChanges('/test/project');

      expect(report).toBeDefined();
      expect(report.scanTime).toBeDefined();
      expect(report.totalFiles).toBeGreaterThan(0);
      expect(report.changes.length).toBeGreaterThan(0);
    });

    test('应识别核心资产变更', async () => {
      const mockContext = createTestProjectContext({
        assets: {
          prd: {
            id: 'prd-hash-123',
            version: 1,
            locked: false,
            file_path: '_bmad-output/planning-artifacts/prd.md',
            created_at: new Date().toISOString(),
            created_by: 'test',
          },
        },
      });

      jest.spyOn(changeDetector, 'detectFileChange').mockResolvedValue({
        filePath: '_bmad-output/planning-artifacts/prd.md',
        hasChanged: true,
        changeType: 'modified',
        oldHash: 'prd-hash-123',
        newHash: 'new-prd-hash',
        isAsset: true,
        assetKey: 'prd',
      });

      jest.spyOn(mockContextBus, 'getContext').mockResolvedValue(mockContext);

      const report = await changeDetector.scanProjectChanges('/test/project');

      expect(report.assetChanges).toHaveLength(1);
      expect(report.assetChanges[0].assetKey).toBe('prd');
      expect(report.requiresAttention).toBe(true);
    });

    test('无变更时应返回空变更列表', async () => {
      const mockContext = createTestProjectContext();

      jest.spyOn(changeDetector, 'detectFileChange').mockResolvedValue({
        filePath: 'src/index.ts',
        hasChanged: false,
        changeType: 'none',
        oldHash: 'same-hash',
        newHash: 'same-hash',
        isAsset: false,
      });

      jest.spyOn(mockContextBus, 'getContext').mockResolvedValue(mockContext);

      const report = await changeDetector.scanProjectChanges('/test/project');

      expect(report.changedFiles).toBe(0);
      expect(report.requiresAttention).toBe(false);
    });
  });

  // ============ backupFile 测试 ============

  describe('backupFile - 备份文件', () => {
    const mockFs = require('fs');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('应成功备份文件到指定目录', async () => {
      const sourceFile = '/test/project/src/file.ts';
      const backupDir = '/test/project/.backup';

      // Mock fs.readFile
      jest.spyOn(mockFs.promises, 'readFile').mockResolvedValue('file content');

      // Mock fs.mkdir
      jest.spyOn(mockFs.promises, 'mkdir').mockResolvedValue(undefined);

      // Mock fs.writeFile
      jest.spyOn(mockFs.promises, 'writeFile').mockResolvedValue(undefined);

      const backupPath = await changeDetector.backupFile(sourceFile, backupDir);

      expect(backupPath).toBeDefined();
      expect(backupPath).toContain(backupDir);
      expect(backupPath).toContain('.ts');

      // 验证 mkdir 被调用（确保目录存在）
      expect(mockFs.promises.mkdir).toHaveBeenCalled();

      // 验证 writeFile 被调用
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
    });

    test('备份文件名应包含时间戳', async () => {
      const sourceFile = '/test/project/src/file.ts';
      const backupDir = '/test/project/.backup';

      jest.spyOn(mockFs.promises, 'readFile').mockResolvedValue('content');
      jest.spyOn(mockFs.promises, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(mockFs.promises, 'writeFile').mockResolvedValue(undefined);

      const backupPath = await changeDetector.backupFile(sourceFile, backupDir);

      // 验证备份路径包含时间戳（格式：文件名.时间戳.扩展名）
      expect(backupPath).toMatch(/file\.ts\.\d+\.\w+\.bak$/);
    });

    test('应创建备份目录（如果不存在）', async () => {
      const sourceFile = '/test/project/src/file.ts';
      const backupDir = '/test/project/.backup';

      jest.spyOn(mockFs.promises, 'readFile').mockResolvedValue('content');
      jest.spyOn(mockFs.promises, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(mockFs.promises, 'writeFile').mockResolvedValue(undefined);

      await changeDetector.backupFile(sourceFile, backupDir);

      // 验证 mkdir 以 recursive: true 被调用
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
        backupDir,
        { recursive: true }
      );
    });
  });
});
