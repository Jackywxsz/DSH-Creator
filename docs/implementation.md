# 内容工作台：现阶段实现

`dsh-oil-creator` 是挂在 DeepSeek Harness web 配置上的一个插件。它把 oil 从选题到发布的本地工作收进同一块界面：左侧内容列表、中间一条片子的检查器、右边继续对话。

源码：`/Users/linzhihuang/Desktop/project/dsh-oil-creator`  
安装：`~/.dsh/profiles/web/package.json` 里的 `file:` 依赖

本文写当前设计，不是变更记录。实现新功能时先读这里，再打开对应 skill 或官方文档。

## 最终要做成什么样

目标是一条能走完的创作流水线，人在关键处动手，机器包办重复劳动。日常路径是：

1. **选题**：在对话里讨论这一期讲什么，插件建一个当天的内容文件夹，笔记写进 `topic.md`。
2. **录制**：用 Screen Studio 录。插件可以绑定 `.screenstudio` 工程。
3. **剪辑**：对话里走 `screen-studio-editor` 清理停顿和误讲。人打开工程预览，确认后再亲手导出 MP4。插件不代替导出。
4. **等导出**：导出开始后，插件盯着影片目录，成片稳定落盘再往下走。这段时间可以并行做字幕和封面。
5. **字幕**：有百炼 Key 就转录；人在 skill 自带的预览编辑器里改稿；确认后再烧进视频。
6. **封面**：有 ZenMux Key 就出 3:4 / 4:3 / 16:9。封面主标题和错别字由对话里的 Agent 核对，不交给脚本自行发挥。
7. **标签与发布包**：`publish-package.json` 给四个视频平台，只需要标题和 tags，不写平台长文案。公众号文章是旁边的 Markdown，不是第五个视频平台，走 `oil-video-article`，成稿在 `公众号文章/`。
8. **发布**：`video-publisher` 把各平台草稿做到最终发布按钮前，人自己点发布。插件记录每平台未发布 / 草稿已备 / 已发布。
9. **回收**：用 Ego Lite 打开已登录的创作者后台，翻完官方已发布列表，按标题或已存 id 对到本地文件夹，写下播放 / 赞 / 评论。不是公开站爬虫；平台上有、本地没有文件夹的不会自动建条目。

一条片子对应影片目录里的一个子文件夹。工程在 Screen Studio 工程目录里，用绑定连起来。

## 现阶段已经能做什么

| 环节 | 现状 |
| --- | --- |
| 列表与检查器 | 自定义侧栏「内容」页；检查器叠在对话左边，聊天不关；概览用状态标签标明阶段，只展开当前步骤的操作 |
| 建内容、选题笔记 | 面板新建；`oil_create_content` 建文件夹；选题写 `topic.md` |
| 绑定 / 打开工程 | 面板换绑、打开；`oil_open_studio` |
| 等导出 | `oil_wait_export` 立刻返回并开始盯目录；成片稳定后清掉 waiting 标记 |
| 字幕预览、烧录、生成 | 按钮和同名工具会拉起 `oil-subtitle` 脚本 |
| 生成封面 | 按钮和工具拉起 `oil-cover` 脚本；标题先用文件夹名 |
| 发布状态 | 读 `{标题}.auto-publish.json`；点状态胶囊从菜单里选未发布 / 草稿 / 已发布，手写优先 |
| 已发布数据 | 检查器「同步已发布」只对当前这一期：找到标题就停翻页，overlay 也只写这一条。`oil_sync_publish` 不传 id 才同步整库 |
| API Key | 设置 → 插件 → 内容工作台；和视觉识别共用官方凭据 |
| 公众号 | 只显示目录里有没有 `公众号文章/`，不生成 |
| 剪辑、多平台上传 | 还没从插件里调度，对话里继续用原来的 skill |

上面这张表是工作台已经具备的能力：能看列表、绑定工程、启动字幕和封面脚本、标记发布状态。对照「最终要做成什么样」那 9 步，整条创作路径还没有全部接到插件里。现在有的是一条片子的工作台和几个可点的执行入口，不是点一次就从选题走到待发布。

日常路径里，插件还包不住、仍要在对话里自己喊 skill 或亲手做的：

