/**
 * DevFlow v5 - Claude Skills 结果格式化器
 *
 * 职责：将核心模块的输出转换为 Claude 友好的格式
 */

import type {
  IResultFormatter,
  ClaudeSkillOutput,
  DevFlowCoreError,
  ProgressInfo,
  StatusReport,
  OutputMetadata,
  ErrorSeverity,
  OutputStatus
} from './types';
import {
  OutputStatus as OutputStatusEnum,
  ErrorSeverity as ErrorSeverityEnum,
  ErrorCategory
} from './types';

/**
 * 结果格式化器实现
 */
export class ResultFormatter implements IResultFormatter {
  /**
   * 格式化成功结果
   */
  public formatSuccess(data: unknown, metadata?: Partial<OutputMetadata>): ClaudeSkillOutput {
    const now = new Date().toISOString();

    return {
      success: true,
      status: OutputStatusEnum.SUCCESS,
      content: this.formatDataAsMarkdown(data),
      recommendations: this.generateRecommendations(data),
      nextSteps: this.generateNextSteps(data),
      metadata: {
        timestamp: metadata?.timestamp || now,
        duration: metadata?.duration || 0,
        projectContext: metadata?.projectContext,
        statistics: metadata?.statistics
      }
    };
  }

  /**
   * 格式化失败结果
   */
  public formatFailure(error: DevFlowCoreError, metadata?: Partial<OutputMetadata>): ClaudeSkillOutput {
    const now = new Date().toISOString();
    const severity = this.mapCategoryToSeverity(error.category);

    // 处理多个错误
    let errorsList = [{
      code: error.code,
      message: error.message,
      severity,
      resolution: this.generateResolution(error)
    }];

    // 检查上下文中的多个错误
    if (error.context?.errors && Array.isArray(error.context.errors)) {
      const contextErrors = error.context.errors as Array<{ code: string; message: string }>;
      errorsList = [
        ...errorsList,
        ...contextErrors.map(e => ({
          code: e.code,
          message: e.message,
          severity,
          resolution: this.generateResolution({ ...error, code: e.code, message: e.message })
        }))
      ];
    }

    return {
      success: false,
      status: OutputStatusEnum.FAILED,
      content: this.formatErrorAsMarkdown(error),
      errors: errorsList,
      metadata: {
        timestamp: metadata?.timestamp || now,
        duration: metadata?.duration || 0,
        projectContext: metadata?.projectContext
      }
    };
  }

