# Creator Cockpit 隔离开发环境

本仓库基于 `dsh-oil-creator` commit `03f8d09ce9a298578ba850c0fc5dc3ff44b568ec`，开发分支为 `feature/creator-cockpit-operations`。

测试运行不会修改 `~/.dsh/profiles/web`、已安装的 `dsh-oil-creator` 或 `~/.dsh-oil-creator`。仓库内的 `.lab/dsh-home` 是当前 web profile 的隔离镜像，其他外部 bundle 通过 `profiles/node_modules` 继续指向现有安装，本仓库则作为唯一的 `dsh-oil-creator` 来源。隔离 profile 会清空原 profile 的生命周期脚本，并把 `dsh-oil-creator` 依赖改为本仓库的 `link:` 地址，避免测试流程执行生产 profile 的修补脚本。

Oil Creator 测试写入进入 `.lab/data`，Creator Cockpit 状态写入进入 `.lab/cockpit-data`，测试内容目录固定为 `.lab/content-library`。准备脚本只生成受控示例内容，不复制真实 Oil Creator overlay 或真实内容目录。准备和启动脚本都会执行字符串路径、`lstat` 与 `realpath` 校验，拒绝仓库 `.lab` 之外的目录和 symlink 根，除非开发者显式设置 `DSH_CREATOR_COCKPIT_ALLOW_EXTERNAL_LIBRARY=1`。启动脚本每次还会重写隔离 overlay 的 `libraryRoot`。隔离 home 只创建一个空的 `.credentials.yaml` 供文件监听，不复制真实凭据。

## 准备与检查

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lab:setup
pnpm lab:config
```

`pnpm lab:config` 应只出现一个 `dsh-oil-creator` 条目，并且 `ui-sidebar` 保持禁用。它只组合并打印配置，不启动服务。

准备脚本会创建一个已发布的受控夹具，用于验证 T+3、播放、点赞、评论和复盘页面。其链接使用 `example.invalid`，不会访问真实平台。

## 启动

```bash
pnpm lab:start
```

默认地址为 `http://127.0.0.1:51873`。可用 `DSH_CREATOR_COCKPIT_PORT` 指定其他端口。

测试启动器默认设置 `CHOKIDAR_USEPOLLING=1`。这只影响隔离进程的配置文件监听，用来避免 macOS CLI 在 profile 符号链接树上触发 `EMFILE`，不会改变生产 DSH Desktop。

## 数据位置

```text
.lab/
├── content-library/       # 受控测试内容，包括升级灵感创建的目录
├── cockpit-data/          # state.json、backups、knowledge、logs
├── data/overlay.json      # 隔离 Oil Creator overlay
└── dsh-home/              # 隔离 DSH home 与 web profile
```

正常开发只应在以上目录产生运行数据。若启动器发现 `libraryRoot` 指向 `.lab` 外部，会在启动前直接失败。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lab:config
```

浏览器验收至少覆盖 1280px 和 375px 宽度，并检查会话、内容、运营五个子页面、同一 `contentId` 跳转、灵感升级、复盘指标和当前会话可见指令。

## 回滚

停止 `pnpm lab:start` 启动的进程即可。额外 patch 只由 `scripts/run-lab.mjs` 传给隔离进程，没有写进正式 profile。正常启动 DSH Desktop 或不带本仓库环境变量启动 `dsh web` 时，系统仍使用原 profile 和已安装插件。

`.lab` 只保存可重建的测试运行副本，已被 Git 忽略。需要彻底清理时，可以在确认没有测试进程运行后删除该目录；这不会触碰生产 profile 或内容目录。
