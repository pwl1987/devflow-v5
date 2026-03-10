---
name: devflow
version: "5.0.0"
description: |
  DevFlow v5 - 企业级开发流程编排器

  TRIGGER when: 用户询问项目进度、查看 BMAD 工作流状态、需要断点续传开发、
  或说"查看状态"、"继续开发"、"开始新项目"、"批量处理"、"绿地项目"、"棕地项目"等。

  核心能力：
  - 智能路由：自动检测项目类型（绿地/棕地/中途）并推荐流程模式（Quick/Standard/Rigorous）
  - 批量处理：支持批量故事开发，带容错策略和上下文隔离
  - 断点续传：阶段级+步骤级双checkpoint机制
  - 技能编排：原子Skill + 组合Skill架构
  - 团队协作：跨会话状态识别与轻协作能力

  DO NOT TRIGGER when:
  - 用户只问简单的 Git 操作问题 → 使用 zcf:git-commit 或 zcf:git-rollback
  - 用户只是想运行或编写测试代码 → 使用 everything-claude-code:tdd
  - 用户在创建与 BMAD/项目管理无关的文档
  - 用户询问具体的代码实现问题
---

# DevFlow v5 - 企业级开发流程编排器

## 立即执行规则

当用户请求匹配以下模式时，**立刻执行对应逻辑**：

| 触发词 | 执行 | 优先级 |
|-------|------|--------|
| 查看状态 / 状态 | 智能状态检测 | P0 |
| 继续开发 / 断点续传 | 断点检测 → 智能推荐 | P0 |
| 进度 / 仪表盘 | 生成进度报告 | P0 |
| 开始新项目 / 新项目 | 智能路由 → 项目类型检测 | P0 |
| 批量处理 / batch | 批量处理逻辑 | P1 |
| 绿地项目 | 绿地项目流程 | P1 |
| 棕地项目 | 棕地项目流程 | P1 |
| 检查环境 / env | 环境检测 | P2 |
| 代码质量 / quality | 质量检测 | P2 |
| 测试 / test | 多技术栈测试 | P2 |

---

## 核心架构

### 分层架构

```
┌─────────────────────────────────────────┐
│  用户交互层 (SKILL.md)                   │
│  /devflow [命令] [参数]                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  智能路由层 (core/router/)              │
│  - 项目类型检测 (绿地/棕地/中途)          │
│  - 流程模式推荐 (Quick/Standard/Rigorous)│
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  流程编排层 (lib/)                      │
│  - 绿地项目流程                          │
│  - 棕地项目流程                          │
│  - 批量处理流程                          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Skill 适配层 (lib/adapters/)           │
│  - Skill编排适配                         │
│  - 技术栈适配                            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Skill 调用层 (lib/skills/)             │
│  - BMAD skills                           │
│  - ECC skills                            │
│  - ZCF skills                            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  状态持久化层 (core/state/)              │
│  - 项目上下文                            │
│  - Checkpoint管理                        │
│  - 审计日志                              │
└─────────────────────────────────────────┘
```

---

## 智能路由逻辑

### 项目类型检测

```bash
# 绿地项目检测
if [ -d "_bmad-output/planning-artifacts" ]; then
    echo "绿地项目"
else
    echo "非BMAD项目"
fi

# 棕地项目检测
if [ -f "package.json" ] || [ -f "requirements.txt" ]; then
    echo "棕地项目"
fi

# 中途项目检测
if [ -f "_state/project-context.json" ]; then
    echo "中途项目"
fi
```

### 流程模式推荐

| 项目特征 | 推荐模式 | 理由 |
|---------|---------|------|
| 空目录 | Quick | 快速启动，最小仪式 |
| 生产仓库 | Standard | 平衡效率与质量 |
| 合规/核心系统 | Rigorous | 质量优先，完整流程 |

---

