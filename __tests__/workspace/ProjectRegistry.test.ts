/**
 * ProjectRegistry 单元测试
 *
 * TDD 流程：RED → GREEN → IMPROVE
 *
 * 测试策略：
 * - Mock 所有外部依赖
 * - 测试项目注册、查询、移除等核心功能
 * - 测试边界条件和错误处理
 * - 验证向后兼容性
 */

import {
  IProjectRegistry,
  ProjectMetadata,
  ProjectRegistrationResult
} from '../../core/workspace/IProjectRegistry';
import { ProjectRegistry } from '../../core/workspace/ProjectRegistry';

// ============ Test Suite ============

describe('ProjectRegistry', () => {
  let registry: IProjectRegistry;

  beforeEach(() => {
    registry = new ProjectRegistry();
  });

  afterEach(async () => {
    await registry.clear();
  });

  // ============ registerProject() 测试 ============

  describe('registerProject() - 注册新项目', () => {
    it('应成功注册新项目并返回项目元数据', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.name).toBe('TestProject');
      expect(result.metadata?.rootPath).toBe('/test/project');
      expect(result.metadata?.active).toBe(true);
      expect(result.metadata?.id).toBeDefined();
      expect(result.metadata?.createdAt).toBeDefined();
      expect(result.metadata?.updatedAt).toBeDefined();
    });

    it('应自动使用路径最后部分作为项目名称', async () => {
      const result = await registry.registerProject('/test/my-project');

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe('my-project');
    });

    it('应拒绝重复注册相同路径的项目', async () => {
      await registry.registerProject('/test/project', 'Project1');

      const result = await registry.registerProject('/test/project', 'Project2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('应允许多个不同路径的项目注册', async () => {
      const result1 = await registry.registerProject('/test/project1', 'Project1');
      const result2 = await registry.registerProject('/test/project2', 'Project2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.metadata?.id).not.toBe(result2.metadata?.id);
    });

    it('应支持自定义标签', async () => {
      const result = await registry.registerProject('/test/project', 'TaggedProject', undefined, ['frontend', 'typescript']);

      expect(result.success).toBe(true);
      expect(result.metadata?.tags).toEqual(['frontend', 'typescript']);
    });

    it('应支持项目描述', async () => {
      const result = await registry.registerProject('/test/project', 'DescribedProject', 'A test project');

      expect(result.success).toBe(true);
      expect(result.metadata?.description).toBe('A test project');
    });

    it('应生成唯一的项目ID', async () => {
      const results = await Promise.all([
        registry.registerProject('/test/p1'),
        registry.registerProject('/test/p2'),
        registry.registerProject('/test/p3'),
      ]);

      const ids = results.map(r => r.metadata?.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });
  });

  // ============ getProject() 测试 ============

  describe('getProject() - 获取项目元数据', () => {
    it('应返回已注册项目的元数据', async () => {
      const registerResult = await registry.registerProject('/test/project', 'TestProject');
      const projectId = registerResult.metadata!.id;

      const metadata = await registry.getProject(projectId);

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe(projectId);
      expect(metadata?.name).toBe('TestProject');
      expect(metadata?.rootPath).toBe('/test/project');
    });

    it('应返回null当项目不存在', async () => {
      const metadata = await registry.getProject('non-existent-id');

      expect(metadata).toBeNull();
    });
  });

  // ============ getProjectByPath() 测试 ============

  describe('getProjectByPath() - 通过路径获取项目', () => {
    it('应返回已注册项目的元数据', async () => {
      await registry.registerProject('/test/project', 'TestProject');

      const metadata = await registry.getProjectByPath('/test/project');

      expect(metadata).toBeDefined();
      expect(metadata?.rootPath).toBe('/test/project');
      expect(metadata?.name).toBe('TestProject');
    });

    it('应返回null当路径未注册', async () => {
      const metadata = await registry.getProjectByPath('/non/existent/path');

      expect(metadata).toBeNull();
    });
  });

  // ============ listProjects() 测试 ============

  describe('listProjects() - 列出所有项目', () => {
    it('应返回空数组当没有项目时', async () => {
      const projects = await registry.listProjects();

      expect(projects).toEqual([]);
    });

    it('应返回所有已注册项目', async () => {
      await registry.registerProject('/test/p1', 'Project1');
      await registry.registerProject('/test/p2', 'Project2');
      await registry.registerProject('/test/p3', 'Project3');

      const projects = await registry.listProjects();

      expect(projects.length).toBe(3);
      expect(projects.map(p => p.name)).toEqual(['Project1', 'Project2', 'Project3']);
    });
  });

  // ============ listActiveProjects() 测试 ============

  describe('listActiveProjects() - 列出激活项目', () => {
    it('应返回所有激活状态的项目', async () => {
      await registry.registerProject('/test/p1', 'Project1');
      await registry.registerProject('/test/p2', 'Project2');

      const projects = await registry.listActiveProjects();

      expect(projects.length).toBe(2);
      expect(projects.every(p => p.active)).toBe(true);
    });

    it('应不包含已停用的项目', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      await registry.updateProject(projectId, { active: false });

      const activeProjects = await registry.listActiveProjects();

      expect(activeProjects.length).toBe(0);
    });
  });

  // ============ removeProject() 测试 ============

  describe('removeProject() - 移除项目', () => {
    it('应成功移除已注册项目', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      const removed = await registry.removeProject(projectId);

      expect(removed).toBe(true);

      const metadata = await registry.getProject(projectId);
      expect(metadata).toBeNull();
    });

    it('应返回false当移除不存在项目', async () => {
      const removed = await registry.removeProject('non-existent-id');

      expect(removed).toBe(false);
    });
  });

  // ============ removeProjectByPath() 测试 ============

  describe('removeProjectByPath() - 通过路径移除项目', () => {
    it('应成功移除项目', async () => {
      await registry.registerProject('/test/project', 'TestProject');

      const removed = await registry.removeProjectByPath('/test/project');

      expect(removed).toBe(true);

      const metadata = await registry.getProjectByPath('/test/project');
      expect(metadata).toBeNull();
    });

    it('应返回false当路径未注册', async () => {
      const removed = await registry.removeProjectByPath('/non/existent');

      expect(removed).toBe(false);
    });
  });

  // ============ hasProject() 测试 ============

  describe('hasProject() - 检查项目存在性', () => {
    it('应返回true当项目存在', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      const exists = await registry.hasProject(projectId);

      expect(exists).toBe(true);
    });

    it('应返回false当项目不存在', async () => {
      const exists = await registry.hasProject('non-existent-id');

      expect(exists).toBe(false);
    });
  });

  // ============ hasPath() 测试 ============

  describe('hasPath() - 检查路径是否已注册', () => {
    it('应返回true当路径已注册', async () => {
      await registry.registerProject('/test/project', 'TestProject');

      const exists = await registry.hasPath('/test/project');

      expect(exists).toBe(true);
    });

    it('应返回false当路径未注册', async () => {
      const exists = await registry.hasPath('/non/existent');

      expect(exists).toBe(false);
    });
  });

  // ============ updateProject() 测试 ============

  describe('updateProject() - 更新项目元数据', () => {
    it('应成功更新项目名称', async () => {
      const result = await registry.registerProject('/test/project', 'OldName');
      const projectId = result.metadata!.id;

      const updated = await registry.updateProject(projectId, { name: 'NewName' });

      expect(updated).toBe(true);

      const metadata = await registry.getProject(projectId);
      expect(metadata?.name).toBe('NewName');
    });

    it('应成功更新项目描述', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      const updated = await registry.updateProject(projectId, { description: 'New description' });

      expect(updated).toBe(true);

      const metadata = await registry.getProject(projectId);
      expect(metadata?.description).toBe('New description');
    });

    it('应成功更新项目标签', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      const updated = await registry.updateProject(projectId, { tags: ['backend', 'python'] });

      expect(updated).toBe(true);

      const metadata = await registry.getProject(projectId);
      expect(metadata?.tags).toEqual(['backend', 'python']);
    });

    it('应成功切换激活状态', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;

      await registry.updateProject(projectId, { active: false });

      const metadata = await registry.getProject(projectId);
      expect(metadata?.active).toBe(false);
    });

    it('应返回false当项目不存在', async () => {
      const updated = await registry.updateProject('non-existent-id', { name: 'NewName' });

      expect(updated).toBe(false);
    });

    it('应更新updatedAt时间戳', async () => {
      const result = await registry.registerProject('/test/project', 'TestProject');
      const projectId = result.metadata!.id;
      const originalUpdatedAt = result.metadata!.updatedAt;

      // 等待2毫秒确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 2));

      await registry.updateProject(projectId, { name: 'NewName' });

      const metadata = await registry.getProject(projectId);
      expect(metadata?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  // ============ getProjectCount() 测试 ============

  describe('getProjectCount() - 获取项目总数', () => {
    it('应返回0当没有项目', async () => {
      const count = await registry.getProjectCount();

      expect(count).toBe(0);
    });

    it('应返回正确的项目数量', async () => {
      await registry.registerProject('/test/p1');
      await registry.registerProject('/test/p2');
      await registry.registerProject('/test/p3');

      const count = await registry.getProjectCount();

      expect(count).toBe(3);
    });

    it('应在移除项目后更新计数', async () => {
      await registry.registerProject('/test/p1');
      await registry.registerProject('/test/p2');
      const result = await registry.registerProject('/test/p3');

      await registry.removeProject(result.metadata!.id);

      const count = await registry.getProjectCount();

      expect(count).toBe(2);
    });
  });

  // ============ clear() 测试 ============

  describe('clear() - 清空所有项目', () => {
    it('应清空所有已注册项目', async () => {
      await registry.registerProject('/test/p1');
      await registry.registerProject('/test/p2');
      await registry.registerProject('/test/p3');

      const cleared = await registry.clear();

      expect(cleared).toBe(true);

      const count = await registry.getProjectCount();
      expect(count).toBe(0);
    });

    it('应返回true当清空空注册表', async () => {
      const cleared = await registry.clear();

      expect(cleared).toBe(true);
    });
  });

  // ============ 向后兼容性测试 ============

  describe('向后兼容性', () => {
    it('应支持单独使用（无工作区模式）', async () => {
      const result = await registry.registerProject('/standalone/project', 'StandaloneProject');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
    });
  });

  // ============ 边界条件测试 ============

  describe('边界条件', () => {
    it('应处理空路径', async () => {
      const result = await registry.registerProject('', 'EmptyPathProject');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应处理空名称（自动从路径提取）', async () => {
      const result = await registry.registerProject('/test/my-project', '');

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe('my-project');
    });

    it('应处理特殊字符在路径中', async () => {
      const result = await registry.registerProject('/test/path-with-dashes/project', 'TestProject');

      expect(result.success).toBe(true);
    });

    it('应处理空格在名称中', async () => {
      const result = await registry.registerProject('/test/project', 'Project With Spaces');

      expect(result.success).toBe(true);
      expect(result.metadata?.name).toBe('Project With Spaces');
    });
  });
});
