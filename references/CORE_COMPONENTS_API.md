# DevFlow v5 核心组件接口索引

**文档版本**: v1.0
**最后更新**: 2026-03-10
**状态**: 接口契约已完成，方法实现待完成

---

## 概述

本文档列出了DevFlow v5的4个核心组件及其接口定义，供开发参考。

---

## 1. ContextDataBus（上下文数据总线）

**文件路径**: `lib/bus/ContextDataBus.ts`

**职责**: 项目上下文数据的唯一读写入口

**核心接口**: `IContextDataBus`

### 核心方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| getContext() | - | Promise<ReadonlyProjectContext> | 获取只读上下文 |
| updateContext() | updates: Partial<ProjectContext>, source: string | Promise<void> | 更新上下文 |
| hasContext() | - | Promise<boolean> | 检查上下文是否存在 |
| getAsset() | assetKey: string | Promise<AssetInfo \| null> | 获取资产元数据 |
| writeAsset() | assetKey: string, content: any, source: string | Promise<AssetInfo> | 写入资产 |
| lockAsset() | assetKey: string | Promise<void> | 锁定资产 |
| unlockAsset() | assetKey: string | Promise<void> | 解锁资产 |
| isAssetLocked() | assetKey: string | Promise<boolean> | 检查资产锁定状态 |
| logExecution() | skill: string, action: string, status: 'success' \| 'failure' | Promise<void> | 记录执行日志 |

### 设计特点

- **基于路径实例化**: `ContextDataBus.getInstance(projectRoot)`
- **单例缓存**: 同一路径返回同一实例
- **只读视图**: `ReadonlyProjectContext` 深度只读

---

## 2. SmartRouter（智能路由层）

**文件路径**: `core/router/SmartRouter.ts`

**职责**: 检测项目场景，推荐流程模式，决策路由路径

**核心接口**:
- `ISceneDetectionStrategy` - 场景检测策略
- `IModeRecommendStrategy` - 模式推荐策略
- `ICommandIntentParser` - 命令意图解析
- `IDependencyChecker` - 依赖检查

### 核心方法

| 组件 | 方法 | 参数 | 返回值 | 说明 |
|------|------|------|--------|------|
| SmartRouter | route() | projectRoot, command?, args? | Promise<RoutingResult> | 路由决策 |
| ISceneDetectionStrategy | detect() | projectRoot, context? | Promise<SceneDetectionResult> | 场景检测 |
| IModeRecommendStrategy | recommend() | scene, context? | Promise<ModeRecommendationResult> | 模式推荐 |
| ICommandIntentParser | parse() | input: string | CommandIntent | 命令解析 |
| IDependencyChecker | check() | command, context | Promise<{passed, missing_items}> | 依赖检查 |

### 设计特点

- **策略模式**: 所有策略可插拔
- **依赖注入**: 构造函数注入所有策略
- **纯函数决策**: 相同输入必定相同输出

---

## 3. HookManager（钩子系统）

**文件路径**: `core/hooks/HookManager.ts`

**职责**: 管理生命周期钩子的注册、触发、移除

**核心接口**: `IHookManager`

### 钩子阶段

```typescript
type HookPhase =
  | 'pre-project'    | 'post-project'
  | 'pre-phase'      | 'post-phase'
  | 'pre-story'      | 'post-story'
  | 'pre-skill'      | 'post-skill'
  | 'pre-commit'     | 'post-commit';
```

### 核心方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| register() | hook: HookConfig | Promise<string> | 注册钩子 |
| unregister() | hookId: string | Promise<void> | 注销钩子 |
| getHooks() | phase: HookPhase | Promise<HookRegistration[]> | 获取指定阶段钩子 |
| trigger() | phase, context | Promise<HookExecutionResult[]> | 触发钩子 |
| clearAll() | - | Promise<void> | 清除所有钩子 |
| loadFromConfig() | hookConfigs: HookConfig[] | Promise<void> | 批量加载配置 |
| exportConfig() | - | Promise<HookConfig[]> | 导出配置 |

### 内置钩子模板

| 模板ID | 阶段 | 命令 | 说明 |
|--------|------|------|------|
| code-quality-pre-commit | pre-commit | npm run lint && npm run test | 代码质量检查 |
| docs-post-story | post-story | npm run docs:generate | 文档生成 |
| test-post-skill | post-skill | npm run test -- --coverage | 测试执行 |
| notify-post-phase | post-phase | echo "Phase completed" | 通知发送 |

---

## 4. ChangeDetector（变更检测器）

**文件路径**: `core/filemanager/ChangeDetector.ts`

**职责**: 检测用户手动修改，文件哈希对比，分级处理

**核心接口**: `IChangeDetector`

### 核心方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| detectFileChange() | filePath, storedHash | Promise<ChangeDetectionResult> | 检测单文件变更 |
| scanProjectChanges() | projectRoot | Promise<ChangeReport> | 扫描项目变更 |
| getFileHash() | filePath | Promise<FileHashInfo> | 获取文件哈希 |
| batchGetFileHashes() | filePaths: string[] | Promise<Map<string, FileHashInfo>> | 批量获取哈希 |
| evaluateChangeSeverity() | change, context | Promise<ChangeHandlingAction> | 评估变更严重程度 |
| backupFile() | filePath, backupDir | Promise<string> | 备份文件 |
| detectAssetChange() | assetKey, context | Promise<ChangeDetectionResult \| null> | 检测资产变更 |
| applyWriteStrategy() | filePath, newContent, strategy | Promise<boolean> | 应用写入策略 |

### 变更分级

| 级别 | 处理方式 | 说明 |
|------|----------|------|
| safe | overwrite | 普通文件，可以安全覆盖 |
| warning | preserve | 核心资产被修改，建议保留 |
| danger | conflict | 已锁定资产被修改，禁止操作 |

### 资产文件识别

```typescript
ASSET_FILE_PATTERNS = {
  prd: [/_bmad-output\/planning-artifacts\/.*prd.*\.md$/i],
  architecture: [/_bmad-output\/planning-artifacts\/.*architecture.*\.md$/i],
  ux_design: [/_bmad-output\/planning-artifacts\/.*ux.*\.md$/i],
  stories: [/_bmad-output\/story-files\/.*\.md$/i],
  product_brief: [/_bmad-output\/planning-artifacts\/.*brief.*\.md$/i],
}
```

---

## 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        SmartRouter                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ SceneDetector    │  │ ModeRecommender  │  │ CommandParser│  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────────┐                        │
│                     │ ContextDataBus   │                        │
│                     │   (Read Only)    │                        │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        HookManager                              │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────────┐                        │
│                     │ ContextDataBus   │                        │
│                     │   (Read Only)    │                        │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      ChangeDetector                             │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────────┐                        │
│                     │ ContextDataBus   │                        │
│                     │   (Read Only)    │                        │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实现优先级

### 第一批（立即实现）
1. **ContextDataBus** - 核心读写功能
2. **SmartRouter** - 默认策略实现
3. **HookManager** - 钩子执行逻辑
4. **ChangeDetector** - 哈希检测逻辑

### 第二批（后续迭代）
- ContextDataBus 事件订阅
- SmartRouter 动态规则加载
- HookManager 复杂编排
- ChangeDetector 智能合并

---

> 本文档作为开发参考，请确保实现时严格遵循接口契约
