## 目的

定义容器内 tmux 集成的安装、配置和启动行为，使用户可以在 ttyd 终端内分屏操作。

## ADDED Requirements

### 需求:tmux 安装
Review 容器镜像必须包含 tmux。

#### 场景:tmux 可用
- **当** 容器启动后
- **那么** tmux 必须存在于 PATH 中，可直接执行

### 需求:tmux 配置文件
容器必须预置对新手友好的 tmux 配置。

#### 场景:鼠标支持
- **当** 用户在 ttyd 终端中使用鼠标
- **那么** 必须支持鼠标点击切换 pane、鼠标拖拽调整 pane 大小、鼠标滚轮翻页

#### 场景:直觉分屏快捷键
- **当** 用户按下 `Ctrl+B |`
- **那么** 当前 pane 必须竖向分割（左右两栏）
- **当** 用户按下 `Ctrl+B -`
- **那么** 当前 pane 必须横向分割（上下两栏）

#### 场景:状态栏提示
- **当** tmux 会话运行时
- **那么** 底部状态栏必须显示基本分屏快捷键提示，帮助用户发现功能

#### 场景:256 色支持
- **当** tmux 会话运行时
- **那么** 必须启用 256 色终端支持（`default-terminal` 设为 `screen-256color`）

#### 场景:scrollback buffer
- **当** 用户在 tmux 中滚动查看历史输出
- **那么** scrollback buffer 必须至少为 10000 行

### 需求:tmux 会话管理
ttyd 必须通过 tmux 的 auto-attach 机制管理会话，确保页面刷新后恢复状态。

#### 场景:首次连接
- **当** 用户首次通过 ttyd 连接终端，且不存在名为 "main" 的 tmux session
- **那么** 必须创建名为 "main" 的新 tmux session，工作目录为 /workspace

#### 场景:重新连接
- **当** 用户刷新页面或 WebSocket 重连，且名为 "main" 的 tmux session 已存在
- **那么** 必须自动 attach 到已有的 "main" session，恢复之前的 pane 布局和运行状态

#### 场景:多标签页共享
- **当** 多个浏览器标签页同时连接到同一容器的 ttyd
- **那么** 所有连接必须 attach 到同一个 "main" session，共享终端视图和控制
