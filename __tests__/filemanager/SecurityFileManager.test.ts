/**
 * DevFlow v5 - FileManager 安全功能单元测试
 *
 * 遵循 TDD 原则：RED → GREEN → IMPROVE
 */

import {
  SecurityConfig,
  SecurityValidator,
  PathTraversalError,
  FileTypeNotAllowedError,
  FileSizeExceededError
} from '../../core/filemanager/SecurityValidator';

describe('SecurityValidator', () => {
  let validator: SecurityValidator;
  let config: SecurityConfig;

  beforeEach(() => {
    config = {
      allowedPaths: ['/src', '/lib', '/tests'],
      allowedFileTypes: ['.ts', '.js', '.json', '.md'],
      maxFileSize: 1024 * 1024, // 1MB
      enablePathTraversalCheck: true,
      enableFileTypeCheck: true,
      enableFileSizeCheck: true
    };
    validator = new SecurityValidator('/project', config);
  });

  describe('路径遍历防护', () => {
    it('应该阻止包含../的路径', () => {
      const result = validator.validatePath('../etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(PathTraversalError);
      expect(result.error?.message).toContain('路径遍历');
    });

    it('应该阻止包含..\\的Windows路径', () => {
      const result = validator.validatePath('..\\windows\\system32');

      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(PathTraversalError);
    });

    it('应该阻止绝对路径逃逸', () => {
      const result = validator.validatePath('/etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(PathTraversalError);
    });

    it('应该允许白名单内的相对路径', () => {
      const result = validator.validatePath('src/utils/helper.ts');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该允许深层嵌套的合法路径', () => {
      const result = validator.validatePath('src/components/header/Button.tsx');

      expect(result.valid).toBe(true);
    });

    it('应该阻止包含%2e%2e（URL编码的..）的路径', () => {
      const result = validator.validatePath('src/%2e%2e/config');

      expect(result.valid).toBe(false);
    });

    it('应该阻止包含..%2f的路径', () => {
      const result = validator.validatePath('src/..%2fetc/passwd');

      expect(result.valid).toBe(false);
    });

    it('应该阻止包含%5c（URL编码的\\）的路径', () => {
      const result = validator.validatePath('src%5c..\\config');

      expect(result.valid).toBe(false);
    });
  });

  describe('路径白名单', () => {
    it('应该只允许白名单内的目录', () => {
      const result1 = validator.validatePath('src/module.ts');
      expect(result1.valid).toBe(true);

      const result2 = validator.validatePath('lib/utils.ts');
      expect(result2.valid).toBe(true);

      const result3 = validator.validatePath('tests/test.ts');
      expect(result3.valid).toBe(true);
    });

    it('应该拒绝白名单外的目录', () => {
      const result = validator.validatePath('node_modules/package/index.js');

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('路径不在允许的目录中');
    });

    it('应该支持根目录白名单', () => {
      const configWithRoot: SecurityConfig = {
        ...config,
        allowedPaths: ['/']  // 允许根目录
      };
      const rootValidator = new SecurityValidator('/project', configWithRoot);

      const result = rootValidator.validatePath('any/path/file.ts');

      expect(result.valid).toBe(true);
    });

    it('应该支持通配符白名单', () => {
      const configWithWildcard: SecurityConfig = {
        ...config,
        allowedPaths: ['*']  // 允许所有路径
      };
      const wildcardValidator = new SecurityValidator('/project', configWithWildcard);

      const result = wildcardValidator.validatePath('any/deeply/nested/path/file.ts');

      expect(result.valid).toBe(true);
    });
  });

  describe('文件类型验证', () => {
    it('应该允许白名单内的文件类型', () => {
      const allowedTypes = ['.ts', '.js', '.json', '.md'];

      allowedTypes.forEach(type => {
        const result = validator.validateFileType(`src/file${type}`);
        expect(result.valid).toBe(true);
      });
    });

    it('应该拒绝白名单外的文件类型', () => {
      const result = validator.validateFileType('src/script.exe');

      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(FileTypeNotAllowedError);
      expect(result.error?.message).toContain('.exe');
    });

    it('应该支持无扩展名文件', () => {
      const configNoExt: SecurityConfig = {
        ...config,
        allowNoExtension: true
      };
      const noExtValidator = new SecurityValidator('/project', configNoExt);

      const result = noExtValidator.validateFileType('src/Makefile');

      expect(result.valid).toBe(true);
    });

    it('应该拒绝危险文件类型', () => {
      const dangerousTypes = [
        'src/virus.exe',
        'src/script.bat',
        'src/macro.docm',
        'src/setup.msi'
      ];

      dangerousTypes.forEach(path => {
        const result = validator.validateFileType(path);
        // 危险类型应该不在默认白名单中
        if (path.endsWith('.exe') || path.endsWith('.bat') || path.endsWith('.msi')) {
          expect(result.valid).toBe(false);
        }
      });
    });

    it('应该支持自定义文件类型白名单', () => {
      const customConfig: SecurityConfig = {
        ...config,
        allowedFileTypes: ['.txt', '.csv', '.xml']
      };
      const customValidator = new SecurityValidator('/project', customConfig);

      const result1 = customValidator.validateFileType('data.txt');
      expect(result1.valid).toBe(true);

      const result2 = customValidator.validateFileType('script.ts');
      expect(result2.valid).toBe(false);
    });
  });

  describe('文件大小限制', () => {
    it('应该拒绝超过大小限制的文件', () => {
      const largeContent = 'x'.repeat(1024 * 1024 + 1); // 1MB + 1 byte
      const result = validator.validateFileSize('src/large.ts', largeContent);

      expect(result.valid).toBe(false);
      expect(result.error).toBeInstanceOf(FileSizeExceededError);
      // 1MB 格式
      expect(result.error?.message).toMatch(/\d+MB/);
    });

    it('应该允许符合大小限制的文件', () => {
      const normalContent = 'x'.repeat(1024 * 512); // 512KB
      const result = validator.validateFileSize('src/normal.ts', normalContent);

      expect(result.valid).toBe(true);
    });

    it('应该支持自定义大小限制', () => {
      const customConfig: SecurityConfig = {
        ...config,
        maxFileSize: 100 // 100 bytes
      };
      const customValidator = new SecurityValidator('/project', customConfig);

      const largeContent = 'x'.repeat(101);
      const result = customValidator.validateFileSize('src/file.ts', largeContent);

      expect(result.valid).toBe(false);
      // 100 bytes 应该显示为 "100 bytes"
      expect(result.error?.message).toContain('100 bytes');
    });

    it('应该允许空文件', () => {
      const result = validator.validateFileSize('src/empty.ts', '');

      expect(result.valid).toBe(true);
    });
  });

  describe('组合安全验证', () => {
    it('应该同时检查所有安全规则', () => {
      const result = validator.validateAll(
        '../malicious.exe',
        'x'.repeat(2 * 1024 * 1024) // 2MB
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('应该通过所有安全检查', () => {
      const normalContent = 'x'.repeat(1024); // 1KB
      const result = validator.validateAll('src/utils.ts', normalContent);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('应该返回所有验证错误', () => {
      const result = validator.validateAll(
        '../unallowed.exe',
        'x'.repeat(2 * 1024 * 1024)
      );

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(1);

      // 检查错误类型
      const errorTypes = result.errors?.map(e => e.constructor.name);
      expect(errorTypes).toContain('PathTraversalError');
    });
  });

  describe('配置更新', () => {
    it('应该支持动态更新配置', () => {
      const newConfig: SecurityConfig = {
        ...config,
        allowedPaths: ['*'],
        maxFileSize: 10 * 1024 * 1024 // 10MB
      };

      validator.updateConfig(newConfig);

      // 现在应该允许任意路径
      const pathResult = validator.validatePath('any/path/file.ts');
      expect(pathResult.valid).toBe(true);

      // 现在应该允许更大的文件
      const largeContent = 'x'.repeat(5 * 1024 * 1024); // 5MB
      const sizeResult = validator.validateFileSize('src/large.ts', largeContent);
      expect(sizeResult.valid).toBe(true);
    });
  });

  describe('安全报告', () => {
    it('应该生成安全验证报告', () => {
      const result = validator.validateAll('src/utils.ts', 'content');

      const report = validator.generateSecurityReport(result);

      expect(report.timestamp).toBeDefined();
      expect(report.valid).toBeDefined();
      expect(report.checksPerformed).toContain('pathTraversal');
      expect(report.checksPerformed).toContain('fileType');
      expect(report.checksPerformed).toContain('fileSize');
    });
  });

  describe('边界情况', () => {
    it('应该处理空路径', () => {
      const result = validator.validatePath('');

      expect(result.valid).toBe(false);
    });

    it('应该处理null和undefined路径', () => {
      const result1 = validator.validatePath(null as any);
      expect(result1.valid).toBe(false);

      const result2 = validator.validatePath(undefined as any);
      expect(result2.valid).toBe(false);
    });

    it('应该处理非常长的路径', () => {
      const longPath = 'src/' + 'a'.repeat(1000) + '/file.ts';
      const result = validator.validatePath(longPath);

      expect(result.valid).toBe(false);
    });

    it('应该处理特殊字符路径', () => {
      const specialPaths = [
        'src/file with spaces.ts',
        'src/file-with-dash.ts',
        'src/file_with_underscore.ts',
        'src/file.with.dots.ts'
      ];

      specialPaths.forEach(path => {
        const result = validator.validatePath(path);
        expect(result.valid).toBe(true);
      });
    });
  });
});
