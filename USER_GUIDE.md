# DevFlow v5 - 用户使用手册

**版本**: 5.0.0
**更新时间**: 2026-03-10
**GitHub**: https://github.com/pwl1987/devflow-v5

---

## 📖 目录

1. [简介](#简介)
2. [安装](#安装)
3. [配置](#配置)
4. [核心概念](#核心概念)
5. [使用指南](#使用指南)
6. [API 参考](#api-参考)
7. [开发指南](#开发指南)
8. [常见问题](#常见问题)

---

## 📌 简介

DevFlow v5 是一个**企业级开发流程编排器**，专为 Claude Code 设计。它能够智能地管理开发流程，支持批量处理、断点续传、技能编排和团队协作。

### 核心特性

- ✅ **智能路由**: 自动识别项目类型（绿地/棕地/中途）
- ✅ **流程编排**: 支持 Quick/Standard/Rigorous 三种流程模式
- ✅ **批量处理**: 高效处理多个用户故事
- ✅ **断点续传**: 流程中断后可从断点恢复
- ✅ **技能编排**: 灵活的技能执行引擎
- ✅ **团队协作**: 基于角色的权限管理
- ✅ **审计日志**: 完整的操作审计追踪
- ✅ **分布式状态**: 跨项目状态同步

---

## 🚀 安装

### 前置要求

- Node.js >= 18.0.0
- TypeScript >= 5.3.0
- npm 或 yarn

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/pwl1987/devflow-v5.git
cd devflow-v5

# 安装依赖
npm install

# 运行测试
npm test

# 检查测试覆盖率
npm run test:coverage
```

### 安装为 Claude Skill

将 DevFlow v5 安装为 Claude Code 的技能：

```bash
# 创建技能目录
mkdir -p ~/.claude/skills
cp -r devflow-v5 ~/.claude/skills/devflow-v5
```

---

## ⚙️ 配置

### 环境变量配置

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

### 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 运行环境 (development/production/test) |
| `LOG_LEVEL` | `info` | 日志级别 (debug/info/warn/error) |
| `MAX_CONCURRENT_FLOWS` | `5` | 最大并发流程数 |
| `DEFAULT_TIMEOUT_MS` | `300000` | 默认操作超时时间（毫秒） |
| `DEFAULT_BATCH_SIZE` | `5` | 批量处理默认大小 |
| `MAX_BATCH_SIZE` | `10` | 批量处理最大大小 |
| `ALLOWED_FILE_TYPES` | `.ts,.js,.json,.md,.txt,.yaml,.yml` | 允许的文件扩展名 |
| `MAX_FILE_SIZE` | `10485760` | 最大文件大小（字节） |
| `CHECKPOINT_RETENTION_DAYS` | `30` | 断点保留天数 |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | 审计日志保留天数 |

### TypeScript 配置

项目使用 TypeScript 5.7，配置文件 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 代码规范配置

项目使用 ESLint 和 Prettier 进行代码规范检查：

```bash
# 检查代码规范
npm run lint

# 自动修复代码规范问题
npm run lint:fix

# 格式化代码
npm run format

# 检查代码格式
npm run format:check
```

---

## 🧠 核心概念

### 项目类型

DevFlow v5 支持三种项目类型：

1. **绿地项目 (Greenfield)**: 从头开始的新项目
   - 6 阶段流程: init → research → design → develop → test → deploy

2. **棕地项目 (Brownfield)**: 现有项目的改造
   - 5 阶段流程: analysis → assessment → refactor → test → deploy

3. **中途项目**: 已有一定基础的半成品项目
   - 智能评估并推荐合适的流程

### 流程模式

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| **Quick** | 快速原型、MVP | 速度快，检查少 |
| **Standard** | 日常开发 | 平衡速度和质量 |
| **Rigorous** | 生产级项目 | 严格检查，高质量 |

### 核心组件

```
DevFlow v5
├── ContextDataBus      # 上下文数据总线
├── SmartRouter         # 智能路由器
├── HookManager         # 钩子管理器
├── SkillExecutor       # 技能执行引擎
├── BatchManager        # 批量处理管理器
├── GreenfieldFlow      # 绿地项目流程
├── BrownfieldFlow      # 棕地项目流程
├── SecurityValidator    # 安全验证器
├── ProjectRegistry     # 项目注册表
├── WorkspaceManager    # 工作区管理器
├── RoleManager         # 角色管理器
├── PermissionManager   # 权限管理器
├── AuditManager        # 审计日志管理器
└── DistributedStateManager # 分布式状态管理器
```

---

## 📚 使用指南

### 基础用法

#### 1. 查看项目状态

```typescript
import { ContextDataBus } from './lib/bus/ContextDataBus';

const bus = ContextDataBus.getInstance('/project/path');
const context = bus.getContext();
console.log(context);
```

#### 2. 启动绿地项目流程

```typescript
import { GreenfieldFlow } from './core/flow/GreenfieldFlow';

const flow = new GreenfieldFlow({
  projectName: 'my-new-project',
  skipTests: false,
  batchSize: 5
});

const state = await flow.start();
console.log(`进度: ${state.progress}%`);
```

#### 3. 批量处理用户故事

```typescript
import { BatchManager } from './core/batch/BatchManager';

const batchManager = new BatchManager();
const result = await batchManager.executeBatch([
  { storyId: 'E001-S001', skillId: 'dev', action: 'develop' },
  { storyId: 'E001-S002', skillId: 'dev', action: 'develop' },
  { storyId: 'E001-S003', skillId: 'dev', action: 'develop' }
]);
```

#### 4. 执行技能

```typescript
import { SkillExecutor } from './core/skill/SkillExecutor';

const executor = new SkillExecutor();
const result = await executor.execute({
  skillId: 'my-skill',
  action: 'process',
  params: { input: 'data' }
});
```

### 高级用法

#### 1. 使用配置管理

```typescript
import { getConfig } from './src/config';

const config = getConfig();
const perfConfig = config.getPerformanceConfig();
console.log(`最大并发数: ${perfConfig.maxConcurrentFlows}`);
```

#### 2. 使用安全验证器

```typescript
import { SecurityValidator } from './core/filemanager/SecurityValidator';

const validator = new SecurityValidator('/project', {
  allowedPaths: ['/src', '/lib', '/tests'],
  allowedFileTypes: ['.ts', '.js', '.json'],
  maxFileSize: 10485760,
  enablePathTraversalCheck: true,
  enableFileTypeCheck: true,
  enableFileSizeCheck: true
});

const result = validator.validateAll('/src/file.ts', content);
if (!result.valid) {
  console.error('安全验证失败:', result.errors);
}
```

#### 3. 使用并发控制

```typescript
import { FlowConcurrencyManager } from './core/flow/FlowConcurrencyManager';

const manager = FlowConcurrencyManager.getInstance({
  maxConcurrentFlows: 5,
  flowTimeout: 300000,
  enableWaitQueue: true
});

await manager.acquireFlowSlot('flow-1', 'greenfield');
// ... 执行流程
manager.releaseFlowSlot('flow-1', 'completed');
```

---

## 📖 API 参考

### ConfigManager

配置管理器单例类。

```typescript
import { getConfig } from './src/config';

const config = getConfig();

// 获取完整配置
const appConfig = config.getConfig();

// 获取特定配置
const perfConfig = config.getPerformanceConfig();
const fileConfig = config.getFileManagerConfig();
const checkpointConfig = config.getCheckpointConfig();

// 环境判断
if (config.isProduction()) {
  // 生产环境逻辑
}

// 重载配置
config.reload();
```

### FlowConcurrencyManager

流程并发控制管理器。

```typescript
import { FlowConcurrencyManager } from './core/flow/FlowConcurrencyManager';

const manager = FlowConcurrencyManager.getInstance({
  maxConcurrentFlows: 5,
  flowTimeout: 300000
});

// 请求流程槽位
await manager.acquireFlowSlot('flow-id', 'greenfield');

// 释放流程槽位
manager.releaseFlowSlot('flow-id', 'completed');

// 获取统计信息
const stats = manager.getStats();
```

### SecurityValidator

文件安全验证器。

```typescript
import { SecurityValidator } from './core/filemanager/SecurityValidator';

const validator = new SecurityValidator(projectRoot, {
  allowedPaths: ['/src', '/lib'],
  allowedFileTypes: ['.ts', '.js'],
  maxFileSize: 10485760,
  enablePathTraversalCheck: true,
  enableFileTypeCheck: true,
  enableFileSizeCheck: true
});

// 验证所有安全规则
const result = validator.validateAll(filePath, content);
```

---

## 🔧 开发指南

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch

# CI 环境运行测试
npm run test:ci
```

### 代码规范检查

```bash
# 检查代码规范
npm run lint

# 自动修复代码规范问题
npm run lint:fix

# 格式化代码
npm run format
```

### 类型检查

```bash
# 运行 TypeScript 类型检查
npm run typecheck
```

### 项目结构

```
devflow-v5/
├── __tests__/              # 测试目录
│   ├── config/            # 配置测试
│   ├── core/              # 核心模块测试
│   ├── integration/       # 集成测试
│   └── test-utils.ts      # 测试工具
├── core/                  # 核心业务逻辑
│   ├── audit/             # 审计日志
│   ├── batch/             # 批量处理
│   ├── checkpoint/        # 断点管理
│   ├── distributed/       # 分布式状态
│   ├── errors/            # 错误体系
│   ├── filemanager/       # 文件管理
│   ├── flow/              # 流程编排
│   ├── hooks/             # 钩子系统
│   ├── permission/        # 权限管理
│   ├── router/            # 智能路由
│   ├── skill/             # 技能执行
│   ├── state/             # 状态管理
│   └── workspace/         # 工作区管理
├── lib/                   # 对外暴露层
│   ├── bus/               # 上下文总线
│   └── claude-adapter/    # Claude 适配层
├── src/                   # 源代码
│   └── config/            # 配置管理
├── .env.example           # 环境变量示例
├── .eslintrc.js           # ESLint 配置
├── .prettierrc            # Prettier 配置
├── .editorconfig          # EditorConfig 配置
├── jest.config.ts         # Jest 配置
├── tsconfig.json          # TypeScript 配置
├── package.json           # 项目配置
└── package-lock.json      # 依赖锁定文件
```

### 测试覆盖率

当前测试覆盖率：

| 组件 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|-----------|-----------|-----------|
| 整体 | **90%+** | **85%+** | **90%+** |

| 测试套件 | 测试数 | 通过率 |
|---------|-------|--------|
| 26 | 642 | 99.5% |

---

## ❓ 常见问题

### 1. 如何安装 DevFlow v5？

```bash
git clone https://github.com/pwl1987/devflow-v5.git
cd devflow-v5
npm install
```

### 2. 如何运行测试？

```bash
npm test
```

### 3. 如何配置环境变量？

复制 `.env.example` 为 `.env`，然后修改其中的值。

### 4. 如何添加新的文件类型到白名单？

在 `.env` 文件中修改 `ALLOWED_FILE_TYPES` 变量：

```bash
ALLOWED_FILE_TYPES=.ts,.js,.json,.md,.txt,.yaml,.yml,.py
```

### 5. 如何调整最大并发流程数？

在 `.env` 文件中修改 `MAX_CONCURRENT_FLOWS` 变量：

```bash
MAX_CONCURRENT_FLOWS=10
```

### 6. 测试失败怎么办？

```bash
# 查看详细的测试失败信息
npm test -- --verbose

# 运行特定测试文件
npm test -- __tests__/config/ConfigManager.test.ts
```

### 7. 如何贡献代码？

1. Fork 项目
2. 创建特性分支
3. 提交 Pull Request
4. 确保所有测试通过

---

## 📝 更新日志

### v5.0.0 (2026-03-10)

#### 新增
- ✨ 添加环境配置管理模块
- ✨ 添加流程并发控制管理器
- ✨ 添加 ESLint/Prettier/EditorConfig 配置
- ✨ 添加环境变量示例文件
- ✨ 改进测试覆盖率至 99.5%

#### 改进
- 🔧 优化项目工程化配置
- 🔧 完善错误处理机制
- 🔧 增强代码规范检查

#### 文档
- 📚 添加完整的用户使用手册
- 📚 更新 API 参考文档

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

---

## 📮 联系方式

- 作者: pwl1987
- GitHub: https://github.com/pwl1987/devflow-v5
- Email: devflow@example.com

---

**祝使用愉快！** 🎉
