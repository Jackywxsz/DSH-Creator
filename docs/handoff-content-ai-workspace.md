# Handoff：内容创作台入口与 AI 并排工作区重构

日期：2026-09-02  
状态：已按修正版实施，待真实 Desktop 视觉验收  
目标项目：`jacky-creator`

## 1. 结论

当前方案需要撤回“侧栏底部弱入口 + 内容全屏覆盖层”的方向，恢复清晰的三域结构：

> 会话 / 内容 / 运营

修正版保留宿主 `ui-sidebar` 为 `sidebar` slot 的唯一 owner，只向 `sidebar.footer.action` 注入一个 “Jacky Creator” 入口。入口打开插件自己的局部工作区：工作区左侧恢复“会话 / 内容 / 运营”和品牌视觉；内容详情停靠在原生 AI 会话左侧，当前 Harness 会话和输入框始终保留。插件不得注册或替换整个 `sidebar` slot，也不得再用不透明 `inset: 0` surface 覆盖 AppFrame。

这是一次 UI 架构纠偏，不涉及内容数据、Cockpit schema、工具协议、API Key 或磁盘目录迁移。

## 2. 当前问题与根因

### 当前可见问题

1. “内容”和“运营”放在宿主侧栏底部，入口权重太低，用户不容易理解它们是一级工作域。
2. 点击“内容”后，`FullscreenContent` 通过 `shell.overlay` 和 `FullscreenSurface` 使用 `inset: 0` 覆盖整个 AppFrame。
3. 内容列表虽然出现了，但原生 AI 会话和输入框被遮住，内容创作与 AI 协作被人为拆成两个孤立模式。
4. 当前实现与项目既有文档冲突：既有产品约定要求“列表与检查器在对话旁边，聊天不关”。

### 代码根因

- `src/client/index.tsx` 只向 `sidebar.footer.action` 注册入口，缺少显眼的一级域切换。
- `FullscreenContent` 把 `ContentSidebarPanel` 和 `ContentInspector` 一起装进全屏 surface。
- `shell.overlay` 是 frame-wide 浮层；当前全屏 CSS 主动阻断了底层会话的可见性和操作性。
- 项目已有的 `ContentSidebarPanel`、`ContentInspector`、`applyConversationInset()` 和 `CockpitSessionBridge` 已经覆盖大部分正确能力；旧 `OilSidebarRoot` 只能作为视觉参考，不能恢复为宿主 sidebar owner。

## 3. 产品结构

### 3.1 桌面端目标布局

```text
┌─────────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Jacky Creator           │ 当前内容详情                 │ 当前 Harness AI 会话          │
│ [会话] [内容] [运营]     │ 概览/脚本/演示/视频/...       │ 历史消息                       │
│                         │                              │                               │
│ 内容模式：               │ 内容事实、资产和制作动作       │ AI 回复                        │
│ 搜索 / 新建 / 刷新       │                              │                               │
│ 内容列表                 │                              │ 当前内容上下文条               │
│                         │                              │ 原生输入框                     │
└─────────────────────────┴──────────────────────────────┴──────────────────────────────┘
       240–320px                    420–720px                       自适应，至少 480px
```

### 3.2 三个一级入口

- **会话**：侧栏主体显示 Harness 原有工作区和会话列表；中央会话使用完整宽度。
- **内容**：侧栏主体显示内容搜索、新建、刷新和列表；未选择内容时，中央仍是完整 AI 会话；选择内容后，内容详情停靠在会话左侧。
- **运营**：侧栏主体显示运营导航；中央显示运营工作台。底层会话不销毁，返回“会话”或“内容”后恢复原 session 和草稿。

三个入口必须位于侧栏上部品牌区下方，始终可见，不依赖滚动，也不藏在设置按钮附近。

## 4. 关键交互决策

### 4.1 内容与 AI 使用同一个会话

不新建“AI 助手面板”，不嵌入第二个 composer，不维护第二份消息状态。右侧直接保留 Harness 当前 session：

