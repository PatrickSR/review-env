## 目的

定义 Docker 镜像列表管理功能，包括列出宿主机镜像、区分 review 镜像与外部镜像、删除镜像和启动临时测试容器。

## Requirements

### 需求:列出宿主机镜像
系统必须提供 API 列出宿主机上所有 Docker 镜像，并标识哪些是 review-service 构建的镜像。

#### 场景:获取镜像列表
- **当** 请求 `GET /api/docker/images`
- **那么** 系统必须返回宿主机上所有有 tag 的 Docker 镜像列表，每个镜像包含名称、tag、大小、创建时间和 `managed` 布尔字段

#### 场景:识别 review 镜像
- **当** 镜像包含 Docker Label `managed-by=review-service`
- **那么** 该镜像的 `managed` 字段必须为 true

#### 场景:过滤 dangling 镜像
- **当** 宿主机上存在无 tag 的镜像（`<none>:<none>`）
- **那么** 系统必须将其从列表中排除

### 需求:删除 review 镜像
系统必须允许删除 review-service 构建的镜像，禁止删除外部镜像。

#### 场景:删除 review 镜像
- **当** 请求 `DELETE /api/docker/images/:id` 且该镜像的 `managed-by` Label 为 `review-service`
- **那么** 系统必须调用 Docker API 删除该镜像并返回成功

#### 场景:拒绝删除外部镜像
- **当** 请求 `DELETE /api/docker/images/:id` 且该镜像不包含 `managed-by=review-service` Label
- **那么** 系统必须返回 403 错误，禁止删除

#### 场景:镜像被容器使用中
- **当** 请求删除的镜像正在被某个容器使用
- **那么** 系统必须返回 409 错误，提示镜像正在使用中

### 需求:临时测试容器
系统必须支持从镜像列表启动临时容器，用于验证镜像内工具是否正常安装。

#### 场景:启动测试容器
- **当** 请求 `POST /api/docker/test` 并指定 `{ "image": "claude-code-node:latest" }`
- **那么** 系统必须使用指定镜像创建容器，不传入 BRANCH、PROJECT_PATH 等项目相关环境变量，容器启动后 ttyd 必须在 7681 端口可用

#### 场景:测试容器自动超时
- **当** 测试容器运行超过 30 分钟
- **那么** 系统必须自动停止并删除该容器

#### 场景:停止测试容器
- **当** 请求 `DELETE /api/docker/test/:containerId`
- **那么** 系统必须停止并删除该测试容器

#### 场景:测试容器不占用配额
- **当** 测试容器运行时
- **那么** 该容器禁止计入 MAX_CONTAINERS 配额，禁止记录到 containers 表

### 需求:镜像管理页面
Admin SPA 必须提供镜像管理页面，展示所有 Docker 镜像并支持操作。

#### 场景:镜像列表展示
- **当** 用户访问 `/admin/images`
- **那么** 页面必须使用 DataTable 展示所有镜像，列包含：镜像名称、Tag、大小、创建时间、操作

#### 场景:review 镜像操作
- **当** 镜像的 `managed` 为 true
- **那么** 操作菜单必须包含：测试运行、删除

#### 场景:外部镜像操作
- **当** 镜像的 `managed` 为 false
- **那么** 操作菜单必须仅包含：测试运行（禁止删除）

#### 场景:测试运行交互
- **当** 用户点击"测试运行"
- **那么** 页面必须启动测试容器，并在页面内嵌 iframe 展示 ttyd 终端，提供"停止并关闭"按钮
