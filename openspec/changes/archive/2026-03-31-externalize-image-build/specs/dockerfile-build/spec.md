## ADDED Requirements

### 需求:Dockerfile 构建页面
Admin SPA 必须提供 Dockerfile 编辑构建页面，用户编写或粘贴 Dockerfile 内容后一键构建镜像。

#### 场景:页面布局
- **当** 用户访问 `/admin/images/build`
- **那么** 页面必须包含：Dockerfile 编辑区域（monospace 字体 textarea）、镜像名称输入框、Tag 输入框、"开始构建"按钮

#### 场景:预填示例 Dockerfile
- **当** 用户首次进入构建页面
- **那么** Dockerfile 编辑区域必须预填一个基于 `review-base` 的示例 Dockerfile（安装 Node.js 和 Claude Code），用户不编辑也必须能成功构建

#### 场景:构建日志展示
- **当** 用户点击"开始构建"
- **那么** 页面必须展示构建日志面板，通过 SSE 实时滚动显示 Docker 构建输出

#### 场景:构建成功
- **当** 构建成功完成
- **那么** 页面必须显示成功提示，并提供"返回镜像列表"导航

#### 场景:构建失败
- **当** 构建过程中发生错误
- **那么** 页面必须显示失败提示和错误日志，提供"重新配置"按钮

### 需求:Dockerfile 构建 API
系统必须提供 API 接收用户编写的 Dockerfile 内容，调用 Docker API 构建镜像。

#### 场景:发起构建
- **当** 请求 `POST /api/docker/build` 并指定 `{ "dockerfile": "<内容>", "name": "my-image", "tag": "latest" }`
- **那么** 系统必须使用用户提供的 dockerfile 内容构建镜像，通过 SSE 推送构建日志

#### 场景:缺少必填字段
- **当** 请求缺少 dockerfile 或 name 字段
- **那么** 系统必须返回 400 错误

#### 场景:构建完成事件
- **当** 镜像构建成功
- **那么** 系统必须推送 complete 事件，包含镜像名称和大小信息
