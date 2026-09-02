<p align="center">
  <img src="./assets/readme/hero.png" width="100%" alt="Jacky Creator：把对话、内容与运营放进同一块 DeepSeek Harness 创作工作台">
</p>

<p align="center">
  <strong>一个面向内容创作者的 DeepSeek Harness 本地工作台。</strong><br>
  从灵感和脚本，到制作、发布与复盘，都在同一处推进。
</p>

<p align="center">
  <a href="https://github.com/Jackywxsz/DSH-Creator/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Jackywxsz/DSH-Creator/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/Jackywxsz/DSH-Creator/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/Jackywxsz/DSH-Creator?include_prereleases&label=release"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-1f5fff.svg"></a>
</p>

<p align="center">
  <a href="./docs/installation.md">安装指南</a> ·
  <a href="./docs/usage.md">使用说明</a> ·
  <a href="./CHANGELOG.md">更新记录</a> ·
  <a href="./SECURITY.md">安全说明</a>
</p>

## Jacky Creator 是什么

Jacky Creator 把 DeepSeek Harness 的对话能力和本地创作目录连起来，并增加内容、运营和灵感工作区。每条内容仍是一个普通文件夹，AI、编辑器和你自己都能继续读写。

```text
灵感 → 选题 → 脚本 → 演示 / 视频 / 字幕 / 封面 → 发布 → 复盘
  ↑                                                  │
  └────────── 运营规则、模板和知识回到下一次创作 ────────┘
```

- **对话**：使用 DSH Agent，并把当前内容和运营知识带进对话。
- **内容**：管理脚本、视频、字幕、封面、文章和发布状态。
- **运营**：查看今日推进、档期、内容管线、阶段目标和发布后复盘。
- **灵感**：记录想法、标签和分级，确认后推进为内容项目。

## 安装

### 1. 安装 DSH Desktop

下载并安装 [DSH Desktop 2.0.2](https://github.com/anywhere-labs/dsh-desktop/releases/tag/v2.0.2)。DSH Desktop 和 Jacky Creator 均为社区项目。

### 2. 安装 Jacky Creator

推荐在 DSH Desktop 的内置终端安装 npm 成品包；插件市场同步完成后也可以一键安装。

#### 方式一：通过 DSH Plugin Hub 安装

先打开 DSH Desktop 的内置终端，安装可视化插件市场：

```bash
dsh plugin --profile web add dsh-plugin
```

彻底退出并重新打开 DSH Desktop。市场目录同步并显示 `Jacky Creator` 后，进入“设置 → 插件市场”，打开插件卡片并点击安装。

插件市场目录按周期同步。如果市场显示的版本低于 GitHub 最新版本，可以改用下面的命令行方式。

#### 方式二：通过命令行安装最新版

打开 DSH Desktop 的内置终端，复制下面一行并回车：

```bash
dsh plugin --profile web add jacky-creator
```

如果 npm 通道暂时不可用，可以改装同版本的 GitHub Release 成品包：

```bash
dsh plugin --profile web add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.8/jacky-creator-0.1.0-beta.8.tgz
```

无论使用哪种方式，安装完成后都要彻底退出并重新打开 DSH Desktop。侧边栏左上角出现 **Jacky Creator**，并能进入“内容 / 运营 / 灵感”，即表示安装成功。

### 3. 完成首次配置

新建会话，选择 `standard` 或 `code` Agent，然后发送：

> 帮我配置 Jacky Creator：选择本地内容目录，先预览准备修改的设置，确认后再保存。

配置完成后，直接告诉 AI 想做的内容主题，就可以新建项目、整理选题并生成脚本初稿。

完整步骤见 [安装与首次使用](docs/installation.md)。

## 本地文件

```text
内容目录/
└── YYYY-MM-DD_内容标题/
    ├── topic.md
    ├── script.md
    ├── 内容标题.mp4
    ├── 内容标题.srt
    ├── 内容标题_16x9.png
    └── 公众号文章/
```

正文和产物保存在你选择的内容目录。Jacky Creator 只在本机保存工作台设置、运营状态和发布记录，不会把正文搬进封闭数据库。

## 核心能力

不安装额外 Skill，也可以使用内容库、运营工作台、灵感库和脚本规则。字幕、封面、演示动画、Screen Studio 和多平台发布属于可选扩展，缺少时不会影响核心工作台。

| 能力 | 说明 |
| --- | --- |
| 内容工作流 | 管理选题、脚本、制作资产和发布状态 |
| 运营工作台 | 管理档期、目标、复盘和内容推进 |
| 灵感库 | 记录想法并推进为真实内容项目 |
| 可选制作能力 | 字幕、封面、演示动画和多平台发布 |

详细能力和依赖见 [使用说明](docs/usage.md)。

## 数据与权限

- 正文、视频、字幕、封面和文章留在用户选择的本地目录。
- API Key 由 DSH 凭据服务保存，界面只显示配置状态。
- 目录创建、批量重命名和配置保存会先预览，再等待确认。
- 外部服务只在用户主动启用对应能力时访问。
- 插件不会在卸载时删除内容目录。

安全问题请按 [Security Policy](SECURITY.md) 私下报告，不要在公开 Issue 中附带密钥、私人路径或未脱敏内容。

## 常见问题

如果侧边栏没有出现 Jacky Creator：

1. 确认安装命令是在 DSH Desktop 内置终端执行的。
2. 彻底退出并重新打开 DSH Desktop。
3. 仍然失败时，到 [GitHub Issues](https://github.com/Jackywxsz/DSH-Creator/issues) 提交系统版本、DSH Desktop 版本和脱敏后的安装日志。

不要手动修改 DSH Profile 的 `package.json` 或 `cordis.patch.yml`。

## 兼容性

当前主要环境为 macOS、DSH Desktop 2.0.2 和 DeepSeek Harness 0.1.1-rc.2。Windows x64 暂不作为推荐环境，Screen Studio、Ego Lite 等扩展仅支持 macOS。

## 插件市场

Jacky Creator 已收录到 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，并由 [dsh-market](https://github.com/dsh-market/dsh-market) 同步市场卡片。安装 `dshmarket` 后，可以在 DSH Desktop 的“设置 → 插件市场”中搜索 `DSH-Creator` 并一键安装。市场版本尚未同步时，请使用上面的固定版本安装命令。

## 文档与开发

- [安装与首次使用](docs/installation.md)
- [日常使用](docs/usage.md)
- [内容文件夹约定](docs/files.md)
- [参与贡献](CONTRIBUTING.md)

本地开发：

```bash
pnpm install --frozen-lockfile
pnpm check
```

## 项目来源

Jacky Creator 基于上游开源项目 [dsh-oil-creator](https://github.com/oil-oil/dsh-oil-creator) 的本地内容工作流继续开发，并融合了 Jacky 原 Creator Cockpit 的运营方法与界面经验。感谢原项目作者和贡献者。

## License 与品牌资产

代码沿用 [MIT License](LICENSE)。Jacky Creator 名称、芽仔形象、Logo 和品牌视觉不随 MIT 代码许可自动授权，具体边界见 [品牌资产说明](BRAND_ASSETS.md)。原项目和上游贡献者的 MIT 归属继续保留。
