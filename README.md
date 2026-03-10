# DevFlow v5

<div align="center">

**企业级开发流程编排器**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
[![Tests](https://img.shields.io/badge/tests-639%2F642 passing-brightgreen)
[![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
[![License](https://img.shields.io/badge/license-MIT-green)
[![Version](https://img.shields.io/badge/version-5.0.0-blue)

智能路由 · 批量处理 · 断点续传 · 团队协作

</div>

---

## 📖 简介

[DevFlow v5](https://github.com/pwl1987/devflow-v5) 是一个专为 **Claude Code** 设计的企业级开发流程编排器。它能够智能识别项目类型（绿地/棕地/中途），自动推荐最佳流程模式（Quick/Standard/Rigorous），并支持批量处理、断点续传、技能编排和团队协作。

### 🎯 核心特性

- 🧠 **智能路由** - 自动识别项目类型并推荐最佳流程
- 🚀 **流程编排** - 支持 3 种流程模式：Quick / Standard / Rigorous
- 📦 **批量处理** - 高效处理多个用户故事，支持失败策略
- 💾 **断点续传** - 流程中断后可从断点恢复，不丢失进度
- 🔧 **技能编排** - 灵活的技能执行引擎，支持自定义技能
- 👥 **团队协作** - 基于角色的权限管理（RBAC）
- 📊 **审计日志** - 完整的操作审计追踪，支持合规要求
- 🌐 **分布式状态** - 跨项目状态同步和冲突解决
- 🔒 **安全加固** - 路径遍历防护、文件类型校验、大小限制

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/pwl1987/devflow-v5.git
cd devflow-v5

# 安装依赖
npm install

# 运行测试
npm test
```

### 基础用法

```typescript
import { ContextDataBus } from './lib/bus/ContextDataBus';
import { GreenfieldFlow } from './core/flow/GreenfieldFlow';

// 1. 获取项目上下文
const bus = ContextDataBus.getInstance('/project/path');
const context = bus.getContext();

// 2. 启动绿地项目流程
const flow = new GreenfieldFlow({
  projectName: 'my-new-project',
  mode: 'standard',
  skipTests: false
});

const state = await flow.start();
console.log(`进度: ${state.progress}%`);
```

### 作为 Claude Skill 使用

```bash
# 安装为 Claude Code 技能
mkdir -p ~/.claude/skills
cp -r devflow-v5 ~/.claude/skills/devflow-v5
```

然后在 Claude Code 中直接使用：

```
请使用 DevFlow 帮我开发一个新项目
```

---

## 📋 功能概览

### 项目类型支持

| 项目类型 | 描述 | 流程阶段 |
|---------|------|---------|
| **绿地项目** | 从头开始的新项目 | init → research → design → develop → test → deploy |
| **棕地项目** | 现有项目的改造 | analysis → assessment → refactor → test → deploy |
| **中途项目** | 已有基础的半成品 | 智能评估并推荐流程 |

### 流程模式

| 模式 | 速度 | 质量检查 | 适用场景 |
|------|------|---------|---------|
| **Quick** | ⚡⚡⚡ | 基础 | 快速原型、MVP 验证 |
| **Standard** | ⚡⚡ | 标准 | 日常开发、常规功能 |
| **Rigorous** | ⚡ | 严格 | 生产级项目、关键业务 |

---

## 🏗️ 项目架构

```
DevFlow v5
├── core/                      # 核心业务逻辑
│   ├── audit/                 # 审计日志管理
│   ├── batch/                 # 批量处理管理
│   ├── checkpoint/            # 断点管理
│   ├── distributed/           # 分布式状态管理
│   ├── errors/                # 统一错误体系
│   ├── filemanager/           # 文件管理与安全验证
│   ├── flow/                  # 流程编排
│   │   ├── GreenfieldFlow.ts   # 绿地项目流程
│   │   ├── BrownfieldFlow.ts   # 棕地项目流程
│   │   └── FlowConcurrencyManager.ts
│   ├── hooks/                 # 钩子系统
│   ├── permission/            # 权限管理 (RBAC)
│   ├── router/                # 智能路由
│   ├── skill/                 # 技能执行引擎
│   ├── state/                 # 状态管理
│   └── workspace/             # 工作区管理
├── lib/                       # 对外暴露层
│   ├── bus/                   # 上下文数据总线
│   └── claude-adapter/        # Claude Skills 适配层
├── src/                       # 源代码
│   └── config/                # 配置管理
├── __tests__/                  # 测试目录
└── references/                # 参考文档
```

### 设计原则

DevFlow v5 严格遵循以下设计原则：

- **SOLID 原则** - 单一职责、开闭原则、里氏替换、接口隔离、依赖倒置
- **TDD 原则** - RED → GREEN → IMPROVE 测试驱动开发
- **KISS 原则** - 保持简单，避免过度设计
- **DRY 原则** - 不重复自己，复用已有代码
- **YAGNI 原则** - 不过度设计，只实现当前需要的功能

---

## 📊 测试

### 测试统计

| 指标 | 数值 |
|------|------|
| 测试套件 | 26 |
| 总测试数 | 642 |
| 通过率 | **99.5%** (639/642) |
| 代码覆盖率 | **90%+** |

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式（开发时使用）
npm run test:watch

# CI 环境
npm run test:ci
```

---

## 📚 文档

### 用户文档

- 📖 [用户使用手册](USER_GUIDE.md) - 完整的使用指南和 API 参考
- 🔧 [配置说明](.env.example) - 环境变量配置示例

### 开发文档

- 📐 [架构设计](docs/ARCHITECTURE.md) - 系统架构和设计决策
- 🔄 [更新日志](IMPLEMENTATION_PROGRESS.md) - 实施进度和变更记录

### 技术文档

- 💻 [API 参考](USER_GUIDE.md#api-参考) - 完整的 API 文档
- 🧪 [测试指南](docs/TESTING.md) - 测试编写指南

---

## 🛠️ 开发

### 环境要求

- Node.js >= 18.0.0
- TypeScript >= 5.3.0
- npm 或 yarn

### 开发脚本

```bash
# 代码规范检查
npm run lint

# 自动修复代码规范问题
npm run lint:fix

# 格式化代码
npm run format

# TypeScript 类型检查
npm run typecheck
```

### 代码规范

DevFlow v5 使用 ESLint 和 Prettier 进行代码规范管理：

- **ESLint** - 代码质量检查和错误检测
- **Prettier** - 代码格式化
- **EditorConfig** - 编辑器配置统一

---

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 代码格式调整
- `refactor:` - 重构
- `perf:` - 性能优化
- `test:` - 测试相关
- `chore:` - 构建/工具链相关

---

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 👥 作者

**pwl1987**

- GitHub: [@pwl1987](https://github.com/pwl1987)
- Email: devflow@example.com

---

## 🙏 致谢

感谢所有为 DevFlow v5 做出贡献的开发者！

---

## 📮 联系方式

- 问题反馈: [GitHub Issues](https://github.com/pwl1987/devflow-v5/issues)
- 功能建议: [GitHub Discussions](https://github.com/pwl1987/devflow-v5/discussions)

---

<div align="center">

**⭐ 如果觉得有用，请给一个 Star！**

[⬆️ Back to Top](#devflow-v5)

</div>
