## 上下文

当前 review 容器通过 `ttyd -W -p 7681 -w /workspace /bin/bash` 启动终端服务。用户通过 iframe 嵌入的 ttyd 页面操作终端。由于 iframe 是一个独立文档，无法在其内部实现分屏，用户只能使用单个终端窗口。

涉及的代码在 `packages/server/src/services/image-templates.ts`，其中 `ENTRYPOINT_SH` 常量定义了容器启动脚本，`generateDockerfile()` 函数生成 Dockerfile。

## 目标 / 非目标

**目标：**
- 让用户在 ttyd 终端内可以分屏，同时运行多个任务
- 页面刷新后能恢复到之前的终端状态
- 对终端新手友好，支持鼠标操作

**非目标：**
- 不改动前端 Terminal 页面或 iframe 嵌入方式
- 不改动 ttyd 代理（ttyd-proxy.ts）
- 不改动容器端口映射或网络策略
- 不实现前端多 iframe 分屏方案

## 决策

### D1: 使用 tmux 作为分屏方案

**选择**：在容器内安装 tmux，ttyd 启动 tmux 会话而非裸 bash。

**替代方案**：
- 前端多 iframe 分屏：需要编写分屏 UI 组件，iframe 间焦点切换需鼠标点击，无会话持久化
- xterm.js 直连替换 ttyd：工作量大，需自行管理 WebSocket + PTY，重新实现 ttyd 功能
- GNU screen：功能类似 tmux 但社区活跃度低，配置灵活性不如 tmux

**理由**：tmux 是成熟的终端复用器，零前端改动，ttyd 天然支持。每个 WebSocket 连接启动独立 shell，tmux 在其上层管理分屏。用户刷新页面后 tmux 会话仍然存活，可自动重新 attach。

### D2: tmux 会话管理 — 固定 session 名 + auto-attach

**选择**：ttyd 启动命令使用 `tmux new-session -A -s main`。

- `-A`：如果名为 "main" 的 session 已存在则 attach，不存在则创建
- `-s main`：固定 session 名称

**理由**：没有 `-A` 参数时，每次 WebSocket 连接（包括页面刷新）都会创建新 session，导致 session 堆积。使用 `-A` 确保刷新页面后自动回到之前的工作状态。

### D3: 鼠标友好的 tmux 配置

**选择**：在 entrypoint 中写入 `/root/.tmux.conf`，包含以下配置：
- `set -g mouse on` — 鼠标点击切换 pane、拖拽调整大小、滚轮翻页
- 直觉快捷键：`|` 竖分、`-` 横分（替代默认的 `%` 和 `"`）
- 状态栏显示快捷键提示
- 256 色支持
- 增大 scrollback buffer

**理由**：目标用户不太熟悉终端，鼠标支持将 tmux 变成"可鼠标操作的分屏终端"，学习成本接近零。状态栏提示帮助用户发现分屏功能。

### D4: Dockerfile 模板新增 tmux 安装

**选择**：在 `generateDockerfile()` 的 apt-get install 行中追加 tmux。

**理由**：tmux 在 Debian/Ubuntu 仓库中可用，与现有的 git、curl 一起安装，不增加额外的安装步骤。基础镜像 node:22（Debian bookworm）的 apt 源包含 tmux。

## 风险 / 权衡

- **镜像体积增加** → tmux 包约 1-2MB，影响可忽略
- **tmux 与 ttyd 的交互兼容性** → ttyd 官方支持 tmux 作为启动命令，已有大量用户验证。tmux 的鼠标事件通过 ttyd 的 xterm.js 前端正常传递
- **多客户端连接同一 session** → 如果用户在多个浏览器标签页打开同一终端，所有标签页会 attach 到同一个 tmux session，看到相同内容并共享控制。这是预期行为，不是问题
- **已构建镜像需重建** → 现有镜像不包含 tmux，需要重新构建才能生效。这是一次性操作

## 影响范围

**packages/server**：
- `src/services/image-templates.ts` — 修改 `ENTRYPOINT_SH` 和 `generateDockerfile()`
