## MODIFIED Requirements

### 需求:Web Terminal（docker exec 桥接）
Review Service 必须通过反向代理将终端请求转发到容器内的 ttyd 服务。Review Service 禁止自行实现终端 WebSocket 桥接或 docker exec stream 处理。

#### 场景:访问终端页面
- **当** 用户访问 `/mr/:id` 且容器已就绪
- **那么** 返回包含 iframe 的页面，iframe 指向 `/mr/:id/terminal/`，由 ttyd 提供完整的交互式终端体验

#### 场景:终端反向代理
- **当** 浏览器请求 `/mr/:id/terminal/*`（包括 HTTP 和 WebSocket）
- **那么** Review Service 必须将请求反向代理到该容器对应的 ttyd 端口（`127.0.0.1:<ttyd_slot_port>`），包括 WebSocket 升级请求

#### 场景:终端输入输出
- **当** 用户在 ttyd 终端中输入命令
- **那么** ttyd 通过 PTY 将输入传递给容器内 bash，输出通过 ttyd → WebSocket → 浏览器返回，支持完整的交互式终端（echo、prompt、颜色、快捷键、resize）

#### 场景:连接断开
- **当** 用户关闭浏览器或 WebSocket 断开
- **那么** ttyd 关闭对应的 PTY 会话，但容器保持运行，用户可重新连接

### 需求:终端页面与初始化流程
用户访问 `/mr/:id` 时，Review Service 必须根据容器状态展示不同内容。

#### 场景:容器不存在，首次访问
- **当** 用户访问 `/mr/:id` 且该 MR 没有对应容器
- **那么** 服务自动创建容器，返回 loading 页面显示"正在初始化"，页面轮询 `/mr/:id/status` 等待就绪

#### 场景:容器初始化中
- **当** 用户访问 `/mr/:id` 且容器正在初始化（clone/install 进行中）
- **那么** 返回 loading 页面，显示当前初始化进度

#### 场景:容器已就绪
- **当** 用户访问 `/mr/:id` 且容器已就绪
- **那么** 返回终端页面，通过 iframe 嵌入 ttyd 页面

#### 场景:超过最大并发数
- **当** 当前运行中的容器数已达上限（默认 20）
- **那么** 服务拒绝创建，页面显示资源不足提示

### 需求:应用预览反向代理
Review Service 必须将 `/mr/:id/preview/*` 的请求反向代理到容器内 dev server。容器通过端口映射（`-p 127.0.0.1:<preview_slot_port>:APP_PORT`）暴露 preview 端口到 localhost。

#### 场景:代理请求
- **当** 用户访问 `/mr/:id/preview/some/path`
- **那么** 服务将请求代理到 `http://127.0.0.1:<该容器的 preview slot 端口>/some/path`，返回容器 dev server 的响应

#### 场景:容器未就绪
- **当** 用户访问 `/mr/:id/preview/*` 但容器未就绪或 dev server 未启动
- **那么** 返回提示页面，告知 dev server 尚未启动

### 需求:容器启动
当需要启动容器时，Review Service 必须在宿主机上启动一个 Docker 容器。容器必须映射两个端口：ttyd 端口和 preview 端口。

#### 场景:创建容器
- **当** 触发容器创建（URL 访问或 /review-start 命令）
- **那么** 服务使用 dockerode 创建并启动容器，分配 slot，映射两个端口（`-p 127.0.0.1:<ttyd_port>:7681` 和 `-p 127.0.0.1:<preview_port>:APP_PORT`），传入环境变量，设置 review-env label

#### 场景:重复启动
- **当** 触发启动但该 MR 已有运行中的容器
- **那么** 不创建新容器，直接使用已有容器

### 需求:Runtime 与框架
Review Service 必须使用 Node.js 运行 TypeScript 代码，禁止使用 Bun runtime。

#### 场景:服务启动
- **当** 启动 Review Service
- **那么** 使用 `npx tsx src/server.ts` 运行，Express 监听配置端口，环境变量通过 dotenv 加载

#### 场景:路由注册
- **当** Express app 初始化
- **那么** 注册 webhook、terminal、preview、ttyd-proxy 路由，ttyd 和 preview 代理必须支持 WebSocket 升级

### 需求:Webhook 接收与验证
Review Service 必须监听 HTTP POST 请求，接收 GitLab Webhook 事件。服务必须验证请求头中的 `X-Gitlab-Token` 与配置的 secret 一致，不一致时必须返回 401 并忽略请求。

#### 场景:收到合法的 MR 事件
- **当** GitLab 发送 merge_request webhook 且 X-Gitlab-Token 正确
- **那么** 服务解析事件并根据 action（open/merge/close）执行对应逻辑

#### 场景:收到伪造的 webhook
- **当** 收到 POST 请求但 X-Gitlab-Token 不匹配
- **那么** 服务返回 HTTP 401，不执行任何操作

#### 场景:收到评论事件
- **当** GitLab 发送 note webhook 且评论内容以 `/review-` 开头
- **那么** 服务解析命令并执行对应操作

### 需求:容器停止与清理
Review Service 必须支持三种方式停止并移除容器：手动命令、超时自动清理、MR 状态变更触发。

#### 场景:手动停止
- **当** reviewer 发送 `/review-stop` 命令
- **那么** 服务停止并移除对应容器，在 MR 评论中确认环境已销毁

#### 场景:超时自动清理
- **当** 容器运行时间超过配置的超时时间（默认 4 小时）
- **那么** 服务自动停止并移除容器

#### 场景:MR 合并或关闭时清理
- **当** 收到 merge_request webhook 且 action 为 merge 或 close
- **那么** 服务停止并移除该 MR 对应的容器（如果存在）

### 需求:GitLab API 集成
Review Service 必须通过 GitLab REST API 在 MR 评论中回写环境状态信息。

#### 场景:启动成功回写
- **当** 容器启动成功
- **那么** 服务在 MR 评论中发布包含终端 URL（/mr/:id）、预览 URL（/mr/:id/preview/）、超时时间的信息

#### 场景:启动失败回写
- **当** 容器启动失败
- **那么** 服务在 MR 评论中发布错误信息

### 需求:状态恢复
Review Service 重启后必须能恢复已有容器的管理状态。

#### 场景:服务重启
- **当** Review Service 进程重启
- **那么** 服务通过 docker ps 扫描带有 review-env label 的容器，重建内存中的容器映射和 slot 分配

### 需求:容器状态 API
Review Service 必须提供容器状态查询接口。

#### 场景:查询状态
- **当** 前端轮询 `/mr/:id/status`
- **那么** 返回 JSON，包含状态（not_found / creating / initializing / ready / error）和相关信息
