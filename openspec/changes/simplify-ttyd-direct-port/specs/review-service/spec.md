## MODIFIED Requirements

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

### 需求:终端页面与初始化流程
用户访问 `/mr/:projectId/:mrIid` 时，Review Service 必须根据容器状态展示不同内容。页面必须先展示工具选择界面，用户选择后再启动容器。

#### 场景:首次访问，无容器
- **当** 用户访问 `/mr/42/17` 且该 MR 没有运行中的容器
- **那么** 页面必须展示该项目可用的 AI 工具列表，等待用户选择并启动

#### 场景:已有容器运行中
- **当** 用户访问 `/mr/42/17` 且该 MR 已有容器在运行
- **那么** 页面必须显示当前运行的工具信息，并在容器就绪后通过 iframe 直连 ttyd 宿主机端口展示终端

#### 场景:项目不存在
- **当** 用户访问 `/mr/999/17` 但数据库中不存在 gitlab_project_id=999 的项目
- **那么** 服务必须返回 404 页面

#### 场景:超过最大并发数
- **当** 当前运行中的容器数已达上限
- **那么** 服务必须在页面显示资源不足提示，禁止启动新容器

### 需求:容器状态 API
Review Service 必须提供容器状态查询接口，返回的 ports 字段必须包含 ttyd 端口（7681）的宿主机映射。

#### 场景:查询状态（容器就绪）
- **当** 前端轮询 `GET /mr/:projectId/:mrIid/status` 且容器状态为 ready
- **那么** 返回 JSON 必须包含 `ports` 字段，其中 `7681` 键对应 ttyd 的宿主机映射端口
- **并且** 前端必须使用此端口构建 iframe URL

#### 场景:查询状态（容器未就绪）
- **当** 前端轮询 `GET /mr/:projectId/:mrIid/status` 且容器状态不是 ready
- **那么** 返回 JSON 包含当前状态（creating/initializing/error），前端继续轮询
