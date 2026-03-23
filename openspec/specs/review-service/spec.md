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
用户访问 `/mr/:projectId/:mrIid` 时，系统必须返回 SPA 的 index.html，由前端 React 组件处理终端页面逻辑。后端不再直接返回 terminal.html。

#### 场景:首次访问，无容器
- **当** 用户访问 `/mr/42/17` 且该 MR 没有运行中的容器
- **那么** SPA 终端页面组件必须先验证 MR 状态，有效则展示该项目可用的镜像列表，等待用户选择并启动

#### 场景:已有容器运行中
- **当** 用户访问 `/mr/42/17` 且该 MR 已有容器在运行
- **那么** SPA 终端页面组件必须显示当前运行的工具信息，并在容器就绪后通过 iframe 直连 ttyd 宿主机端口展示终端

#### 场景:MR 已关闭或不存在
- **当** 用户访问 `/mr/42/17` 但该 MR 已关闭、已合并或不存在
- **那么** SPA 终端页面组件必须显示友好的错误提示："该 MR 已关闭或不存在，请检查 MR 状态"

#### 场景:项目不存在
- **当** 用户访问 `/mr/999/17` 但数据库中不存在 gitlab_project_id=999 的项目
- **那么** SPA 终端页面组件必须显示 404 错误提示

#### 场景:超过最大并发数
- **当** 当前运行中的容器数已达上限且该 MR 无运行中容器
- **那么** SPA 终端页面组件必须显示资源不足提示，禁止启动新容器

### 需求:Web Terminal（直连 ttyd）
Review Service 禁止通过反向代理转发 MR 容器的终端请求。终端页面必须通过 iframe 直连容器 ttyd 的宿主机映射端口。Review Service 仅负责提供终端页面和容器状态信息。

#### 场景:终端直连
- **当** 容器状态为 ready 且 status API 返回 ports 中包含 7681 的宿主机映射端口
- **那么** 前端必须将 iframe src 设置为 `http://${location.hostname}:${ports[7681]}/`，直连 ttyd 服务

#### 场景:终端输入输出
- **当** 用户在 ttyd 终端中输入命令
- **那么** ttyd 通过 PTY 将输入传递给容器内 bash，输出通过 ttyd → WebSocket → 浏览器返回，支持完整的交互式终端

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
Review Service 必须提供容器状态查询接口，返回的 ports 字段必须包含 ttyd 端口（7681）的宿主机映射。

#### 场景:查询状态（容器就绪）
- **当** 前端轮询 `GET /mr/:projectId/:mrIid/status` 且容器状态为 ready
- **那么** 返回 JSON 必须包含 `ports` 字段，其中 `7681` 键对应 ttyd 的宿主机映射端口
- **并且** 前端必须使用此端口构建 iframe URL

#### 场景:查询状态（容器未就绪）
- **当** 前端轮询 `GET /mr/:projectId/:mrIid/status` 且容器状态不是 ready
- **那么** 返回 JSON 包含当前状态（creating/initializing/error），前端继续轮询

### 需求:Runtime 与框架
Review Service 必须使用 Node.js 运行 TypeScript 代码，禁止使用 Bun runtime。

#### 场景:服务启动
- **当** 启动 Review Service
- **那么** 使用 `npx tsx packages/server/src/server.ts` 或编译后的 JS 运行，Express 监听配置端口
