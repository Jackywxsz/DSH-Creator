# Creator Cockpit 对抗性审查

审查日期：2026-08-24。范围为 `feature/creator-cockpit-operations` 分支与仓库内隔离运行环境。

## 审查结论

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

2026-08-24 最终门禁：`pnpm check` 通过。TypeScript 检查通过，44 个测试文件共 260 个测试全部通过，Host、Typert 和 Client 构建成功。npm 安装包 dry-run 共 17 个条目，包含最新 `lib/index.js`、`lib/client.js`、`lib/typert.host.js`、采集脚本、bundle patch、README 和全部文档；未包含缓存、截图或实验目录。
