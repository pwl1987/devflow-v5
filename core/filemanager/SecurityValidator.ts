/**
 * DevFlow v5 - 文件安全验证器
 *
 * 职责：验证文件操作的安全性，防止路径遍历、恶意文件等
 */

// 重新定义安全相关的错误类（避免循环依赖）
class SecurityValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityValidationError';
    Object.setPrototypeOf(this, SecurityValidationError.prototype);
  }
}

export class PathTraversalError extends SecurityValidationError {
  constructor(filePath: string, reason?: string) {
    const message = reason
      ? `路径遍历检测: ${filePath} - ${reason}`
      : `路径遍历检测: ${filePath}`;
    super(message, 'PATH_TRAVERSAL');
    Object.setPrototypeOf(this, PathTraversalError.prototype);
  }
}

export class FileTypeNotAllowedError extends SecurityValidationError {
  constructor(filePath: string, reason?: string) {
    const message = reason
      ? `文件类型不允许: ${filePath} - ${reason}`
      : `文件类型不允许: ${filePath}`;
    super(message, 'FILE_TYPE_NOT_ALLOWED');
    Object.setPrototypeOf(this, FileTypeNotAllowedError.prototype);
  }
}

export class FileSizeExceededError extends SecurityValidationError {
  constructor(filePath: string, maxSize: number, reason?: string) {
    // 格式化大小显示
    let sizeText: string;
    if (maxSize >= 1024 * 1024) {
      sizeText = `${(maxSize / (1024 * 1024)).toFixed(0)}MB`;
    } else if (maxSize >= 1024) {
      sizeText = `${(maxSize / 1024).toFixed(0)}KB`;
    } else {
      sizeText = `${maxSize} bytes`;
    }

    const message = reason
      ? `文件大小超限: ${filePath} - ${reason}`
      : `文件大小超过限制 (${sizeText}): ${filePath}`;

    super(message, 'FILE_SIZE_EXCEEDED');
    Object.setPrototypeOf(this, FileSizeExceededError.prototype);
  }
}

/**
 * 安全配置接口
 */
export interface SecurityConfig {
  /** 允许的路径白名单 */
  allowedPaths: string[];
  /** 允许的文件扩展名 */
  allowedFileTypes: string[];
  /** 最大文件大小（字节） */
  maxFileSize: number;
  /** 是否启用路径遍历检查 */
  enablePathTraversalCheck: boolean;
  /** 是否启用文件类型检查 */
  enableFileTypeCheck: boolean;
  /** 是否启用文件大小检查 */
  enableFileSizeCheck: boolean;
  /** 是否允许无扩展名文件 */
  allowNoExtension?: boolean;
}

/**
 * 安全验证结果
 */
export interface SecurityValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误信息 */
  error?: Error;
}

/**
 * 组合安全验证结果
 */
export interface CombinedSecurityResult {
  /** 是否全部通过 */
  valid: boolean;
  /** 所有错误 */
  errors?: Error[];
}

/**
 * 安全报告
 */
export interface SecurityReport {
  /** 报告时间 */
  timestamp: string;
  /** 是否通过 */
  valid: boolean;
  /** 执行的检查 */
  checksPerformed: string[];
  /** 检查结果 */
  checkResults: Record<string, boolean>;
  /** 错误摘要 */
  errorSummary?: string[];
}

/**
 * 安全验证器
 */
export class SecurityValidator {
  private projectRoot: string;
  private config: SecurityConfig;

  /**
   * 危险路径模式
   */
  private static readonly DANGEROUS_PATH_PATTERNS = [
    /\.\.\//,           // ../
    /\.\.\\/,           // ..\
    /%2e%2e/i,         // URL编码的..
    /%2f/i,            // URL编码的/
    /%5c/i,            // URL编码的\
    /\.\.%2f/i,        // ../ + URL编码/
    /%2e%2e%5c/i       // .. + URL编码的\
  ];