## 核心命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/devflow` | 智能状态检测 | 查看项目状态和推荐操作 |
| `/devflow new` | 启动新项目 | 绿地/棕地项目自动识别 |
| `/devflow continue` | 断点续传 | 从中断处继续开发 |
| `/devflow batch [n]` | 批量处理 | 自动完成n个故事 |
| `/devflow story <id>` | 单故事开发 | 定向开发指定故事 |
| `/devflow review` | 代码评审 | 多技术栈代码检查 |
| `/devflow test` | 运行测试 | 统一测试报告 |
| `/devflow commit` | 智能提交 | Git提交 + 推送 + PR |

---

## 批量处理

### 批量策略

```bash
# 默认批量（Standard模式）
/devflow continue --batch=5

# 快速模式批量
/devflow continue --batch=3 --mode=quick

# 容错策略
/devflow continue --batch=5 --on-failure=pause   # 失败暂停（默认）
/devflow continue --batch=5 --on-failure=skip    # 跳过失败
/devflow continue --batch=5 --on-failure=record  # 记录后继续
```

### WIP限制

| 模式 | 默认批量 | 最大批量 |
|------|---------|---------|
| Quick | 3 | 5 |
| Standard | 5 | 8 |
| Rigorous | 禁用 | 禁用 |

---

## 状态持久化

### 目录结构

```
_state/
├── project-context.json    # 项目上下文
├── preferences.json         # 用户偏好
├── checkpoints/             # Checkpoint存储
│   ├── phases/             # 阶段级checkpoint
│   ├── stories/            # 故事级checkpoint
│   └── steps/              # 步骤级checkpoint
└── audit/                  # 审计日志
```

### Checkpoint机制

- **阶段级checkpoint**: 每个阶段完成后自动创建
- **故事级checkpoint**: 每个故事完成后自动创建
- **步骤级checkpoint**: 每个Skill完成后自动创建（可选）

---

## 技术栈适配

支持的技术栈：

**前端**: React, Vue, Angular, Next.js, Nuxt.js
**后端**: Node.js, Python (FastAPI/Flask/Django), Java (Spring Boot), Go
**数据库**: PostgreSQL, MySQL, MongoDB, Redis
**测试**: Vitest, Jest, pytest, JUnit

---

## 调用其他 Skills

| 请求 | Skill |
|------|-------|
| 头脑风暴 | /party-mode |
| 产品简报 | /create-product-brief |
| PRD | /create-prd |
| 架构设计 | /create-architecture |
| 故事拆分 | /create-epics-and-stories |
| 故事开发 | /dev-story |
| 代码评审 | /bmad-bmm-code-review |
| TDD测试 | /tdd |
| E2E测试 | /e2e |
| Git提交 | /git-commit |

---

## 帮助与文档

- 详细文档: `references/` 目录
- 使用示例: `templates/` 目录
- 问题排查: 见下方故障排除

---

## 故障排除

### Skill未识别

```
问题: /devflow 提示"未识别"

解决:
1. 重启 Claude Code
2. 检查 SKILL.md 是否存在
3. 确认 description 格式正确
```

### 状态不同步

```
问题: /devflow 显示的进度与实际不符

解决:
1. 检查 _state/project-context.json
2. 执行 /devflow --resync 重新同步
3. 手动更新状态文件
```

### 批量处理失败

```
问题: 批量处理中途失败

解决:
1. 查看 _state/checkpoints/ 找到失败点
2. 执行 /devflow continue 从失败点继续
3. 使用 --on-failure=skip 跳过失败故事
```

---

## 版本历史

- **v5.0.0**: 全新架构
  - 智能路由层
  - 批量处理能力
  - 双checkpoint机制
  - 技术栈适配
  - 团队协作支持

- **v4.0.0**: 单人项目智能助手
  - 状态持久化
  - 断点续传
  - 多技术栈支持

---

> **提示**: 遇到任何问题，执行 `/devflow` 查看项目状态和建议操作。
