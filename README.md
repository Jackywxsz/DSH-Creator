<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="dsh-oil-creator：让 AI 和本地内容目录一起工作">
</p>

<p align="center">
  <strong>DeepSeek Harness 上的本地内容工作台。</strong><br>
  从选题、脚本、录屏工程到字幕、封面和发布状态，一条片子始终对应一个本地文件夹。
</p>

> [!NOTE]
> 当前兼容 Node.js 22.19+、DeepSeek Harness `0.1.0-rc.6` / `0.1.0-rc.7`。核心片库可独立使用；Screen Studio、字幕、封面、公众号和发布能力均可按需安装。

> [!IMPORTANT]
> 当前分支是 Creator Cockpit 融合版，在原有「会话 / 内容」之外增加「运营」，用于灵感、推进、档期、内容管线、目标、AI 评分和发布后复盘。开发可使用仓库内隔离 profile，正式环境也可通过本地 `link:` 依赖安装本仓库构建产物。使用与架构见 [Creator Cockpit 说明](docs/creator-cockpit.md)，隔离启动见 [实验环境](docs/lab-development.md)。

## 一条片子，就是一个文件夹

插件不建立封闭的内容数据库。正文和产物仍是普通文件，任何编辑器和 AI 文件工具都能读取：

```text
~/Movies/视频项目/
└── 2026-08-19_DeepSeek Harness 上手/
    ├── topic.md
    ├── script.md
    ├── DeepSeek Harness 上手.mp4
    ├── DeepSeek Harness 上手.srt
    ├── DeepSeek Harness 上手_subtitled.mp4
    ├── DeepSeek Harness 上手_3x4.png
    ├── DeepSeek Harness 上手_4x3.png
    ├── DeepSeek Harness 上手_16x9.png
    ├── publish-package.json
    └── 公众号文章/
```

插件只把工程绑定、手写发布标记、同步到的播放数据和生成任务等工作台状态存进 `~/.dsh-oil-creator/overlay.json`，不会把正文复制一份藏起来。

## 一条片子如何向前推进

| 阶段 | AI 与插件可以做什么 | 仍由人确认什么 |
| --- | --- | --- |
| 选题与脚本 | 新建规范目录，读写 `topic.md` / `script.md`，遵守长期脚本规则 | 选题方向和最终表达 |
| 录制与剪辑 | 绑定并打开 Screen Studio 工程，等待导出文件稳定落盘 | 录制、时间线剪辑和导出 |
| 字幕与封面 | 启动字幕工作流，打开预览，烧录字幕，生成三种画幅封面 | 专有名词、标题和错别字 |
| 发布 | 把本地材料交给 `video-publisher` 准备多平台草稿 | 各平台最终“发表”按钮 |
| 数据回收 | 通过 Ego Browser 同步已发布作品的播放、赞、评和链接 | 登录状态和异常匹配结果 |

工作台不会假装替人完成录制、剪辑或最终发布。它负责把每一步需要的文件、状态和下一步动作放在同一个上下文里。

## 开始使用

### 1. 安装插件

使用 DeepSeek Harness 自带的插件管理命令：

```bash
npx @deepseek-ai/dsh plugin --profile web add github:oil-oil/dsh-oil-creator
```

重启 `web` profile 后即可使用。插件会登记到配置里，不需要手改 Harness 配置。已经全局安装 `dsh` 时，可以去掉命令里的 `npx @deepseek-ai/dsh`。

Harness 从 GitHub 安装时生成的构建包包含 README 引用的最终 `assets/readme/hero.svg`，不会包含 `assets/readme/source/` 下的源素材。

<details>
<summary>从源码安装</summary>

```bash
git clone https://github.com/oil-oil/dsh-oil-creator.git
cd dsh-oil-creator
pnpm install --frozen-lockfile
pnpm build
npx @deepseek-ai/dsh plugin --profile web add "$PWD"
npx @deepseek-ai/dsh web
```

如果 pnpm 明确提示安装期构建被阻止，再带 `--allow-build` 重试；正常安装不需要这一步：

```bash
npx @deepseek-ai/dsh plugin --profile web add --allow-build=dsh-oil-creator github:oil-oil/dsh-oil-creator
```

</details>

### 2. 让 AI 完成首次配置

推荐选择 Harness 的 `standard` 或 `code` Agent preset，然后直接说：

> 检查并配置内容工作台，找到适合的内容目录，并告诉我还缺哪些能力。

内置 `creator-workbench` Skill 会先调用只读的 `oil_creator_setup`：

1. 寻找已有的内容目录。
2. 检查 Screen Studio、字幕、封面和 Ego Browser 等可选能力。
3. 只报告凭据是否已配置，不把 API Key 读回对话。
4. 先预览配置变化，得到确认后才保存。

候选目录不存在时，AI 会先展示准备创建的完整路径；确认创建后再重新预览配置。`minimal` preset 不包含 Skill 和文件工具，不适合首次配置或自动整理目录。

### 3. 做第一条内容

可以直接对 AI 说：

> 今天做一期 DeepSeek Harness 安装上手。新建内容目录，把选题写进笔记，再给我一个脚本初稿。

随后继续说“绑定刚才的 Screen Studio 工程”“等待成片后生成字幕和封面”或“这条还缺什么”。工作台会根据文件夹里的真实产物推进阶段。

## 核心能力

