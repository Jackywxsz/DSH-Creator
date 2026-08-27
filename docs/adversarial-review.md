# Creator Cockpit 对抗性审查

审查日期：2026-08-24，Beta 发布复核日期：2026-08-25。范围为 `feature/creator-cockpit-operations` 分支、预构建 npm tarball 与隔离 DSH Profile。

## 审查结论

### Beta 发布复核

- **GitHub Beta：GO。** 允许 `v0.1.0-beta.1` 继续接受 macOS + DSH Desktop 2.0.2 用户测试。
- **稳定版 / 插件市场：NO-GO。** Windows x64 真机、市场安装、升级迁移和正式 Web 启动仍缺完整证据；本 Beta 不发布 npm，也不添加 `dsh-plugin` Topic。
- 对抗审查发现预构建 `lib/client.js` 曾在 CSS 虚拟模块注释中携带构建机绝对路径。已改为仓库相对模块 ID，并在 `release:check` 增加运行产物隐私扫描和负向测试；重新构建后扫描无命中。
- 安装时会出现 DSH 宿主 Peer 缺失警告，但安装、Bundle 组合和卸载均成功；小白文档已说明以最终完成状态与 `dsh: pnpm failed` 为判断边界。
- Security Reviewer：未发现高置信度、可从当前插件入口利用的新注入、凭据泄露或权限绕过。
- Architecture Reviewer：2026-08-25 的审核决定是暂时保留旧内部身份；该决定已由 `v0.1.0-beta.3` 的 `jacky-creator` 品牌迁移取代，旧名称只用于上游署名、历史记录和非破坏性状态迁移。

1. **正式安装范围是否可控：PASS。** 开发与浏览器验收只写 `.lab`。正式 profile 中的插件已经是指向当前仓库的本地链接，本次只重建该链接指向的 `lib` 产物；没有改远程依赖、API Key 或内容目录。
2. **是否出现两个 sidebar owner 或两个 `oilCreator` service：PASS。** 额外 patch 禁用已安装 bundle，只加载当前仓库；组合 graph 只有一个同名 bundle 和一个侧栏 owner。
3. **是否复制内容事实：PASS。** `ContentOperationsMeta` 严格 schema 不允许标题、topic、script、workflow、pipeline 或 publish；界面实时 join Oil Creator。
4. **是否把缺失数据显示为零：PASS。** 播放、点赞、评论和粉丝在没有来源时保持 `undefined`；只有可证明的空发布计数显示 0。
5. **是否存在双击重复创建：PASS。** 灵感升级按 ideaId 使用单航班 Promise，并要求预览时 revision；并发集成测试只调用一次 `createContent`。
6. **是否能路径穿越写出 library root：PASS。** 创建后执行 `lstat`、`realpath` 和相对路径校验，拒绝 root 本身、`..`、绝对逃逸和 symlink。实验准备与启动器另行拒绝 `.lab` 外内容目录、symlink lab root 和 symlink library root。
7. **AI 是否能越界评分或伪造 total：PASS。** 工具参数使用 0 到 5 的整数枚举，Zod 再次校验；请求没有 total 字段，Host 重算并由 state invariant 复核。
8. **内容变化后旧评分是否误认为最新：PASS。** 指纹由 topic、script 和 rubricVersion 计算；界面重新读取内容并标记过期，Host 拒绝用旧指纹保存新评分。
9. **AI 草稿是否会直接沉淀规则：PASS。** 模型只拥有保存草稿工具。确认复盘、规则和模板都是 UI Remote，且后两者要求已确认 review 和再次确认。
10. **去掉测试 patch 后是否能回滚：PASS。** patch 只作为隔离启动参数存在，没有写入正式 profile；停止实验进程后，正常 DSH Desktop 继续使用原安装。
11. **旧数据能否安全进入 v3：PASS。** v0、v1、v2 迁移补齐选项目录、统一档期、知识索引、标签和知识关系，不创造内容事实；旧 `dueAt` 只迁移成一条关联内容的档期事项。第一次写回前备份原始 state。旧代码回滚时需要恢复迁移前备份。
12. **运营知识是否会复制或覆盖脚本：PASS。** `cockpit_get_script_context` 只返回真实 topic、策略和已选知识，不返回第二份脚本；系统提示和脚本页指令都要求读取 `oil_script_rules`，最终写入真实 `script.md`。
13. **知识索引是否能绕过人工确认：PASS。** 模型没有保存知识的工具。规则和模板只能从已确认 review 的 UI 操作生成，Markdown 成功落盘后才建立 state 索引。
14. **窄屏是否产生页面级横向溢出：PASS。** 375×812 下 `scrollWidth === clientWidth === 375`。灵感双栏折为单列，管线和档期只在自身区域滚动。
15. **备份恢复是否可能静默覆盖并发更新：PASS。** 导入先迁移并严格校验 schema，再校验用户打开恢复时的 expected revision；串行写入前再次校验 revision。替换前自动备份当前 state，导入的知识 Markdown 在受控知识目录重建，内容正文和素材不在恢复范围内。
16. **原版视觉是否实际生效：PASS。** 1280px 浏览器计算值为 hero `rgb(255, 223, 43)`、边框 `rgb(17, 17, 17)`、阴影 `6px 6px 0`、页面纸张 `rgb(242, 241, 236)`；正式 DSH Desktop 截图同样显示黄侧栏、黄 hero、蓝色操作态与黑色硬阴影。

