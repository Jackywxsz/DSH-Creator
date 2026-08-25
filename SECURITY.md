# Security Policy

## Supported version

当前只为最新 Beta 或最新稳定版本提供安全修复。Developer Preview 上游发生破坏性升级时，会先完成兼容验证，再更新支持范围。

## Report a vulnerability

请不要在公开 Issue 中提交 API Key、Cookie、私人内容、本地完整路径或可直接利用的漏洞细节。

优先使用 GitHub 仓库的 Private Vulnerability Reporting。若仓库尚未启用该入口，请通过仓库所有者公开资料中的私下联系方式报告，并只提供：

- 受影响版本和运行环境。
- 最小复现步骤。
- 可能影响的数据或权限边界。
- 已脱敏日志。

维护者确认接收后，再补充必要的私密证据。公开修复前不会要求报告者在 Issue 中披露细节。

## Security boundaries

- 凭据应由 DeepSeek Harness 凭据服务保存，不得写入仓库、内容目录或运营状态文件。
- 插件不会在卸载时自动删除用户内容和 `~/.dsh-oil-creator/`。
- 外部字幕、封面和发布服务只有在用户主动配置并调用时才启用。
- 目录创建、重命名、状态恢复和知识沉淀必须保留预览、校验和人工确认边界。