- **本地片库**：按 `日期_可读标题` 扫描目录，展示阶段、成片、字幕、封面、文章和发布状态。
- **对话上下文**：通过 `@当前详情`、内容搜索或 `/current content` 把目标文件夹交给 AI。
- **AI 自举配置**：自动发现标准安装路径，缺少能力时给出明确安装方式，写入前必须预览和确认。
- **长期脚本规则**：保存语气、结构、禁忌和目标观众，之后写或修改 `script.md` 时复用。
- **长任务追踪**：字幕、封面和烧录启动后立即返回，由工作台继续观察文件产物和任务状态。
- **目录整理**：预览并修正旧文件夹名称；默认不执行、不删除文件。
- **可选发布闭环**：准备平台草稿后由人最终发表，再同步播放、点赞、评论和作品链接。

完整工具列表和逐步示例见 [使用说明](docs/usage.md)。

## 可选能力

核心片库和脚本管理不依赖下表中的外部工具。缺少某项时，只关闭对应环节。

| 能力 | 可选依赖 | 说明 |
| --- | --- | --- |
| 字幕转录、排版、预览和烧录 | [oil-subtitle](https://github.com/oil-oil/oil-subtitle) + `DASHSCOPE_API_KEY` | 首次 clone 后必须运行 `bash ~/.agents/skills/oil-subtitle/setup.sh`；Key 在[百炼控制台](https://bailian.console.aliyun.com)申请 |
| Jacky 三画幅封面 | `jacky-cover` + [oil-cover](https://github.com/oil-oil/oil-cover) + `ZENMUX_API_KEY` | 插件内适配器保留 Oil Cover 分析骨架，通过 ZenMux 整图生成人物融合版 |
| 演示动画 | `jacky-motion2-0` | 从脚本进入三次确认门，输出可录屏的 16:9 或 3:4 单文件 HTML |
| Screen Studio 自动剪辑 | [screen-studio-editor](https://github.com/oil-oil/screen-studio-editor) | 仅 macOS；录制和导出仍在 Screen Studio 完成 |
| 多平台草稿与数据回收 | [Ego Lite](https://lite.ego.app/) + [video-publisher](https://github.com/oil-oil/video-publisher-skill) | 仅 macOS；需要提前登录各平台创作者后台 |
| 公众号图文 | 当前 Harness 会话 | 基于 script.md 改写为纯 Markdown，直接保存到 `公众号文章/` |

字幕和封面 Skill 留空时，插件会依次从 `~/.claude/skills`、`~/.codex/skills`、`~/.agents/skills` 自动发现；只有非标准安装位置才需要填写高级路径。

## 配置原则

设置入口位于 **设置 → 插件 → 内容工作台**。设置页只保留需要人决定的信息，例如内容目录、脚本规则和可选能力凭据；可以通过系统检查发现的路径不重复暴露。

- API Key 使用 Harness 官方凭据服务保存。页面只显示“已配置 / 未配置”，不会回显明文。
- 内容目录可以换成任意已有的绝对路径，每个直接子文件夹代表一条内容。
- `enabledPlatforms` 默认全开，包含小红书、抖音、B 站和视频号。关闭的平台不会参与 AI 发布或数据同步；全部关闭时不执行这两项操作。
- 脚本规则既可以在设置页修改，也可以让 AI 通过 `oil_script_rules` 记录和更新。
- Cordis 高级配置仍保留 `libraryRoot`、`dataDir`、`subtitleSkillDir` 和 `coverSkillDir`，用于自动发现无法覆盖的特殊环境。

## 数据与权限边界

- 正文、视频、字幕、封面和文章保存在用户选择的本地目录。
- 插件不会自动上传内容；上传只在用户明确调用发布 Skill 后发生，并停在最终发表前。
- 字幕、封面和平台同步会访问各自的外部服务；不安装、不配置就不会启用。
- 目录创建、配置保存和批量重命名都遵循“先预览、再确认、后执行”。

## 卸载

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-oil-creator
```

安装、卸载或更新配置后重启 `dsh web`。不要手动修改 `~/.dsh/profiles/web/package.json`，也不要把项目的 `cordis.patch.yml` 复制到用户 profile；插件自己的 bundle patch 会负责装配和清理侧栏。

如果旧版本曾在 profile 的 `cordis.patch.yml` 里手动加入以下内容，迁移后应删除，避免卸载插件后官方侧栏仍被关闭：

```yaml
- id: ui-sidebar
  disabled: true
```

## 开发与验证

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 会依次运行 TypeScript 检查、Vitest 测试和 Host / Client 构建。欢迎提交 Issue 或 Pull Request；涉及文件格式、配置兼容或外部能力时，请同时补充对应测试和文档。

准备推送开源提交或创建 GitHub tag 前运行 `pnpm release:check`。它会先拒绝脏工作树、未跟踪的关键文件或缺失的 `origin`，再验证测试、构建和 GitHub 安装包内容；不会发布到 npm。

## 文档

- [日常使用与完整工具说明](docs/usage.md)
- [内容文件夹约定](docs/files.md)
- [插件实现与兼容性说明](docs/implementation.md)
- [Creator Cockpit 使用与架构](docs/creator-cockpit.md)
- [Creator Cockpit 隔离开发环境](docs/lab-development.md)
- [Creator Cockpit 对抗性审查](docs/adversarial-review.md)

## 使用问题

安装或使用过程中遇到问题，可以到 [oiloil.org](https://www.oiloil.org/#consulting) 联系我。代码缺陷和功能建议仍然欢迎提交 Issue。

## License

[MIT](LICENSE)