- 内容切换不创建新 session。
- 内容切换不清空或提交用户草稿。
- AI 正在回复时仍可浏览内容详情，但不能用快捷动作覆盖输入框。
- 没有 session 时，内容列表仍可浏览；AI 区保留 Harness 原生空态和“新会话”入口。

### 4.2 内容选择与详情显示

- 点击“内容”只切换侧栏，不自动弹出上一次详情，以免一进入就压缩会话。
- 点击某条内容后打开 `ContentInspector`，并记住 `selectedId`。
- 切到“会话”时隐藏详情但保留 `selectedId`；再次进入“内容”时恢复上一次选中项，由用户点击该项或“继续上次内容”后再展开详情。
- 点击详情关闭按钮只关闭详情，不退出“内容”域，内容列表和 AI 会话仍保留。
- 从运营管线点击“打开内容”时，切换到“内容”域、选中对应 `contentId` 并直接展开详情。

### 4.3 AI 上下文条

在现有 `conversation.input.dock` 中扩展 `CockpitSessionBridge`，在原生输入框上方显示轻量上下文条：

```text
当前内容：DSH Creator 创作者工作台    [引用到输入框] [取消选择]
```

约束：

- 上下文条只在“内容”域且存在 `selectedId` 时显示。
- “引用到输入框”只插入已有 `/current content` 引用，不自动发送。
- 如果输入框已有文字，只在光标前或文本末尾追加引用，不覆盖、不清空、不自动提交。
- 上下文条不能宣称模型已经读取内容；只有引用进入消息后，Agent 才按现有工具和文件规则读取真实内容。
- `sendCockpitInstruction()` 的现有自动提交路径继续用于明确的运营按钮，不与上下文条混用。

### 4.4 尺寸与响应式

- 视口宽度 **≥ 1440px**：内容详情默认 560px，可拖到 420–720px；AI 会话至少保留 520px。
- 视口宽度 **1180–1439px**：详情自动限制在 420–520px；AI 会话至少保留 480px。
- 视口宽度 **< 1180px**：不强行并排。详情变成中央抽屉，顶部固定“返回对话”；关闭后立即恢复完整 AI 输入框。
- 视口宽度 **≤ 620px**：侧栏使用现有 56px rail；内容列表和详情采用单层切换，禁止页面级横向滚动。
- 所有宽度让步都只改变浏览器 UI，不改持久化内容数据。

最脆弱的假设是：Harness 当前仍保留 `[data-conversation-scroll]` 这一兼容接缝。如果宿主升级移除该节点，详情不能再通过 `padding-left` 给会话让位；此时必须降级为可关闭抽屉，不能继续覆盖输入框并假装并排成功。

## 5. 推荐实现方案

### Phase 1：恢复三域入口与内容/AI 并排

此阶段完成后必须独立可用，即使 Phase 2 永远不做，用户也能从明显入口进入内容列表，并在内容详情旁继续使用 AI。

1. 绝对不要注册 `OilSidebarRoot` 或任何其他组件到整个 `sidebar` slot；宿主 `ui-sidebar` 必须继续独占该 slot 及其 child slots。
2. `sidebar.footer.action` 只注册一个 `jacky-creator-launcher`，不保留“内容 / 运营”双 footer 入口。
3. `shell.overlay` 只注册一个局部 `CreatorWorkspace`。根层透明且 click-through，只有插件导航、内容详情和运营页面恢复 pointer events。
4. 内容域复用 `ContentSidebarPanel` 与 `ContentInspector`：桌面端检查器通过 `applyConversationInset()` 为原生会话让位；小于 1180px 时清除 inset 并降级为可关闭抽屉。
5. 选中内容与详情可见性分离：切到会话或运营时隐藏详情但保留 `selectedId`；从运营打开内容时显式重新打开详情。
6. 运营域复用 `OperationsSidebarPanel` / `OperationsWorkspace`。切回会话会卸载插件工作区，但不会销毁宿主 session 或 composer 草稿。
7. 清理仅属于临时全屏和双 footer 方案的文件；保留通用 Escape 的 modal ownership 行为。

