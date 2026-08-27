# 发布与插件市场路径

本文记录 Jacky Creator 从 GitHub Beta 到社区插件市场，再到未来稳定版的发布约束。市场收录和稳定版是两件事：社区市场允许使用经过验证的 GitHub Release 预构建包，npm 不是收录前提。

## 当前状态

- 发布阶段：GitHub Beta。
- 当前版本：`v0.1.0-beta.4`。
- 安装来源：GitHub Release 的预构建 `.tgz`，源码、Git Tag 与安装包一一对应。
- npm：未发布。
- 插件市场：已收录到 `awesome-dsh-plugin`，由 `dsh-market` 同步市场卡片。
- 首要宿主：DSH Desktop 2.0.2 / DeepSeek Harness 0.1.1-rc.2。

## 发布链路

```text
GitHub main
  └── signed/annotated Tag
       └── GitHub Prerelease + 更新说明 + 预构建 .tgz
            └── awesome-dsh-plugin 收录 PR
                 └── dsh-market 自动同步市场卡片

未来稳定版
  └── npm 不可变版本（可选，不影响市场收录）
```

GitHub 是源码、Issue、文档和版本真源。社区目录只保存仓库地址、准确简介、分类和经过验证的安装包地址，不跟随开发分支现场构建。

## GitHub Beta

Beta 的直接安装入口固定到版本包：

```bash
dsh plugin add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.4/jacky-creator-0.1.0-beta.4.tgz
```

发布前必须：

1. `main` 与准备发布的提交一致。
2. `package.json` 版本、Git Tag、README、安装文档和 Changelog 一致。
3. `pnpm check` 通过。
4. `pnpm release:check` 通过。
5. GitHub Release 安装包包含 Host、Client、Typert、Bundle Patch、README、文档和 Hero，并且无需用户授权源码构建。
6. 在干净 Profile 完成安装、重启、首次配置和卸载验证；无法完成的运行时验证必须在 Release 中说明。
7. 仓库与打包产物中不得包含密钥、用户内容、缓存或本机私人路径。

Git 源码安装只供开发者使用。DeepSeek Harness rc.2 的 `dsh plugin` 会把参数转交 pnpm；pnpm 10 对 Git 源码包的 `prepare` 默认要求消费者显式允许构建，因此不作为普通用户入口。

## 社区插件市场

[dsh-market](https://github.com/dsh-market/dsh-market) 的目录来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。上架要向目录仓库提交一个插件 YAML，而不是向 dsh-market 仓库提交 Issue 或等待 Topic 自动扫描。

收录前必须满足：

1. 仓库公开，创建满 1 天，并且至少有 10 个提交。
2. `package.json` 声明完整的 `dsh.bundle`，仓库包含真实可运行代码。
3. GitHub 仓库添加 `dsh-plugin` Topic。
4. 官方 DSH 运行时组件放在 `peerDependencies`，不随插件重复安装。
5. 市场简介只描述真实能力，不使用“官方”“最佳”等容易误导的表述。
6. 源码安装若需要构建授权，目录条目必须提供 GitHub Release 托管的 `.tgz`。
7. 提交后运行目录仓库自己的 README 生成命令，并等待 CI 与维护者核对源码和描述。

本项目的目录条目应使用：

```yaml
url: https://github.com/Jackywxsz/DSH-Creator
name: Jackywxsz/DSH-Creator
category: workflow
tarball: https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.4/jacky-creator-0.1.0-beta.4.tgz
description:
  en: "Local-first content production and operations workspace for DSH: manage ideas, scripts, media assets, schedules, goals, publishing status, and post-publication reviews."
  zh: "面向 DSH 的本地内容生产与运营工作台：管理灵感、脚本、媒体资产、档期、目标、发布状态和发布后复盘。"
```

每次发布后都要更新目录条目的 `tarball`，确保市场卡片和直接安装命令指向同一份 Release 包。

## 截图与市场材料

社区目录建议在仓库根目录提供 `screenshots.json`，列出 1 到 8 张真实界面截图。没有截图清单时，市场会从 README 提取图片；不得把未实现的概念图当成产品界面。

上架材料包括：

- 产品名：Jacky Creator for DSH。
- 一句话说明：把对话、内容生产和运营沉淀放进同一块本地创作工作台。
- GitHub、README、Changelog、Security 和支持链接。
- macOS / Windows 兼容状态。
- 最低 DSH 版本和已验证 DSH Desktop 版本。
- 文件系统、子进程、凭据和外部服务权限说明。
- 核心能力与可选 Skill 的清晰分界。
- 安装、首次配置、更新、卸载与数据保留说明。

## 未来稳定版与 npm

从 `v0.1.0-beta.3` 起，GitHub Release 包、内部 Cordis 插件 ID 和 Profile 依赖名统一为 `jacky-creator`。旧版用户先卸载旧包，再安装新包；首次启动会把旧状态非破坏性复制到 `~/.jacky-creator/`。

未来若发布 npm，可再迁移到公开 Scoped Package，例如 `@jackywxsz/jacky-creator`。npm 包、Git Tag 和 GitHub Release 必须一一对应。

稳定版还需要：

- macOS 与 Windows x64 核心流程都有真实设备证据。
- 新用户不依赖开发仓库或本机全局私有文件即可使用核心功能。
- 升级后内容目录和运营状态不丢失。
- 卸载后恢复 DSH 默认侧栏，不删除用户内容。
- 可选 Skill 缺失时明确降级，不让核心页面报错。
- GitHub Actions、打包检查和安装 Smoke Test 全部通过。
- npm 账号启用 2FA，并优先使用 GitHub Actions Trusted Publishing。
- npm 包、Git Tag 和 GitHub Release 一一对应。

## 回滚

若 Beta 或稳定版出现严重问题：

1. 保留已发布 Tag 和 Release，不重写历史。
2. 在 README 和 Release 顶部标记受影响版本。
3. 暂停或更新市场目录条目，避免继续安装问题版本。
4. npm 版本若已发布则使用 deprecate，并发布新的补丁版本。
5. 给用户提供回退到上一固定 Tag 的命令。
6. 插件卸载和版本回退都不得自动删除 `~/.jacky-creator/`、旧版状态目录或内容目录。

## 依赖平台变化时

此路径假设 DSH Desktop 继续使用普通 DeepSeek Harness Profile 和插件机制。若桌面客户端改变安装方式，发行仍以 GitHub Release 和官方 DSH CLI 为保底，插件核心不得依赖桌面客户端私有 API。
