# 安装与首次使用

## 开始前准备

你需要：

1. 已安装 [DSH Desktop 2.0.2](https://github.com/anywhere-labs/dsh-desktop/releases/tag/v2.0.2)。
2. 一个存放内容项目的本地文件夹。没有也没关系，首次配置时可以创建。
3. 推荐使用 macOS。Windows x64 无法使用 Screen Studio、Ego Lite 等 macOS 专属扩展。

DSH Desktop 和 Jacky Creator 均为社区项目。

## 安装

### 1. 打开内置终端

启动 DSH Desktop，打开它提供的内置终端。安装命令要输入终端，不要发送到聊天输入框。

### 2. 运行安装命令

~~~bash
dsh plugin --profile web add jacky-creator
~~~

等待命令结束，不要在安装过程中重复执行。

如果 npm 通道暂时不可用，可以安装同版本的 GitHub Release 成品包：

~~~bash
dsh plugin --profile web add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.8/jacky-creator-0.1.0-beta.8.tgz
~~~

如果日志出现 `Issues with peer dependencies found`，先看命令最后是否显示安装完成。只有出现 `dsh: pnpm failed` 或其他明确失败提示时，才需要提交日志排查。

### 3. 重启 DSH Desktop

安装完成后彻底退出 DSH Desktop，再重新打开。只关闭窗口但不退出进程，可能仍然使用旧插件状态。

### 4. 确认安装成功

满足下面三项即表示插件已经加载：

- 侧边栏左上角显示 `Jacky Creator`。
- 顶部可以切换“对话 / 内容 / 运营”。
- 侧边栏芽仔按钮可以进入灵感记录。

## 首次配置

新建会话，选择 `standard` 或 `code` Agent，发送：

> 帮我配置 Jacky Creator：选择本地内容目录，先预览准备修改的设置，确认后再保存。

Jacky Creator 会检查内容目录和可选能力，只显示凭据是否已配置，不会把 API Key 读回对话。也可以直接打开“设置 → 插件 → Jacky Creator”：逐项重新检测能力，只选择确实拥有账号的平台，用 Ego Browser 检测/打开各平台登录，并在确认后安装可验证的公开依赖。新安装默认不启用任何发布平台；创建目录、安装依赖或保存设置前都会明确展示或确认。

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

确认使用的是 DSH Desktop 内置终端。如果使用系统 Terminal、PowerShell 或其他终端，需要先按 DeepSeek Harness 的说明配置 CLI。

### 安装日志提示构建脚本被阻止

这通常说明安装的是 GitHub 源码地址。普通用户不要修改 DSH Profile，重新复制本页的 `jacky-creator` npm 安装命令；npm 通道不可用时再使用 GitHub Release 成品包。

### 安装完成但侧边栏没有变化

1. 彻底退出并重新打开 DSH Desktop。
2. 确认 DSH Desktop 版本为 2.0.2。
3. 仍然失败时提交 Issue，并附上系统版本、DSH Desktop 版本和脱敏后的安装日志。

不要自行编辑 DSH Profile 的 `package.json` 或 `cordis.patch.yml`。

### 缺少字幕、封面或发布功能

这些是可选扩展，不是安装失败。核心的对话、内容、运营和灵感不依赖这些 Skill。

### 从旧版升级

如果安装过 `v0.1.0-beta.2`，先在 DSH Desktop 内置终端运行一次：

~~~bash
dsh plugin remove dsh-oil-creator
~~~

然后执行本页的新安装命令并重启 DSH Desktop。Jacky Creator 会把旧工作台状态复制到新目录，不删除旧目录，也不覆盖已经存在的新数据。

升级到统一 `jacky_creator_*` Agent 命令的版本后，请新建会话再继续创作。升级前已经打开的会话仍保存旧工具目录，继续使用可能出现 `UNKNOWN_TOOL`；不要为此删除历史会话或内容目录。

## 更新

看到新版本后，打开 [GitHub Releases](https://github.com/Jackywxsz/DSH-Creator/releases)，按该版本说明中的安装命令更新。更新后彻底退出并重新打开 DSH Desktop，再新建会话。更新不会主动删除内容目录，重要内容仍建议提前备份。

## 数据保留

Jacky Creator 不会在更新或普通卸载时主动删除内容目录。正文、视频、字幕、封面和文章仍保存在用户选择的本地文件夹。

需要帮助时，到 [GitHub Issues](https://github.com/Jackywxsz/DSH-Creator/issues) 提交问题。不要公开粘贴 API Key、私人路径或未经脱敏的内容。