1. **剪辑**：只能打开工程，不会替你跑 `screen-studio-editor`。
2. **导出后的并行编排**：「导出开始就同时做字幕和封面」没有连成一条自动流水。
3. **字幕校对**：生成完不会自动改专有名词；预览还要人自己看。
4. **封面主标题和错别字**：按钮不会先让 Agent 提炼标题，也不会验字。
5. **发布包**：能展示已有 `publish-package.json` 里的标签，不会在插件里写平台长文案。
6. **四平台上传**：不会调度 `video-publisher`，只记状态。
7. **公众号成稿**：不会跑 `oil-video-article`。
8. **没有本地文件夹的旧作**：同步会翻完创作者后台的已发布列表，但对不上本地片子的不会自动建文件夹。

工作阶段（`workflow`）由文件和 overlay 推出来，不是单独手填一张总表：

- `idle` 未开始
- `record` 待录制（overlay 里标了准备录）
- `cut` 待剪辑（已绑工程、还没有成片）
- `finish` 待加字幕 / 封面
- `publish` 待发布（字幕和封面都齐）

## 一层工作台，skill 继续执行重活

保持 **一个** Harness 插件。官方要求：只有能力需要独立替换时才拆包，不要预防性拆分。见 DeepSeek Harness `docs/user/develop/practice/index.zh.md`。

设置位 `settings.plugin.item` 的含义是「一个插件一张卡」，不是一个功能一张卡。

执行分工：

- **磁盘文件**：片子的正文。约定见 [files.md](files.md)。模型用系统自带的列文件 / 读文件 / 写文件。
- **插件**：侧栏、检查器、阶段推导、官方凭据、给模型的文件约定（`systemPrompt` 段落 `oil:library`）。
- **Harness 工具**：用官方 `defineTool` 注册。只做文件做不到的事，或启动一项已经约定好的脚本。长任务立刻返回，完成与否看文件夹里有没有产物。`oil_wait_export` 也是启动监视，不把 `execute` 阻塞到导出结束。
- **Skill 脚本**：ASR、FFmpeg 烧录、选帧生图。不要把 Python 和 SOP 整份搬进 `execute()`。
- **对话里的 Agent**：校对字幕、提炼封面主标题、看封面错别字、审查剪辑报告。这些判断留在对话里。

对话里的插件工具：

`oil_create_content`、`oil_update_content`、`oil_creator_profile`、`oil_organize_library`、`oil_sync_publish`、`oil_open_studio`、`oil_wait_export`、`oil_open_subtitle_preview`、`oil_burn_subtitles`、`oil_generate_subtitles`、`oil_generate_cover`

空会话标题是 Oil 图标和 `Oil — all your ideas, shipped.`。侧栏品牌是 Oil Creator。

检查器中间栏可以拉到约 800px，走 `shell.overlay`，不占用官方右侧「详情」栏。官方详情栏保持关闭。发布区拆成同步、视频平台、公众号、标签几张卡。概览封面并排 3:4 和 4:3。视频页播放 `_subtitled` 成片，没有则播原片。脚本写在内容文件夹的 `script.md`，已经转好的 Markdown 在 `公众号文章/`。列表按文件夹日期或成片时间倒序，不用文件夹被摸过的时间。对话里 `@` 可以点一条片子或「当前详情」，`/current content` 引用当前打开的那条；发给模型的只有文件夹路径，正文和封面用系统列文件 / 读文件。

## 状态存在哪里

不要往 `overlay.json` 里写 API Key，也不要把密钥回读到页面。

| 数据 | 位置 |
| --- | --- |
| 影片目录、创作者档案、工程绑定、待录制、等导出、手写发布状态、同步到的播放/赞/评、烧录/生成任务 | `~/.dsh-oil-creator/overlay.json` |
| 成片、字幕、封面、发布包、公众号文章 | `~/Movies/视频项目/<日期_标题>/` |
| 百炼、ZenMux Key | Harness 官方凭据（`DASHSCOPE_API_KEY`、`ZENMUX_API_KEY`），与 `dsh-vision` 共用 |
| 列表选中项、侧栏宽度 | 浏览器本地 UI 状态 |

发布状态两层：文件夹里的 `{标题}.auto-publish.json` 推断草稿；overlay 里的手写状态盖过它。Ego 同步成功后，对应平台写成 `published`，并带上 `url` / `views` / `likes` / `comments` / `syncedAt`，来源记为 `sync`。

采集本身是机械脚本，不经过模型判断：

```text
ego-browser nodejs < scripts/collect-publish.mjs
```