Phase 1 预计涉及或删除 8–10 个文件，超过 8 个文件的原因是需要同时撤回临时全屏实现及其测试，而不是扩大产品功能。

### Phase 2：增加 AI 上下文条

此阶段独立增强协作效率，不改变 Phase 1 的布局可用性。

1. 扩展 `src/client/operations/sessionBridge.tsx`，让 bridge 在维持现有 active session 能力的同时渲染当前内容上下文条。
2. 通过绑定组件注入读取当前内容标题所需的最小 `getContent` 能力；不引入新 service、store 或 API。
3. 增加“引用到输入框”和“取消选择”两项动作。
4. 保留用户草稿，禁止自动发送。
5. 为上下文条增加独立、局部作用域 CSS，不修改 Harness 全局 composer 样式。

Phase 2 预计涉及 3–4 个文件。

### Phase 3：文档与真实桌面验收

此阶段只在 Phase 1、2 均通过后更新事实文档，不提前把未实现设计写成现状。

1. 更新 `docs/implementation.md`：明确三域入口、内容详情与会话共存、响应式降级。
2. 更新 `docs/cockpit-design.md`：删除“内容全屏模式”的描述，固定桌面三栏关系。
3. 在正式链接 profile 重新构建并重启 DSH Desktop。
4. 保存宽屏、1280px、390px 三组验收截图。

## 6. 文件级交接

### 必改

- `src/client/index.tsx`
  - 只注册一个 footer launcher 和一个局部 workspace overlay。
  - 不注册整个 `sidebar` slot；内容详情同时检查 content 域、selection 和详情可见性。
- `src/client/sidebar/CreatorLauncher.tsx`
  - 宿主 footer 唯一入口，只负责打开或退出插件工作区。
- `src/client/sidebar/CreatorWorkspace.tsx`
  - 在 `shell.overlay` 内承载品牌、三域切换、内容列表和运营导航；不得声明宿主 sidebar child slots。
- `src/client/sidebar/CreatorWorkspace.css`
  - 根层 click-through；桌面 sidecar 与窄屏单层切换不得阻断原生会话。
- `src/client/contentSelection.ts`
  - 明确“选中内容”和“详情可见”是两个状态条件，保留完整 inset 恢复路径。
- `src/client/ContentInspector.tsx`
  - 详情仅在内容域显示。
  - 关闭详情不退出内容域。
- `src/client/ContentInspector.css`
  - 桌面并排宽度约束和窄屏抽屉降级。
- `src/client/operations/sessionBridge.tsx`
  - Phase 2 增加当前内容上下文条，保留现有提交保护。
- `tests/contentSelection.test.ts`
  - 覆盖切域隐藏详情但保留 selection、恢复 inset、窄屏降级。
- `tests/sidebarCoexistence.test.ts`
  - 从“footer 双入口”断言改为“三域 tab + 宿主 child slots 继续存在”。

### 需要审计后删除

以下文件属于当前临时全屏/弱入口方案。实施前先用 `rg` 确认没有其他调用；确认无调用后删除：

- `src/client/sidebar/FullscreenSurface.tsx`
- `src/client/sidebar/FullscreenSurface.css`
- `src/client/sidebar/OperationsLauncher.tsx`
- `src/client/sidebar/OperationsLauncher.css`
- `src/client/sidebar/fullscreenEscape.ts`（通用行为迁到 `workspaceEscape.ts`）
- `tests/fullscreenEscape.test.ts`

如果运营工作台仍需要其中的 Escape 行为，则只保留通用 Escape handler；不得为了保留一个 helper 而继续保留全屏内容架构。

### 文档

- `docs/implementation.md`
- `docs/cockpit-design.md`
- 本文件 `docs/handoff-content-ai-workspace.md`

## 7. 不做什么