  /**
   * 格式化进度更新
   */
  public formatProgress(progress: ProgressInfo): ClaudeSkillOutput {
    const progressBar = this.renderProgressBar(progress.percentComplete);

    // 显示为 "当前步骤索引/总步骤数"
    const displayIndex = progress.percentComplete >= 100
      ? progress.totalSteps
      : progress.currentStepIndex;

    let content = `## 📊 进度更新\n\n` +
      `${progressBar} ${progress.percentComplete}%\n\n` +
      `**当前步骤**: ${progress.currentStep} (${displayIndex}/${progress.totalSteps})\n\n`;

    if (progress.currentOperation) {
      content += `**操作**: ${progress.currentOperation}\n\n`;
    }

    if (progress.estimatedTimeRemaining) {
      content += `**预计剩余时间**: ${this.formatDuration(progress.estimatedTimeRemaining)}\n\n`;
    }

    if (progress.percentComplete >= 100) {
      content = content.replace(
        `**当前步骤**: ${progress.currentStep} (${displayIndex}/${progress.totalSteps})\n\n`,
        `**当前步骤**: ${progress.currentStep} (${displayIndex}/${progress.totalSteps}) ✓\n\n`
      );
    }

    return {
      success: true,
      status: OutputStatusEnum.SUCCESS,
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: 0
      }
    };
  }

  /**
   * 格式化状态报告
   */
  public formatStatus(status: StatusReport): ClaudeSkillOutput {
    // 检查是否有任何有效数据
    const hasData = status.projectName || status.projectType ||
                    status.totalStories || status.completedStories ||
                    status.currentPhase || status.lastActivity;

    if (!hasData) {
      return {
        success: true,
        status: OutputStatusEnum.SUCCESS,
        content: '## 📋 项目状态\n\n未找到项目信息。请确保在正确的项目目录中。',
        metadata: {
          timestamp: new Date().toISOString(),
          duration: 0
        }
      };
    }

    const percentComplete = status.totalStories && status.totalStories > 0
      ? Math.round((status.completedStories || 0) / status.totalStories * 100)
      : 0;

    let content = `# ${status.projectName || '项目'}\n\n`;
    content += `**类型**: ${this.getProjectTypeLabel(status.projectType)}\n\n`;

    if (status.currentPhase) {
      content += `**当前阶段**: ${status.currentPhase}\n\n`;
    }

    if (status.totalStories) {
      content += `**故事进度**: ${status.completedStories || 0}/${status.totalStories} (${percentComplete}%)\n\n`;
      content += this.renderProgressBar(percentComplete) + '\n\n';
    }

    if (status.lastActivity) {
      content += `**最后活动**: ${status.lastActivity}\n\n`;
    }

    if (status.recommendations && status.recommendations.length > 0) {
      content += '## 💡 推荐操作\n\n';
      status.recommendations.forEach((rec, index) => {
        content += `${index + 1}. ${rec}\n`;
      });
    }

    return {
      success: true,
      status: OutputStatusEnum.SUCCESS,
      content,
      nextSteps: status.recommendations,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: 0,
        projectContext: {
          name: status.projectName,
          type: status.projectType
        }
      }
    };
  }

  /**
   * 格式化数据为 Markdown
   */
  private formatDataAsMarkdown(data: unknown): string {
    if (data === null || data === undefined) {
      return '✓ 操作已完成';
    }

    if (typeof data === 'string') {
      return data.startsWith('✓') || data.startsWith('✅') ? data : `✓ ${data}`;
    }

    if (typeof data === 'number') {
      return `✓ ${String(data)}`;
    }

    if (typeof data === 'boolean') {
      return data ? '✓ 成功' : '✗ 失败';
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '✓ 无数据';
      }
      return this.formatArrayAsMarkdown(data);
    }

    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;

      // 检查是否是项目数据
      if (obj.projectName && obj.stories && Array.isArray(obj.stories)) {
        return this.formatProjectData(obj);
      }

      try {
        // 安全地处理循环引用
        const seen = new WeakSet();
        const safeData = JSON.stringify(data, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        }, 2);

        return '✓ 操作完成\n\n```json\n' + safeData + '\n```';
      } catch {
        return '✓ 操作已完成（数据结构复杂）';
      }
    }

    return '✓ 操作已完成';
  }

  /**
   * 格式化项目数据
   */
  private formatProjectData(obj: Record<string, unknown>): string {
    let result = `# ${obj.projectName}\n\n`;

    const stories = obj.stories as Array<{ id: string; title: string; status: string }>;
    stories.forEach(story => {
      const icon = story.status === 'completed' || story.status === 'done' ? '✓' : '○';
      result += `${icon} **${story.title}** (${story.id})\n`;
    });

    return result;
  }

  /**
   * 格式化数组为 Markdown
   */
  private formatArrayAsMarkdown(array: unknown[]): string {
    if (array.length === 0) {
      return '✓ 无数据';
    }

    const firstItem = array[0];

    // 检查是否是对象数组
    if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
      let result = '';
      array.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          const title = obj.title || obj.name || obj.id || `项 ${index + 1}`;
          const status = obj.status;

          let icon = '○';
          if (status === 'completed' || status === 'done') {
            icon = '✓';
          } else if (status === 'failed' || status === 'error') {
            icon = '✗';
          } else if (status === 'pending' || status === 'todo') {
            icon = '○';
          }

          result += `${icon} **${title}**`;
          if (obj.id) {
            result += ` (${obj.id})`;
          }
          result += '\n';
        }
      });
      return result;
    }

    // 简单数组
    return array.map(item => `- ${String(item)}`).join('\n');
  }

  /**
   * 格式化错误为 Markdown
   */
  private formatErrorAsMarkdown(error: DevFlowCoreError): string {
    let result = '## ❌ 错误\n\n';
    result += `**${error.code}**: ${error.message}\n\n`;

    if (error.context && Object.keys(error.context).length > 0) {
      result += '### 错误上下文\n\n';
      result += '```json\n' + JSON.stringify(error.context, null, 2) + '\n```\n\n';
    }

    return result;
  }

  /**
   * 渲染进度条
   */
  private renderProgressBar(percent: number): string {
    const filled = Math.round(percent / 5); // 20个字符
    const empty = 20 - filled;
    return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);

    if (seconds < 60) {
      return `${seconds}秒`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
  }

  /**
   * 生成推荐操作
   */
  private generateRecommendations(data: unknown): string[] {
    const recommendations: string[] = [];

    // 根据数据类型生成推荐
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;

      if (obj.completedTasks !== undefined && obj.totalTasks !== undefined) {
        const completed = obj.completedTasks as number;
        const total = obj.totalTasks as number;

        if (completed < total) {
          recommendations.push('继续处理剩余任务');
        } else {
          recommendations.push('所有任务已完成，可以提交代码');
        }
      }

      if (obj.passedTests !== undefined || obj.failedTests !== undefined) {
        const passed = (obj.passedTests as number) || 0;
        const failed = (obj.failedTests as number) || 0;

        if (failed > 0) {
          recommendations.push(`修复 ${failed} 个失败的测试`);
        } else if (passed > 0) {
          recommendations.push('所有测试通过，可以继续开发');
        }
      }
    }

    // 默认推荐
    if (recommendations.length === 0) {
      recommendations.push('执行 `/devflow` 查看详细状态');
      recommendations.push('执行 `/devflow continue` 继续开发');
    }

    return recommendations;
  }

  /**
   * 生成下一步建议
   */
  private generateNextSteps(data: unknown): string[] {
    return this.generateRecommendations(data);
  }

  /**
   * 生成错误解决建议
   */
  private generateResolution(error: DevFlowCoreError): string {
    const resolutions: Record<ErrorCategory, string> = {
      [ErrorCategory.VALIDATION]: '请检查输入参数是否符合要求',
      [ErrorCategory.PERMISSION]: '请检查文件权限并确保有足够的访问权限',
      [ErrorCategory.FILE_OPERATION]: '请确认文件路径正确且文件存在',
      [ErrorCategory.STATE_MANAGEMENT]: '尝试使用 `/devflow --resync` 重新同步并恢复状态',
      [ErrorCategory.EXECUTION]: '请查看详细错误信息并修复相关问题',
      [ErrorCategory.NETWORK]: '请检查网络连接并重试',
      [ErrorCategory.UNKNOWN]: '请联系技术支持并提供错误详情'
    };

    return resolutions[error.category] || '请查看错误详情并采取相应措施';
  }

  /**
   * 映射错误类别到严重级别
   */
  private mapCategoryToSeverity(category: ErrorCategory): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      [ErrorCategory.VALIDATION]: ErrorSeverityEnum.WARNING,
      [ErrorCategory.PERMISSION]: ErrorSeverityEnum.ERROR,
      [ErrorCategory.FILE_OPERATION]: ErrorSeverityEnum.ERROR,
      [ErrorCategory.STATE_MANAGEMENT]: ErrorSeverityEnum.CRITICAL,
      [ErrorCategory.EXECUTION]: ErrorSeverityEnum.ERROR,
      [ErrorCategory.NETWORK]: ErrorSeverityEnum.WARNING,
      [ErrorCategory.UNKNOWN]: ErrorSeverityEnum.WARNING
    };

    return severityMap[category] || ErrorSeverityEnum.INFO;
  }

  /**
   * 获取项目类型标签
   */
  private getProjectTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      '绿地项目': '🌱 绿地项目',
      '棕地项目': '🏗️ 棕地项目',
      '中途项目': '🔄 中途项目',
      'undefined': '❓ 未知'
    };

    return labels[type || 'undefined'] || type || '❓ 未知';
  }
}

// 导出枚举
export { OutputStatus, ErrorSeverity } from './types';
