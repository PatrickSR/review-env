## 为什么

之前通过 `tmux-terminal-split` 变更在容器中集成了 tmux 终端复用器，但实际使用体验不佳。tmux 在 ttyd iframe 中的交互体验与预期差距较大，决定撤回该变更，恢复到纯 bash 终端。

由于代码和镜像已经构建发布，需要还原代码并重新构建镜像发布新版本。同时将 `tmux-terminal-split` 变更归档。

## 非目标

- 不引入新的终端分屏方案（后续再探索其他方案）
- 不改动 ttyd 代理逻辑或前端 Terminal 页面
- 不改动容器端口映射或网络策略

## 变更内容

- **移除** `ENTRYPOINT_SH` 中的 `.tmux.conf` 写入块（整个 heredoc）
- **修改** ttyd 启动命令从 `tmux new-session -A -s main` 恢复为 `/bin/bash`（正常启动和 clone 失败两处）
- **修改** Dockerfile 模板的 apt-get install 移除 `tmux`，恢复为仅安装 `git curl`
- **归档** `openspec/changes/tmux-terminal-split/` 到 archive 目录

## 功能 (Capabilities)

### 新增功能

无

### 修改功能

- `review-image`: ttyd 服务从启动 tmux 会话恢复为启动 `/bin/bash`，Dockerfile 模板移除 tmux 安装

## 影响

- `packages/server/src/services/image-templates.ts` — 还原 entrypoint 脚本和 Dockerfile 生成逻辑
- 已构建的 review 镜像需要重新构建以移除 tmux
- `openspec/changes/tmux-terminal-split/` — 归档到 archive 目录
