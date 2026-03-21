## 目的

定义模板化镜像构建功能，支持用户在 Web 界面选择 AI 工具和运行环境组合，一键构建 Docker 镜像。

## ADDED Requirements

### 需求:Dockerfile 模板系统
系统必须维护 Dockerfile 模板，根据 AI 工具和运行环境的组合生成最终 Dockerfile。

#### 场景:Claude Code + Node 模板
- **当** 用户选择 AI 工具为 Claude Code、运行环境为 Node
- **那么** 系统必须生成基于 `node:22` 的 Dockerfile，包含 git、curl、ttyd、Claude Code（通过 npm 全局安装）和通用 entrypoint.sh

#### 场景:Claude Code + Python 模板
- **当** 用户选择 AI 工具为 Claude Code、运行环境为 Python
- **那么** 系统必须生成基于 `python:3.12` 的 Dockerfile，额外安装 Node.js 和 npm（Claude Code 依赖），包含 git、curl、ttyd、Claude Code 和通用 entrypoint.sh

#### 场景:注入管理标签
- **当** 生成任何模板的 Dockerfile
- **那么** 必须包含 `LABEL managed-by=review-service`

### 需求:镜像构建 API
系统必须提供 API 接收构建参数，调用 Docker API 构建镜像，并通过 SSE 实时推送构建日志。

#### 场景:发起构建
- **当** 请求 `POST /api/docker/build` 并指定 `{ "tool": "claude-code", "runtime": "node", "name": "claude-code-node", "tag": "latest" }`
- **那么** 系统必须根据 tool + runtime 生成 Dockerfile，调用 `docker.buildImage()` 构建镜像 `claude-code-node:latest`

#### 场景:SSE 日志推送
- **当** 镜像构建过程中
- **那么** 系统必须通过 SSE 逐行推送 Docker 构建日志到客户端

#### 场景:构建成功
- **当** 镜像构建完成且无错误
- **那么** 系统必须推送构建完成事件，包含镜像名称和大小信息

#### 场景:构建失败
- **当** 镜像构建过程中发生错误
- **那么** 系统必须推送错误事件，包含错误信息

#### 场景:无效的模板组合
- **当** 请求的 tool 或 runtime 不在支持的模板列表中
- **那么** 系统必须返回 400 错误

### 需求:镜像构建页面
Admin SPA 必须提供镜像构建界面，引导用户选择模板并展示构建过程。

#### 场景:模板选择
- **当** 用户进入构建页面
- **那么** 页面必须展示 AI 工具选择（当前仅 Claude Code）和运行环境选择（Node / Python），以卡片形式呈现

#### 场景:镜像命名
- **当** 用户选择完模板后
- **那么** 页面必须提供镜像名称和 Tag 输入框，名称根据选择自动生成默认值（如 `claude-code-node`），Tag 默认为 `latest`

#### 场景:构建日志展示
- **当** 用户点击"开始构建"
- **那么** 页面必须展示构建日志面板，实时滚动显示 Docker 构建输出

#### 场景:构建完成
- **当** 构建成功完成
- **那么** 页面必须显示成功提示，并提供"返回镜像列表"的导航
