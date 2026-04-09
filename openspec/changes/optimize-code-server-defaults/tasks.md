## 1. 预置 code-server 默认配置

- [x] 1.1 修改 `docker/Dockerfile.base`：在 code-server 安装之后、COPY entrypoint 之前，创建 `~/.local/share/code-server/User/` 目录并写入 `settings.json`，包含深色主题、禁用 workspace trust、禁用扩展推荐、禁用 Copilot/AI 功能、禁用 GitHub 认证、禁用欢迎页和更新通知等配置项

## 2. 修改 entrypoint 启动参数

- [x] 2.1 修改 `docker/entrypoint.sh`：在 `start_ide()` 函数的 code-server 启动命令中添加 `--disable-workspace-trust` 和 `--disable-getting-started-override` 参数
