# 发布与插件市场路径

本文定义 Jacky Creator 从 GitHub Beta 到插件市场稳定版的唯一发布路径。它是发布约束，不是已经完成的市场上架声明。

## 当前状态

- 发布阶段：GitHub Beta。
- 当前版本：`v0.1.0-beta.1`。
- 安装来源：GitHub Release 的预构建 `.tgz`，源码与固定 Git Tag 对应。
- npm：未发布。
- 插件市场：未提交。
- 首要宿主：DSH Desktop 2.0.2 / DeepSeek Harness 0.1.1-rc.2。

## 发布链路

```text
GitHub main
  └── signed/annotated Tag
       ├── GitHub Release + 更新说明 + 预构建 .tgz
       └── npm 稳定包
            └── dsh-market 市场卡片
```

GitHub 是源码、Issue、文档和版本真源；npm 是稳定版不可变安装物；市场只负责发现和一键安装，不承载开发分支。

## 阶段一：GitHub Beta

Beta 的小白入口只安装与固定 Tag 对应的预构建包：

```bash
dsh plugin add https://github.com/Jackywxsz/DSH-Creator/releases/download/v0.1.0-beta.1/dsh-oil-creator-0.1.0-beta.1.tgz
```

发布前必须：

1. `main` 与准备发布的提交一致。
2. `package.json` 版本与 Tag 一致。
3. `pnpm check` 通过。
4. `pnpm release:check` 通过。
5. GitHub Release 安装包包含 Host、Client、Typert、Bundle Patch、README、文档和 Hero，并且无需用户授权源码构建。
6. 在干净 Profile 完成安装、重启、首次配置、升级和卸载验证。
7. 检查仓库与打包产物中没有密钥、用户内容和本机私人路径。

Git 源码安装保留给开发者。DeepSeek Harness rc.2 的 `dsh plugin` 会把参数转交 pnpm；pnpm 10 对 Git 源码包的 `prepare` 默认要求消费者在目标 Profile 的 `pnpm-workspace.yaml` 中显式允许构建，因此不作为小白主路径。

## 阶段二：npm 稳定包

稳定版计划使用公开 Scoped Package，例如 `@jackywxsz/dsh-creator`。在迁移前必须先解决 npm 包名与内部 Cordis 插件 ID、Profile 依赖名及 `~/.dsh-oil-creator` 数据目录之间的兼容关系。

在没有升级迁移测试前，不直接把内部 ID 从 `dsh-oil-creator` 改成新名称。显示品牌可以是 Jacky Creator，数据和插件身份迁移必须单独设计。

npm 发布门禁：

- npm 账号启用 2FA，并优先使用 GitHub Actions Trusted Publishing。
- npm 包从干净环境安装，不依赖仓库外文件。
- 包内不存在测试缓存、`.lab`、截图草稿、密钥或绝对路径。
- npm 版本、Git Tag 和 GitHub Release 一一对应。
- 破损版本不能覆盖重发，只能 deprecate 并发布修复版本。

## 阶段三：dsh-market

稳定版的主要社区市场选择 [dsh-market](https://github.com/dsh-market/dsh-market)。DeepSeek Harness 官方仓库提供插件机制和 `dsh-plugin` Topic，但当前没有唯一的 DeepSeek 官方插件商店。

准备上架时：

1. 给 GitHub 仓库添加 `dsh-plugin`、`deepseek-harness`、`creator-tools`、`local-first` Topic。
2. 按 dsh-market 的收录要求等待 Topic 扫描，或主动提交插件 Issue。
3. 市场卡片填写精确 npm 包、稳定版本、仓库、兼容范围、许可证和权限说明。
4. 提供中文与英文简介、Logo、四张真实界面截图和一段短演示。
5. 从市场卡片完成一次全新安装，确认实际安装来源与展示信息一致。

市场文案不得使用“DeepSeek 官方插件”“官方 DSH Desktop”等容易造成误解的表述。

## 上架材料清单

- 产品名：Jacky Creator for DSH。
- 一句话说明：把对话、内容生产和运营沉淀放进同一块本地创作工作台。
- GitHub、npm、README、Changelog、Security 和支持链接。
- macOS / Windows 兼容状态。
- 最低 DSH 版本和已验证 DSH Desktop 版本。
- 文件系统、子进程、凭据和外部服务权限矩阵。
- 核心能力与可选 Skill 的清晰分界。
- 安装、首次配置、更新、卸载与数据保留说明。
- 真实产品截图，不使用未实现概念图冒充界面。

## 稳定版上线门禁

满足以下条件才提交市场：

- macOS 与 Windows x64 核心流程均有真实设备证据。
- 新用户不依赖开发仓库或本机全局私有文件即可使用核心功能。
- 升级后内容目录和运营状态不丢失。
- 卸载后恢复 DSH 默认侧栏，不删除用户内容。
- 可选 Skill 缺失时明确降级，不让核心页面报错。
- GitHub Actions、打包检查和安装 Smoke Test 全部通过。
- README、市场卡片和实际功能没有互相冲突的声明。
- 完成一次 `check` Deep Review 和对抗式审查。

## 回滚

若 Beta 或稳定版出现严重问题：

1. 保留已发布 Tag 和 Release，不重写历史。
2. 在 README 和 Release 顶部标记受影响版本。
3. npm 版本使用 deprecate，发布新的补丁版本。
4. 暂停或撤下市场卡片，避免继续安装。
5. 给用户提供回退到上一固定 Tag 的命令。
6. 插件卸载和版本回退都不得自动删除 `~/.dsh-oil-creator/` 或内容目录。

## 依赖平台变化时

此路径假设 DSH Desktop 继续使用普通 DeepSeek Harness Profile 和插件机制。若桌面客户端改变安装方式，发行仍以 GitHub + npm + 官方 DSH CLI 为保底，插件核心不得依赖桌面客户端私有 API。