采集脚本每次开一个新的 `oil-collect-*` 空间，跑完就关掉，并清掉登记表里已死进程留下的旧空间，以及历史遗留名 `oil-collect-publish`。它不会按前缀扫掉其他还在跑的 `oil-collect-*`。`pnpm build` 用原地覆写把 `scripts/collect-publish.mjs` 写进 `lib/`，避免 `cp` 断开 profile 里 `file:` 依赖的硬链接。翻页范围：小红书 `note/user/posted`（列表滚到底）、抖音 `work_list`（`max_cursor`）、B 站 `/x/web/archives`（`pn`）、视频号 `post/post_list`（`currentPage`）。对上之后把 `remoteId` 写进 overlay，下一次优先按这个 id 对齐，不再只靠标题。

90 秒内再点同步会直接用 `~/.dsh-oil-creator/collect-cache.json`。超过这个时间再跑 Ego。可用 `OIL_COLLECT_KEEP=1` 留下页面，`OIL_COLLECT_SPACE` 指定空间名，`OIL_COLLECT_PLATFORMS=wechat,douyin` 只跑其中几个。工作台按钮和 `oil_sync_publish` 走同一条脚本。

文件夹约定：`YYYY-MM-DD_可读标题`。发布包规范名是 `publish-package.json`。带字幕的成片文件名含 `_subtitled`。

## 实现时参考什么

先官方约定，再打开对应 skill。不要重新发明目录、密钥或烧录参数。

### DeepSeek Harness（仓库 `~/Desktop/project/deepseek-harness`）

| 题目 | 读什么 |
| --- | --- |
| 插件怎么挂、`apply` / `ctx` | `docs/user/develop/basic/index.zh.md` |
| 给模型注册工具 | `docs/user/develop/basic/tool.zh.md` |
| 长任务、规范返回值、不要把散文当 API | `docs/cookbook/adding-a-tool.md` |
| 一个包还是拆成 Definition / Provider | `docs/user/develop/practice/index.zh.md`（不要预防性拆分） |
| API Key 只写不回读 | 官方凭据服务；界面对照已安装的 `@oil-oil/dsh-vision` 设置卡 |
| 设置卡槽位 | `packages/client/ui-settings-plugins` 里对 `settings.plugin.item` 的说明 |

官方 Bash 那种三包拆分，只适用于「同一能力会换执行环境」。内容工作台不是这种能力。

### oil 自己的 skill（执行器和产品规则）

| 环节 | Skill | 路径 | 插件可以包什么 | 仍留给 Agent / 人 |
| --- | --- | --- | --- | --- |
| 剪辑工程 | `screen-studio-editor` | `~/.claude/skills/screen-studio-editor` | 以后可加「按绑定工程开剪辑」；现在只绑定和打开 | 审查删除、Screen Studio 里预览、手动导出 |
| 字幕 | `oil-subtitle` | `~/.claude/skills/oil-subtitle` | 已包预览编辑器、转录、按稿烧录 | 校对不确定词、确认预览后再烧 |
| 封面 | `oil-cover` | `~/.claude/skills/oil-cover` | 已包脚本模式三画幅生成 | 提炼主标题、看错别字、决定是否重跑某一画幅 |
| 发布文案语气 | `oil-tone` | `~/.claude/skills/oil-tone` | 不执行；写标题简介时读档案 | 成稿必须过 `tone_lint.py` 再通读 |
| 公众号图文 | `oil-video-article` | `~/.agents/skills/oil-video-article` | 识别 `公众号文章/` | 从无头像屏幕轨截图、按 oil-tone 写文章 |
| 四平台视频草稿 | `video-publisher` | `~/.claude/skills/video-publisher` | 读 `auto-publish.json` 显示状态 | Ego 上传、停在最终发布按钮前、人点发布 |

字幕脚本入口以 skill 文档为准：`preview_editor.py`、`bailian_transcribe.py`、`burn_subtitles.py`（有审过的 SRT 用 `--srt-input`）。封面脚本是 `generate_oil_cover.py`，Key 用环境变量 `ZENMUX_API_KEY`。不要改 skill 仓库里的用户路径和密钥。

封面还有 Agent 自主模式，依赖执行环境自己的生图工具。Harness 工作台默认走脚本模式，因为这里稳定的是 ZenMux 脚本，不是 Codex 内置 `image_gen`。

## 改代码时的约束

- 插件只做一张工作台，新能力优先加模块，不加新插件。
- 密钥走官方凭据；页面只显示已配置 / 未配置。
- 重媒体继续调用已有脚本，参数与对应 SKILL.md 保持一致。
- 人导出、人点平台发布、Agent 做校对和标题，这三件事不要改成全自动。
- Host remote 或工具改完后要重新 `pnpm build` 并重启 `dsh web`。
