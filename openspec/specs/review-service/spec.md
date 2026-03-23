## 目的

定义 Review Service 的核心功能，包括 Webhook 处理、终端服务、容器管理和 GitLab 集成。

## Requirements

### 需求:Webhook 接收与验证
Review Service 必须监听 HTTP POST 请求 `/webhook/:projectId`，根据 URL 中的 projectId 从数据库查找项目配置，验证请求头中的 `X-Gitlab-Token` 与该项目的 webhook_secret 一致。不一致时必须返回 401，项目不存在时必须返回 404。

#### 场景:收到合法的 MR 事件
- **当** GitLab 发送 merge_request webhook 到 `/webhook/42` 且 X-Gitlab-Token 与项目 42 的 webhook_secret 匹配
- **那么** 服务解析事件并根据 action（open/merge/close）执行对应逻辑

#### 场景:收到伪造的 webhook
- **当** 收到 POST 请求到 `/webhook/42` 但 X-Gitlab-Token 与项目 42 的 webhook_secret 不匹配
- **那么** 服务返回 HTTP 401，不执行任何操作

#### 场景:项目不存在
- **当** 收到 POST 请求到 `/webhook/999` 但数据库中不存在 gitlab_project_id=999 的项目
- **那么** 服务返回 HTTP 404

### 需求:终端页面与初始化流程
用户访问 `/mr/:projectId/:mrIid` 时，Review Service 必须根据容器状态展示不同内容。页面必须先展示工具选择界面，用户选择后再启动容器。

#### 场景:首次访问，无容器
- **当** 用户访问 `/mr/42/17` 且该 MR 没有运行中的容器
- **那么** 页面必须展示该项目可用的 AI 工具列表，等待用户选择并启动

#### 场景:已有容器运行中
- **当** 用户访问 `/mr/42/17` 且该 MR 已有容器在运行
- **那么** 页面必须显示当前运行的工具信息，并展示 ttyd 终端（如已就绪）或初始化进度

#### 场景:项目不存在
- **当** 用户访问 `/mr/999/17` 但数据库中不存在 gitlab_project_id=999 的项目
- **那么** 服务必须返回 404 页面

#### 场景:超过最大并发数
- **当** 当前运行中的容器数已达上限
- **那么** 服务必须在页面显示资源不足提示，禁止启动新容器

### 需求:Web Terminal（docker exec 桥接）
Review Service 必须通过反向代理将终端请求转发到容器内的 ttyd 服务。Review Service 禁止自行实现终端 WebSocket 桥接或 docker exec stream 处理。

#### 场景:终端反向代理
- **当** 浏览器请求 `/mr/:projectId/:mrIid/terminal/*`（包括 HTTP 和 WebSocket）
- **那么** Review Service 必须将请求反向代理到该容器对应的 ttyd 端口，包括 WebSocket 升级请求

#### 场景:终端输入输出
- **当** 用户在 ttyd 终端中输入命令
- **那么** ttyd 通过 PTY 将输入传递给容器内 bash，输出通过 ttyd → WebSocket → 浏览器返回，支持完整的交互式终端（echo、prompt、颜色、快捷键、resize）

#### 场景:连接断开
- **当** 用户关闭浏览器或 WebSocket 断开
- **那么** ttyd 关闭对应的 PTY 会话，但容器保持运行，用户可重新连接

### 需求:容器停止与清理
Review Service 必须支持三种方式停止并移除容器：Web 页面手动停止、超时自动清理、MR 状态变更触发。测试容器必须纳入超时自动清理范围。

#### 场景:Web 页面手动停止
- **当** 用户在终端页面或管理界面点击停止按钮
- **那么** 服务停止并移除对应容器，更新数据库记录

#### 场景:超时自动清理
- **当** 容器运行时间超过配置的超时时间（正式容器默认 4 小时，测试容器默认 30 分钟）
- **那么** 服务自动停止并移除容器，删除数据库记录
- **并且** 测试容器的超时必须基于 `last_accessed_at` 字段判断，正式容器基于 `created_at` 字段判断

#### 场景:MR 合并或关闭时清理
- **当** 收到 merge_request webhook 且 action 为 merge 或 close
- **那么** 服务停止并移除该项目该 MR 对应的容器（如果存在），删除数据库记录

### 需求:GitLab API 集成
Review Service 必须通过 GitLab REST API 在 MR 评论中回写环境链接。API 调用必须使用对应项目的配置。

#### 场景:MR 创建时回写链接
- **当** 收到 merge_request webhook 且 action 为 open
- **那么** 服务使用该项目的 gitlab_pat 在 MR 评论中发布终端 URL `/mr/{projectId}/{mrIid}`

### 需求:状态恢复
Review Service 重启后必须从 SQLite 数据库恢复容器管理状态，并与 Docker 实际状态校验。恢复范围必须包括正式容器和测试容器。

#### 场景:服务重启
- **当** Review Service 进程重启
- **那么** 服务必须从 `containers` 表和 `test_containers` 表读取记录，对每个记录检查 Docker 容器是否实际存在，删除已不存在的记录，更新端口映射信息

### 需求:容器列表 API
`GET /api/containers` 必须返回所有由 review-service 管理的容器，包括正式容器和测试容器。

#### 场景:统一容器列表
- **当** 前端请求 `GET /api/containers`
- **那么** 接口必须合并 `containers` 表和 `test_containers` 表的数据，每条记录必须包含 `type` 字段（值为 `"review"` 或 `"test"`）
- **并且** 测试容器的 `project_name` 为 null，`mr_iid` 为 null，`image_display_name` 取自 `test_containers.image` 字段

### 需求:容器状态 API
Review Service 必须提供容器状态查询接口，路径包含 projectId。

#### 场景:查询状态
- **当** 前端轮询 `GET /mr/:projectId/:mrIid/status`
- **那么** 返回 JSON，包含状态（not_found / creating / initializing / ready / error）、端口映射和当前使用的镜像信息

### 需求:Runtime 与框架
Review Service 必须使用 Node.js 运行 TypeScript 代码，禁止使用 Bun runtime。

#### 场景:服务启动
- **当** 启动 Review Service
- **那么** 使用 `npx tsx packages/server/src/server.ts` 或编译后的 JS 运行，Express 监听配置端口