- 不创建第二套 AI 聊天窗口。
- 不替换 Harness 当前 session、消息历史或 composer。
- 不新增 API Key、模型配置、外部服务或网络依赖。
- 不修改内容目录、Cockpit schema、`contentId` 关联规则或发布数据。
- 不把运营页面全部改成与 AI 并排；本轮重点只保证内容创作与 AI 协作闭环。
- 不顺手重构内容详情内部七个资产页。
- 不保留“底部入口”和“顶部三域入口”两套重复导航。

## 8. 验证计划

### 自动化

按顺序执行：

```bash
pnpm typecheck
pnpm vitest run tests/sidebarCoexistence.test.ts tests/contentSelection.test.ts tests/sessionBridge.test.ts tests/workspaceEscape.test.ts
pnpm test
pnpm build
```

通用 Escape/modal ownership 行为由 `tests/workspaceEscape.test.ts` 覆盖。

### 必测行为

1. 宿主首屏无需滚动即可看到唯一 “Jacky Creator” 入口；点击后无需滚动即可看到“会话 / 内容 / 运营”。
2. 进入“内容”后，工作区导航出现真实内容列表、搜索、新建和刷新。
3. 未选择内容时，AI 会话和输入框保持完整宽度。
4. 选择内容后，内容详情与当前 AI 会话同时可见、同时可操作。
5. 输入框已有草稿时切换内容，不丢失、不覆盖、不自动提交。
6. 关闭详情后仍停留在内容列表，AI 会话恢复宽度。
7. 切到“会话”后详情隐藏；再次进入“内容”时 selection 仍可恢复。
8. 从运营管线打开内容时，进入对应内容详情，右侧仍是同一 session。
9. AI 正在回复时切换内容，不中断 session。
10. 插件卸载或热重载后，宿主会话 padding、transition 和 sidebar 状态完整恢复。

### 视觉与真机

- DSH Desktop 宽屏：验证三栏并排，AI composer 完整可见。
- 1280px：验证详情被约束，AI 区不小于 480px，无页面级横向滚动。
- 390px：验证内容列表/详情/会话单层切换，可随时返回对话。
- 浅色、深色各一次。
- `prefers-reduced-motion` 下无依赖动画。
- 键盘 Tab 可到达三域入口、内容列表、详情关闭和上下文条操作；焦点样式清晰。

## 9. 完成标准

满足以下全部条件才算完成：

- 用户在首屏能立即识别三个一级工作域。
- 打开内容并选择一条内容后，内容详情和 AI 对话框在桌面端同时可见。
- 不存在第二套聊天状态或自动覆盖草稿的行为。
- 内容事实仍只来自真实内容目录，运营仍只通过 `contentId` 关联。
- TypeScript、定向测试、全量测试和构建全部通过。
- DSH Desktop 真机截图证明：当前截图中的“全屏内容孤岛”已变为“内容 + AI 并排”。

## 10. 风险与回滚

### 主要风险

1. 工作区通过宿主当前 sidebar / conversation 几何定位局部 sidecar；Harness 布局 DOM 或 grid 合同升级后需要重新核对。
2. `applyConversationInset()` 依赖当前宿主的 `[data-conversation-scroll]` 接缝；宿主升级后必须验证。
3. 超窄窗口无法同时容纳内容详情和 AI，会按计划降级为抽屉，而不是强行并排。

### 回滚

- 本次不迁移数据，回滚只涉及 Client UI 代码和构建产物。
- 回滚到当前 footer launcher 版本不会删除内容、运营 state 或会话。
- 正式 profile 回滚时恢复上一份 `jacky-creator` 构建产物并重启 DSH Desktop。
- 回滚前保留当前工作树和已有备份，不执行 `git reset --hard`，不覆盖用户未提交改动。

## 11. 实施授权边界

本文件已经获得实施授权并按修正版落地。后续执行者仍必须先读取当前 `git diff`、保留未提交工作，并在继续修改后运行相称测试与 `check`；不得从旧步骤恢复整个 `sidebar` slot owner。
