## 目的

定义 Docker bridge network 配置、ttyd 宿主机端口直连和多端口随机映射策略。

## Requirements

### 需求:Docker bridge network
系统必须创建名为 `review-net` 的 Docker bridge network。review-service 和所有 review 容器必须加入此网络。容器间必须通过容器名进行通信。

#### 场景:review-service 启动时确保网络存在
- **当** review-service 启动
- **那么** 系统必须检查 `review-net` 网络是否存在，不存在则创建

#### 场景:review 容器加入网络
- **当** 创建新的 review 容器
- **那么** 容器必须加入 `review-net` 网络，且可通过容器名 `review-env-{projectId}-mr-{mrIid}` 被其他容器访问

### 需求:ttyd 通过宿主机端口直连
review-service 创建 MR 容器时，必须将 ttyd 端口（7681）映射到宿主机随机端口（`HostPort: "0"`）。前端必须通过宿主机地址和映射端口直连 ttyd，禁止通过反向代理访问。测试容器的 ttyd 端口映射策略保持不变。

#### 场景:正式容器 ttyd 端口映射
- **当** 创建新的 MR review 容器
- **那么** 容器的 7681 端口必须映射到宿主机随机端口，映射信息必须通过 `container.inspect()` 获取并存储到 `containers` 表的 `ports` 字段

#### 场景:前端直连 ttyd
- **当** 用户在终端页面选择工具并启动容器后，容器状态变为 ready
- **那么** 前端必须从 status API 的 `ports` 字段获取 7681 对应的宿主机端口，使用 `http://${location.hostname}:${ttydPort}/` 作为 iframe src 直连 ttyd

#### 场景:测试容器 ttyd 端口映射不变
- **当** 创建测试容器
- **那么** ttyd 端口映射策略保持现有行为（映射到宿主机随机端口，通过 `DOCKER_HOST_IP` 访问）

### 需求:多端口随机映射
系统必须支持通过项目镜像配置或全局配置指定容器内端口列表。创建容器时，每个端口必须由 Docker 随机分配宿主机端口。系统必须通过 `container.inspect()` 获取实际映射并记录到数据库。

#### 场景:多端口映射
- **当** 创建新的 review 容器且配置了多个应用端口
- **那么** 每个应用端口必须各自映射到 Docker 随机分配的宿主机端口

#### 场景:获取实际端口映射
- **当** review 容器创建并启动后
- **那么** 系统必须通过 inspect 获取每个端口的实际宿主机映射，并存储在 containers 表的 ports 字段中

#### 场景:状态 API 返回端口信息
- **当** 用户请求 `GET /mr/{projectId}/{mrIid}/status` 且容器状态为 ready
- **那么** 响应必须包含 `ports` 字段，格式为容器端口到宿主机端口的映射

#### 场景:状态恢复时重新获取端口
- **当** review-service 重启并执行状态恢复
- **那么** 系统必须对每个数据库中记录的容器执行 inspect，更新端口映射信息

### 需求:双平台支持
系统必须同时支持 macOS (Colima) 和 Linux (原生 Docker) 环境。网络和端口策略在两个平台上的行为必须一致。

#### 场景:macOS Colima 环境
- **当** 在 macOS + Colima 环境下执行 `docker compose up -d`
- **那么** review-service 必须正常启动，能创建 review 容器，ttyd 代理和端口映射必须正常工作

#### 场景:Linux 原生 Docker 环境
- **当** 在 Linux 原生 Docker 环境下执行 `docker compose up -d`
- **那么** review-service 必须正常启动，行为与 macOS 环境一致