## 额外失败注入

- 损坏 `state.json`：保留损坏文件，并按 revision 与时间数值顺序恢复最新有效备份，包括两位数 revision。
- state mutator 抛错：原 state 保持不变。
- topic 写入失败：保留新内容并返回人工恢复说明。
- 路径校验或状态关联在创建后失败：返回 contentId 和目录，明确要求人工核对且不要直接重试。
- 同名知识文件内容不同：拒绝覆盖。
- 确认复盘 Markdown 写入失败：review 保持草稿，不产生「已确认但文件缺失」状态。
- 未发布内容：Host 拒绝生成发布后复盘 context 或草稿。
- 无当前 session、会话忙碌或输入框非空：不替换用户草稿，不提交 AI 指令。
- 隔离环境无模型凭据：可见指令仍正常进入会话，模型返回 `MISSING_CREDENTIAL`，没有外部调用。
- 规则或模板被停用：脚本 context 不再返回该条目；已有 metadata 关系保留，重新启用后可恢复。
- v2 内容期限迁移：旧 `dueAt` 只生成一条档期，已存在同内容同时间档期时不重复生成。
- 备份导入 revision 过期：拒绝替换；当前 state revision 和内容保持不变。
- 备份导出：下载文件名包含日期，JSON 可解析为 schema v3，并包含内容选项、层级、标签、档期类型和里程碑颜色。

## 验证门禁

最终门禁包括 TypeScript、Cockpit 定向测试、全量 Vitest、Host/Client build、1280px 与 375px 浏览器检查、灵感卡选择、全局快捷入口、管线搜索筛选、JSON 备份、脚本知识桥和正式 profile 产物检查。

2026-08-25 Beta 门禁：`pnpm check` 通过。TypeScript 检查通过，47 个测试文件共 282 个测试全部通过，Host、Typert 和 Client 构建成功。预构建 `dsh-oil-creator-0.1.0-beta.1.tgz` 共 23 个条目，包含最新 Host、Client、Typert、采集脚本、Bundle Patch、README、安装/分发文档、安全策略和品牌说明；不包含测试缓存、实验目录、用户内容或本机绝对路径。

### 2026-08-27 发布与复盘闭环复核

- **主发布判定：PASS。** 只有启用平台参与统计；零个平台发布时保持待发布，任一启用平台发布后进入已发布和复盘，其余平台只显示分发进度。已发布内容不会因旧的可选资产缺失而重新打开前置步骤；手动修改实际发布日期会覆盖旧值，重复确认但未指定日期时仍保留原值。
- **人工复盘：PASS。** 无 AI 会话时可直接保存复盘草稿；Host 自行读取最新发布上下文并生成指纹。草稿确认后才写入 `knowledge/reviews`，规则和模板仍各自弹出第二次确认。
- **AI 权限：PASS。** 六维评分降为展开策略内的可选发布前诊断，不阻塞发布；建议只有用户点击采纳才写入下一步。模型仍没有确认复盘或沉淀知识的工具。
- **真实浏览器：PASS。** 隔离 Lab 中完成了人工草稿保存、确认写入、规则二次确认、未开始内容始终可见的 `0/4` 发布状态、`1/4` 分发进度和诊断折叠验证；1280px、390px、浅色和深色均可操作，控制台无错误。
- **最终门禁：PASS。** `pnpm check` 通过，50 个测试文件共 307 个测试全部通过，TypeScript、Host、Typert 与 Client 构建成功。

使用 DSH Desktop 2.0.2 自带的 DeepSeek Harness 0.1.1-rc.2 CLI，在全新的临时 `DSH_HOME` / `web` Profile 中从该 tarball 安装成功；组合配置中只有一个 `dsh-oil-creator` Bundle，默认 `ui-sidebar` 被该 Bundle 按设计替换。执行 `dsh plugin remove dsh-oil-creator` 后，插件 Bundle 消失且默认侧栏恢复。隔离 Web 进程尝试启动时受到当前 macOS 全局文件监听上限影响，报 `EMFILE: too many open files, watch`；因此本轮不把临时 Web 启动计为通过。正式 DSH Desktop UI 已在同一代码分支完成过可见验收，发布后仍要求用户从 GitHub Release 再做一次真实安装与重启验收。
