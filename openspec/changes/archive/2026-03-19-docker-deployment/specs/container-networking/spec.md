## ADDED Requirements

### 需求:Docker bridge network
系统必须创建名为 `review-net` 的 Docker bridge network。review-service 和所有 review 容器必须加入此网络。容器间必须通过容器名进行通信。

#### 场景:review-service 启动时确保网络存在
- **当** review-service 启动
- **那么** 系统必须检查 `review-net` 网络是否存在，不存在则创建

#### 场景:review 容器加入网络
- **当** 创建新的 review 容器
- **那么** 容器必须加入 `review-net` 网络，且可通过容器名 `review-env-mr-<id>` 被其他容器访问

### 需求:ttyd 通过 Docker network 代理
review-service 必须通过 Docker network 内部地址代理 ttyd 请求。ttyd 端口（7681）禁止映射到宿主机。代理目标必须为 `http://review-env-mr-<id>:7681`。

#### 场景:ttyd WebSocket 代理
- **当** 用户访问 `/mr/<id>/terminal`
- **那么** review-service 必须通过 Docker network 将请求代理到 `review-env-mr-<id>:7681`

#### 场景:ttyd 端口不暴露到宿主机
- **当** review 容器创建时
- **那么** 7681 端口禁止绑定到宿主机端口

### 需求:多端口随机映射
系统必须支持通过环境变量 `APP_PORTS` 配置一组容器内端口（逗号分隔）。创建容器时，每个端口必须由 Docker 随机分配宿主机端口。系统必须通过 `container.inspect()` 获取实际映射并记录。

#### 场景:多端口映射
- **当** APP_PORTS 配置为 `3000,5173,8080`，且创建新的 review 容器
- **那么** 容器的 3000、5173、8080 端口必须各自映射到 Docker 随机分配的宿主机端口

#### 场景:获取实际端口映射
- **当** review 容器创建并启动后
- **那么** 系统必须通过 inspect 获取每个端口的实际宿主机映射，并存储在 ContainerInfo 中

#### 场景:状态 API 返回端口信息
- **当** 用户请求 `GET /mr/<id>/status` 且容器状态为 ready
- **那么** 响应必须包含 `ports` 字段，格式为 `{ "3000": 32768, "5173": 32769 }` 的容器端口到宿主机端口映射

#### 场景:状态恢复时重新获取端口
- **当** review-service 重启并执行 recoverState
- **那么** 系统必须对每个已存在的容器执行 inspect，重新获取端口映射信息

### 需求:移除 preview 路由代理
系统必须移除 `/mr/<id>/preview` 路由。用户必须通过 Docker 随机分配的宿主机端口直接访问容器内的 app。

#### 场景:preview 路由不存在
- **当** 用户访问 `/mr/<id>/preview`
- **那么** 系统必须返回 404

### 需求:双平台支持
系统必须同时支持 macOS (Colima) 和 Linux (原生 Docker) 环境。网络和端口策略在两个平台上的行为必须一致。

#### 场景:macOS Colima 环境
- **当** 在 macOS + Colima 环境下执行 `docker compose up -d`
- **那么** review-service 必须正常启动，能创建 review 容器，ttyd 代理和端口映射必须正常工作

#### 场景:Linux 原生 Docker 环境
- **当** 在 Linux 原生 Docker 环境下执行 `docker compose up -d`
- **那么** review-service 必须正常启动，行为与 macOS 环境一致
