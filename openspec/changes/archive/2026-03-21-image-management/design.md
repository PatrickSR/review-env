## 上下文

当前系统支持多项目多镜像架构，项目详情页已有镜像配置的 CRUD 功能。但用户在配置镜像时面临两个断裂点：

1. 不知道如何构建 Review 镜像（docker/Dockerfile 需要手动在命令行构建）
2. 添加镜像时 image 字段需要手动输入镜像名称，不知道填什么

现有技术栈：后端 Express + dockerode + better-sqlite3，前端 React + shadcn/ui + TanStack Table，通过 Docker socket 挂载操作宿主机 Docker daemon。

## 目标 / 非目标

**目标：**
- 用户能在 Admin UI 中一键构建 Review 镜像（模板化，无需接触 Dockerfile）
- 用户能在 Admin UI 中查看和管理宿主机上的所有 Docker 镜像
- 添加镜像时能从下拉列表选择已有镜像，而非手动输入
- 环境变量配置使用 key-value 表格，而非手写 JSON

**非目标：**
- 不支持自定义 Dockerfile 编辑
- 不支持从远程 registry 拉取镜像
- 不做镜像版本管理或历史记录
- 不改动标识名/显示名的数据模型

## 决策

### 1. 镜像识别：Docker Label

通过构建时注入 `LABEL managed-by=review-service` 来标识 review 镜像。

列出镜像时，检查 Label 判断是否为 review 镜像：
- review 镜像：可删除、可重新构建
- 外部镜像：只读展示

**替代方案**：命名约定（如 `review-*` 前缀）。放弃原因：不够可靠，用户可能手动构建不带前缀的镜像。

### 2. 构建日志推送：SSE

使用 Server-Sent Events 推送构建日志。dockerode 的 `docker.buildImage()` 返回流，逐行解析后通过 SSE 推送到前端。

**替代方案**：WebSocket。放弃原因：SSE 更简单，单向推送足够，不需要双向通信。构建过程中客户端只需要接收日志，不需要发送消息。

### 3. Dockerfile 模板系统

后端维护 Dockerfile 模板，根据 AI 工具 + 运行环境组合生成最终 Dockerfile。

模板组合矩阵：

| AI 工具      | 运行环境 | 基础镜像     | 额外安装                    |
|-------------|---------|-------------|---------------------------|
| Claude Code | Node    | node:22     | git, curl, ttyd, claude-code |
| Claude Code | Python  | python:3.12 | git, curl, ttyd, nodejs, npm, claude-code |

entrypoint.sh 保持通用，所有模板共享。

模板以代码形式维护在后端（非文件系统），通过字符串拼接生成。后续扩展新工具或新环境只需添加模板配置。

### 4. 镜像列表 API 设计

`GET /api/docker/images` 调用 `docker.listImages()` 获取宿主机所有镜像，返回时附加 `managed` 布尔字段标识是否为 review 镜像。

过滤掉无 tag 的 dangling 镜像（`<none>:<none>`），只展示有意义的镜像。

### 5. 临时测试容器

镜像列表中每个镜像提供"测试运行"操作，启动一个不绑定项目/MR 的临时容器。

`POST /api/docker/test` 接收 `{ image: "claude-code-node:latest" }`，创建容器时不传 BRANCH、PROJECT_PATH 等环境变量。entrypoint.sh 中 clone 会失败，但 ttyd 仍会启动，用户可以进入终端验证工具是否正常安装。

测试容器不记录到 containers 表（不占用 MR 容器配额），使用独立的内存追踪。设置较短的自动超时（如 30 分钟），防止遗忘清理。

前端在镜像管理页面内嵌 iframe 展示 ttyd 终端，关闭时自动停止并删除容器。

### 6. 添加镜像表单改造

image 字段改为 Combobox 组件（shadcn Select + 搜索），数据源为 `GET /api/docker/images`。

env_vars 改为动态 key-value 表格：每行一个变量名 + 值，支持添加/删除行。提交时前端将表格数据序列化为 JSON 字符串，后端接口不变。

## 风险 / 权衡

- [构建耗时] 镜像构建可能需要几分钟（拉取基础镜像、安装依赖）→ SSE 实时日志让用户知道进度，前端显示构建状态
- [磁盘空间] 多个镜像占用磁盘 → 镜像列表展示大小信息，用户可手动删除不需要的镜像
- [并发构建] 多人同时构建可能导致资源竞争 → 初期不限制，后续可加构建队列
- [Python 环境体积] Python 基础镜像 + Node 运行时体积较大 → 可接受，功能优先
- [模板扩展性] 硬编码模板不够灵活 → 当前只有 2 个组合，硬编码足够；后续工具增多时再考虑配置化