  /**
   * 危险文件扩展名
   */
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr',
    '.msi', '.dll', '.vbs', '.ps1', '.jar',
    '.docm', '.dotm', '.xlsm', '.xltm'
  ];

  constructor(projectRoot: string, config: SecurityConfig) {
    this.projectRoot = projectRoot;
    this.config = config;
  }

  /**
   * 验证路径安全性
   */
  public validatePath(filePath: string): SecurityValidationResult {
    // 基本验证
    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        error: new PathTraversalError(filePath, '无效的文件路径')
      };
    }

    // 检查路径长度
    if (filePath.length > 500) {
      return {
        valid: false,
        error: new PathTraversalError(filePath, '路径过长')
      };
    }

    // 路径遍历检查
    if (this.config.enablePathTraversalCheck) {
      const traversalResult = this.checkPathTraversal(filePath);
      if (!traversalResult.valid) {
        return traversalResult;
      }
    }

    // 白名单检查
    const whitelistResult = this.checkPathWhitelist(filePath);
    if (!whitelistResult.valid) {
      return whitelistResult;
    }

    return { valid: true };
  }

  /**
   * 验证文件类型
   */
  public validateFileType(filePath: string): SecurityValidationResult {
    if (!this.config.enableFileTypeCheck) {
      return { valid: true };
    }

    const extension = this.getFileExtension(filePath);

    // 无扩展名文件
    if (!extension) {
      if (this.config.allowNoExtension) {
        return { valid: true };
      }
      return {
        valid: false,
        error: new FileTypeNotAllowedError(filePath, '不允许无扩展名文件')
      };
    }

    // 检查是否为危险类型
    if (SecurityValidator.DANGEROUS_EXTENSIONS.includes(extension)) {
      return {
        valid: false,
        error: new FileTypeNotAllowedError(filePath, `危险文件类型: ${extension}`)
      };
    }

    // 检查白名单
    if (!this.config.allowedFileTypes.includes(extension)) {
      return {
        valid: false,
        error: new FileTypeNotAllowedError(filePath, `不允许的文件类型: ${extension}`)
      };
    }

    return { valid: true };
  }

  /**
   * 验证文件大小
   */
  public validateFileSize(filePath: string, content: string): SecurityValidationResult {
    if (!this.config.enableFileSizeCheck) {
      return { valid: true };
    }

    const size = Buffer.byteLength(content, 'utf8');

    if (size > this.config.maxFileSize) {
      return {
        valid: false,
        error: new FileSizeExceededError(
          filePath,
          this.config.maxFileSize
        )
      };
    }

    return { valid: true };
  }

  /**
   * 执行所有安全验证
   */
  public validateAll(filePath: string, content: string): CombinedSecurityResult {
    const errors: Error[] = [];

    // 路径验证
    const pathResult = this.validatePath(filePath);
    if (!pathResult.valid && pathResult.error) {
      errors.push(pathResult.error);
    }

    // 文件类型验证
    const typeResult = this.validateFileType(filePath);
    if (!typeResult.valid && typeResult.error) {
      errors.push(typeResult.error);
    }

    // 文件大小验证
    const sizeResult = this.validateFileSize(filePath, content);
    if (!sizeResult.valid && sizeResult.error) {
      errors.push(sizeResult.error);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 更新安全配置
   */
  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 生成安全报告
   */
  public generateSecurityReport(result: CombinedSecurityResult): SecurityReport {
    const checks: string[] = [];
    const checkResults: Record<string, boolean> = {};
    const errorSummary: string[] = [];

    if (this.config.enablePathTraversalCheck) {
      checks.push('pathTraversal');
      checkResults.pathTraversal = result.errors?.some(e =>
        e.constructor.name === 'PathTraversalError'
      ) === false;
    }

    if (this.config.enableFileTypeCheck) {
      checks.push('fileType');
      checkResults.fileType = result.errors?.some(e =>
        e.constructor.name === 'FileTypeNotAllowedError'
      ) === false;
    }

    if (this.config.enableFileSizeCheck) {
      checks.push('fileSize');
      checkResults.fileSize = result.errors?.some(e =>
        e.constructor.name === 'FileSizeExceededError'
      ) === false;
    }

    if (result.errors) {
      result.errors.forEach(error => {
        errorSummary.push(error.message);
      });
    }

    return {
      timestamp: new Date().toISOString(),
      valid: result.valid,
      checksPerformed: checks,
      checkResults,
      errorSummary: errorSummary.length > 0 ? errorSummary : undefined
    };
  }

  /**
   * 检查路径遍历攻击
   */
  private checkPathTraversal(filePath: string): SecurityValidationResult {
    // 检查危险模式
    for (const pattern of SecurityValidator.DANGEROUS_PATH_PATTERNS) {
      if (pattern.test(filePath)) {
        return {
          valid: false,
          error: new PathTraversalError(filePath, '检测到路径遍历攻击')
        };
      }
    }

    // 检查绝对路径
    if (filePath.startsWith('/') || filePath.startsWith('\\')) {
      // 如果路径以/开头，但不在项目根目录内，则拒绝
      const normalizedRoot = this.projectRoot.replace(/\\/g, '/');
      const normalizedPath = filePath.replace(/\\/g, '/');

      if (!normalizedPath.startsWith(normalizedRoot)) {
        return {
          valid: false,
          error: new PathTraversalError(filePath, '路径不在项目根目录内')
        };
      }
    }

    return { valid: true };
  }

  /**
   * 检查路径白名单
   */
  private checkPathWhitelist(filePath: string): SecurityValidationResult {
    // 标准化路径
    const normalizedPath = filePath.replace(/\\/g, '/');

    // 检查通配符白名单
    if (this.config.allowedPaths.includes('*')) {
      return { valid: true };
    }

    // 检查根目录白名单
    if (this.config.allowedPaths.includes('/')) {
      return { valid: true };
    }

    // 检查是否以白名单路径开头
    for (const allowedPath of this.config.allowedPaths) {
      const normalizedAllowed = allowedPath.replace(/\\/g, '/');

      if (normalizedPath.startsWith(normalizedAllowed + '/') ||
          normalizedPath === normalizedAllowed) {
        return { valid: true };
      }

      // 也允许白名单路径下的深层目录
      if (normalizedAllowed.startsWith('/') && normalizedPath.startsWith(normalizedAllowed.substring(1))) {
        return { valid: true };
      }

      // 允许白名单路径不带/的情况
      if (!normalizedAllowed.startsWith('/') && normalizedPath.startsWith(normalizedAllowed)) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      error: new PathTraversalError(filePath, `路径不在允许的目录中`)
    };
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string | null {
    // 处理以点开头的隐藏文件
    if (filePath.startsWith('.')) {
      // 只有当文件名中有两个或更多的点时，才认为有扩展名
      const lastDotIndex = filePath.lastIndexOf('.');
      if (lastDotIndex > 0) {
        return filePath.substring(lastDotIndex);
      }
      return null;
    }

    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
      return null;
    }

    // 处理文件名中包含多个点的情况
    const slashIndex = filePath.lastIndexOf('/');
    const basePath = slashIndex === -1 ? filePath : filePath.substring(slashIndex + 1);
    const fileLastDotIndex = basePath.lastIndexOf('.');

    if (fileLastDotIndex === -1 || fileLastDotIndex === basePath.length - 1) {
      return null;
    }

    return basePath.substring(fileLastDotIndex);
  }
}
