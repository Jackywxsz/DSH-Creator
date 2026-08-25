# 小白安装与首次使用

这份说明面向第一次安装 DeepSeek Harness 插件的用户。当前发布的是 `v0.1.0-beta.1` 测试版，暂时通过 GitHub Release 的预构建安装包安装，不经过插件市场。

## 开始前准备

你需要：

1. 一台 macOS 电脑。Windows x64 可以参加核心功能测试，但首轮还没有完成真实设备验收。
2. 已安装 [DSH Desktop 2.0.2](https://github.com/anywhere-labs/dsh-desktop/releases/tag/v2.0.2)。
3. 一个准备存放内容项目的本地文件夹；没有也没关系，首次配置时可以创建。

DSH Desktop 是社区维护的桌面客户端，不是 DeepSeek 官方桌面产品。Jacky Creator 是 DeepSeek Harness 社区插件。

## 安装

### 1. 打开正确的终端

启动 DSH Desktop，打开它提供的内置终端。安装命令要输入终端，不要发送到聊天输入框。

### 2. 复制安装命令

```bash
dsh plugin add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.1/dsh-oil-creator-0.1.0-beta.1.tgz
```

等待命令结束。不要关闭窗口，也不要在安装过程中重复执行。

安装日志可能出现 `Issues with peer dependencies found` 警告：这些 Peer 由 DSH Desktop 宿主提供，当前 Beta 的隔离安装也会看到这条警告。只要命令最后显示安装完成、没有 `dsh: pnpm failed`，就继续重启并按下一步检查界面；若出现明确失败提示，再提交完整的脱敏日志。

### 3. 重启应用

安装成功后彻底退出 DSH Desktop，再重新打开。只关闭窗口但不退出进程，可能仍然使用旧插件状态。

### 4. 确认安装成功

满足下面三项即表示插件已经加载：

- 侧边栏左上角显示 `Jacky Creator`。
- 顶部可以切换“对话 / 内容 / 运营”。
- 侧边栏芽仔按钮可以进入灵感记录。

## 首次配置

新建会话，选择 `standard` 或 `code` Agent，发送：

> 检查并配置 Jacky Creator，找到适合的内容目录，先预览准备修改的设置，并告诉我还缺哪些可选能力。

首次检查会做这些事：

1. 寻找已有内容目录。
2. 检查 Screen Studio、字幕、封面和发布器等可选能力。
3. 只报告凭据是否已经配置，不把 API Key 读回对话。
4. 展示准备保存的路径和设置。
5. 得到确认后才创建目录或保存设置。

`minimal` Agent 没有完整的 Skill 和文件工具，不适合首次配置。

## 创建第一条内容

发送：

> 今天做一期 DeepSeek Harness 安装上手。新建内容项目，把选题写进 topic.md，再给我一个脚本初稿。

创建成功后，你可以：

- 在“内容”打开项目并查看脚本、视频、字幕、封面和文章状态。
- 在“运营”安排今天推进、档期和发布后复盘。
- 用芽仔快捷按钮记录新灵感。
- 把已确认的运营规则或模板加入下一次脚本上下文。

## 常见问题

### 终端提示找不到 `dsh`

请确认你使用的是 DSH Desktop 内置终端。如果在系统 Terminal、PowerShell 或其他终端里执行，需要先按 DeepSeek Harness 的安装说明配置 CLI；Beta 用户优先使用桌面内置终端。

### 安装日志提示构建脚本被阻止

这通常说明你误用了 `github:Jackywxsz/DSH-Creator#...` 源码地址。pnpm 10 会拦截 Git 源码包的 `prepare` 构建，并要求修改目标 Profile 的 `pnpm-workspace.yaml`。普通用户不要改 Profile，直接重新复制本页的 `.tgz` 安装命令。

### 安装完成但侧边栏没变化

1. 彻底退出并重启 DSH Desktop。
2. 确认安装命令使用的是固定 Tag，而不是 `main`。
3. 确认 DSH Desktop 版本为 2.0.2。
4. 仍然失败时提交 Issue，不要自行编辑 Profile 的 `package.json` 或 `cordis.patch.yml`。

### 缺少字幕、封面或发布功能

这些是可选扩展，不是安装失败。核心的对话、内容、运营和灵感不依赖这些 Skill。插件会在设置和首次检查中说明缺少什么。

### Windows 可以使用吗

DSH Desktop 提供 Windows x64 版本，Jacky Creator 的核心代码也避免使用硬编码 macOS 路径，但 `v0.1.0-beta.1` 仍等待 Windows 真机验收。Screen Studio、Ego Lite 等 macOS 专属扩展在 Windows 不可用。

## 更新

Beta 版本不跟随开发分支自动更新。看到新版本说明后，按说明中的新 Tag 重新安装：

```bash
dsh plugin remove dsh-oil-creator
dsh plugin add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.1/dsh-oil-creator-0.1.0-beta.1.tgz
```

卸载插件包不会主动删除内容目录和 `~/.dsh-oil-creator/`。更新前仍建议备份重要内容。

## 卸载

```bash
dsh plugin remove dsh-oil-creator
```

执行后重启 DSH Desktop。若你还希望删除工作台设置和运营状态，请先备份，再手动处理 `~/.dsh-oil-creator/`；普通卸载不做这一步。

## 反馈问题

到 [GitHub Issues](https://github.com/Jackywxsz/DSH-Creator/issues) 提交：

- macOS 或 Windows 版本。
- DSH Desktop 版本。
- 使用的 Jacky Creator Tag。
- 可以复现问题的最短步骤。
- 已脱敏的终端日志或截图。

不要提交 API Key、登录 Cookie、私人内容正文或包含个人信息的完整本地路径。
