# 参与贡献

感谢你为 Jacky Creator 提交问题或改进。安装失败、数据安全、升级兼容和核心工作流问题会优先处理。

## 提交问题

提交 Issue 前请先搜索是否已有同类问题，并提供：

- 操作系统与版本。
- DSH Desktop / DeepSeek Harness 版本。
- Jacky Creator Git Tag 或提交号。
- 最短复现步骤。
- 预期结果与实际结果。
- 已脱敏日志或截图。

不要提交 API Key、Cookie、个人内容或未脱敏绝对路径。安全问题请阅读 [SECURITY.md](SECURITY.md)。

## 本地开发

```bash
git clone https://github.com/Jackywxsz/DSH-Creator.git
cd DSH-Creator
pnpm install --frozen-lockfile
pnpm check
```

隔离运行 Creator Cockpit：

```bash
pnpm lab:setup
pnpm lab:config
pnpm lab:start
```

隔离 Profile 不应修改正式 DSH Profile。详细说明见 [docs/lab-development.md](docs/lab-development.md)。

## Pull Request

- 从功能分支提交，不直接在 `main` 上开发。
- 一次 PR 只解决一个明确问题，避免顺手重构无关代码。
- 行为变化必须补测试和用户文档。
- 不能删除上游 MIT 归属，也不能把 Jacky 品牌资产改成通用 MIT 素材。
- 提交前运行 `pnpm check`；准备版本时再运行 `pnpm release:check`。
- UI 变化请提供真实宽屏和窄屏截图，并说明对应 DSH 版本。

合并前会进行代码检查、打包检查和对抗式审查。通过测试不等于自动合并。
