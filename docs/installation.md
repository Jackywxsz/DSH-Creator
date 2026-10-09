# 安装与首次使用

## 开始前准备

**主维护通道：官方 DeepSeek Harness 桌面端、官方 CLI 启动的 Web UI。** 当前组合为 Harness `0.2.0-rc.2` + Jacky Creator `0.1.0-beta.9`，不是“任意最新版本均兼容”。

桌面用户从 [DeepSeek 官网](https://www.deepseek.com/zh/download/) 安装官方 Harness，并确认运行时版本。Web UI 用户准备 Node.js `>=22.19.0`，按下方步骤安装官方 CLI。准备一个本地内容文件夹；Windows x64 尚未完成验收，Screen Studio、Ego Lite 等扩展仅支持 macOS。

社区桌面封装或分支保留兼容支持，但不是主要适配、回归和发布验收通道。先核对它内置的 Harness 运行时与插件 API，不要用社区客户端自身的版本号判断兼容，也不要套用官方桌面端的 Profile 命令。

Jacky Creator 是社区插件。`0.1.0-beta.9` 面向官方 Harness `0.2.0-rc.2`，已在 macOS 官方 Electron 与 CLI/Web 隔离环境验收。固定版本成品包见 [Release](https://github.com/Jackywxsz/DSH-Creator/releases/tag/v0.1.0-beta.9)。

## 安装

### A. 官方桌面端

1. 打开官方 Harness，确认运行时为 `0.2.0-rc.2`。
2. 打开侧栏“插件”，通过内置插件管理器添加下面的成品包 URL；也可从 [Release](https://github.com/Jackywxsz/DSH-Creator/releases/tag/v0.1.0-beta.9) 下载 `.tgz` 后添加。
3. 等待安装成功，彻底退出并重启桌面端。

```text
https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.9/jacky-creator-0.1.0-beta.9.tgz
```

如已安装桌面版附带的 `dsh` 命令，也可执行：

```bash
dsh plugin --profile desktop add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.9/jacky-creator-0.1.0-beta.9.tgz
```

### B. 官方 Web UI

首次安装官方 CLI、核对版本、安装插件并启动：

```bash
npm install -g @deepseek-ai/dsh@0.2.0-rc.2
dsh --version
dsh plugin --profile web add jacky-creator@0.1.0-beta.9
dsh web
```

已有匹配 CLI 可跳过第一行；版本输出必须为 `0.2.0-rc.2`。在浏览器打开启动日志提供的本地地址。Web UI 正在运行时，安装后先停止原进程，再执行 `dsh web`。

固定 Release 地址可替换 npm 包安装命令：

```bash
dsh plugin --profile web add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.9/jacky-creator-0.1.0-beta.9.tgz
```

npm CLI 不能管理桌面端的 `desktop` Profile；安装到 `web` 不会使桌面端自动加载。两个入口并用时，要分别安装到各自 Profile，并确认所用 `dsh` 来自对应宿主。

### 安装成功的判断

等待安装结束，再彻底退出并重启宿主。检查侧栏 Jacky Creator 入口、内容 / 运营 / 灵感页面和设置卡均能打开，目录选择和保存有效，才算完成安装验证。

`incompatible with dsh`、`nothing was installed` 或非零退出码均表示失败。旧 `beta.8` 的依赖与此宿主不兼容；`allow-version` 只放行检查，不是修复方案。

## 首次配置

新建会话，选择标准模式，发送：

> 帮我配置 Jacky Creator：选择本地内容目录，先预览准备修改的设置，确认后再保存。

Jacky Creator 会检查内容目录和可选能力，只显示凭据是否已配置，不会把 API Key 读回对话。也可以直接打开“设置 → 内置插件 → Jacky Creator”：逐项重新检测能力，只选择确实拥有账号的平台，用 Ego Browser 检测/打开各平台登录，并在确认后安装可验证的公开依赖。新安装默认不启用任何发布平台；创建目录、安装依赖或保存设置前都会明确展示或确认。

`minimal` Agent 没有完整的 Skill 和文件工具，不适合首次配置。

## 创建内容

配置完成后，直接告诉 AI 想做的内容主题，并要求它新建内容项目、整理选题或生成脚本初稿。

创建成功后，可以：

- 在“内容”查看脚本、视频、字幕、封面和文章状态。
- 在“运营”安排推进、档期和发布后复盘。
- 用芽仔快捷按钮记录新灵感。
- 把确认过的运营规则和模板带进下一次脚本创作。

## 常见问题

### 终端提示找不到 `dsh`

按 DeepSeek Harness 的说明安装命令行入口。管理官方桌面端插件时必须使用桌面版附带的 `dsh`；单独安装的 npm CLI 只管理自己的 Profile。

### 安装日志提示构建脚本被阻止

这通常说明安装的是 GitHub 源码地址。普通用户不要修改 DSH Profile，请使用本页与当前宿主匹配的 GitHub Release 成品包命令。

### 安装完成但侧边栏没有变化

1. 彻底退出并重新打开 DeepSeek Harness。
2. 确认运行时为 `0.2.0-rc.2`，插件为 `0.1.0-beta.9`，且安装在当前 Profile。
3. 仍然失败时提交 Issue，并附上系统版本、DeepSeek Harness 版本和脱敏后的安装日志。

不要自行编辑 DSH Profile 的 `package.json` 或 `cordis.patch.yml`。

### 缺少字幕、封面或发布功能

这些是可选扩展，不是安装失败。核心的对话、内容、运营和灵感不依赖这些 Skill。

### 从旧版升级

如果安装过 `v0.1.0-beta.2`，先使用所属宿主的插件管理器卸载旧包 `dsh-oil-creator`；CLI / Web 用户可运行：

~~~bash
dsh plugin --profile web remove dsh-oil-creator
~~~

然后执行本页的新安装命令并重启 DeepSeek Harness。Jacky Creator 会把旧工作台状态复制到新目录，不删除旧目录，也不覆盖已经存在的新数据。

升级到统一 `jacky_creator_*` Agent 命令的版本后，请新建会话再继续创作。升级前已经打开的会话仍保存旧工具目录，继续使用可能出现 `UNKNOWN_TOOL`；不要为此删除历史会话或内容目录。

## 更新

看到新版本后，打开 [GitHub Releases](https://github.com/Jackywxsz/DSH-Creator/releases)，按该版本说明中的安装命令更新。更新后彻底退出并重新打开 DeepSeek Harness，再新建会话。更新不会主动删除内容目录，重要内容仍建议提前备份。

## 数据保留

Jacky Creator 不会在更新或普通卸载时主动删除内容目录。正文、视频、字幕、封面和文章仍保存在用户选择的本地文件夹。

需要帮助时，到 [GitHub Issues](https://github.com/Jackywxsz/DSH-Creator/issues) 提交问题。不要公开粘贴 API Key、私人路径或未经脱敏的内容。
