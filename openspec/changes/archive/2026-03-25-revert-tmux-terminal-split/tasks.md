## 1. 还原 image-templates.ts

- [x] 1.1 删除 `ENTRYPOINT_SH` 中的 `.tmux.conf` heredoc 写入块（从 `# 写入 tmux 配置` 到 `TMUX_CONF` 结束，共约 25 行）
- [x] 1.2 将 clone 失败分支的 ttyd 启动命令从 `tmux new-session -A -s main` 恢复为 `/bin/bash`
- [x] 1.3 将正常启动分支的 ttyd 启动命令从 `tmux new-session -A -s main` 恢复为 `/bin/bash`
- [x] 1.4 将 `generateDockerfile()` 中的 apt-get install 从 `git curl tmux` 恢复为 `git curl`，注释从 `Install git, curl and tmux` 恢复为 `Install git and curl`

## 2. 归档 tmux-terminal-split 变更

- [x] 2.1 将 `openspec/changes/tmux-terminal-split/` 移动到 `openspec/changes/archive/2026-03-25-tmux-terminal-split/`

## 3. 构建发布

- [ ] 3.1 通过管理后台重新构建所有项目的 review 镜像，确认 Dockerfile 中不再包含 tmux
- [ ] 3.2 验证新构建的容器启动后 ttyd 直接进入 bash（无 tmux 会话）
