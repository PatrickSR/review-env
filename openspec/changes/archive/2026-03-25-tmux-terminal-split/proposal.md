## 为什么

当前 review 容器的终端通过 ttyd 直接启动 `/bin/bash`，用户只能在单个终端窗口中工作。在实际 code review 场景中，用户经常需要同时运行多个任务（如一边运行 Claude Code，一边启动 dev server 查看效果），但 iframe 嵌套的 ttyd 无法分屏，只能看到一个终端。

通过在容器中集成 tmux，让 ttyd 启动 tmux 会话而非裸 bash，用户可以在同一个终端界面内自由分屏，零前端改动即可解决问题。

## 变更内容

- **修改** entrypoint 脚本：ttyd 启动 `tmux new-session -A -s main` 替代 `/bin/bash`，支持终端分屏和会话持久化
- **新增** 容器内预置 `.tmux.conf`：开启鼠标支持、直觉快捷键、状态栏提示，降低新手使用门槛
- **修改** Dockerfile 模板：安装 tmux 依赖

## 非目标

- 不改动前端 Terminal 页面（仍使用单个 iframe）
- 不改动 ttyd 代理逻辑
- 不改动容器端口映射策略
- 不实现前端层面的多 iframe 分屏方案

## 功能 (Capabilities)

### 新增功能

- `tmux-integration`: 容器内 tmux 集成，包括安装、配置和 entrypoint 启动逻辑

### 修改功能

- `review-image`: ttyd 服务从启动 bash 改为启动 tmux 会话，Dockerfile 模板新增 tmux 安装

## 影响

- `packages/server/src/services/image-templates.ts` — entrypoint 脚本和 Dockerfile 生成逻辑
- 已构建的 review 镜像需要重新构建以包含 tmux
- 用户体验变化：终端默认进入 tmux 会话，可使用鼠标和快捷键分屏
