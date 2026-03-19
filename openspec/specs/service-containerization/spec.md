## 目的

定义 review-service 的 Docker 镜像构建和 Docker Compose 编排配置。

## Requirements

### 需求:服务镜像构建
系统必须提供 review-service 的 Dockerfile，将 Express 应用打包为可独立运行的 Docker 镜像。镜像必须包含所有运行时依赖，禁止依赖宿主机的 Node.js 环境。

#### 场景:构建服务镜像
- **当** 用户在项目根目录执行 `docker build -t review-service .`
- **那么** 系统成功构建包含 review-service 的 Docker 镜像

#### 场景:镜像包含所有依赖
- **当** 从构建好的镜像启动容器
- **那么** 服务必须能正常启动，无需额外安装依赖

### 需求:Docker Compose 编排
系统必须提供 docker-compose.yml 文件，定义 review-service 的完整运行配置，包括 Docker socket 挂载、review-net 网络、环境变量加载和重启策略。

#### 场景:一键启动服务
- **当** 用户在项目根目录执行 `docker compose up -d`
- **那么** review-service 容器启动并监听配置的端口，且加入 review-net 网络

#### 场景:Docker socket 可访问
- **当** review-service 容器启动后
- **那么** 容器内的 dockerode 必须能通过挂载的 socket 连接到宿主机 Docker daemon

#### 场景:服务异常自动重启
- **当** review-service 进程意外退出
- **那么** Docker 必须自动重启容器

### 需求:环境变量配置
docker-compose.yml 必须通过 env_file 加载 .env 文件中的配置。.env.example 必须包含所有必需和可选环境变量的说明，包括 APP_PORTS 的配置示例。

#### 场景:从 .env 加载配置
- **当** .env 文件包含 GITLAB_URL、GITLAB_PAT、APP_PORTS 等变量
- **那么** review-service 容器必须正确读取这些变量并正常启动
