## 目的

定义 Docker Compose 配置规范，支持预构建镜像部署和本地构建两种模式。

## Requirements

### 需求:默认使用预构建镜像
`docker-compose.yml` 必须默认使用 `image: ghcr.io/patricksr/review-env:latest` 引用预构建镜像，禁止包含 `build:` 指令。用户只需此文件和 `.env` 即可启动服务。

#### 场景:用户使用预构建镜像部署
- **当** 用户下载 `docker-compose.yml` 和 `.env.example`，配置 `.env` 后执行 `docker compose up -d`
- **那么** Docker 自动从 ghcr.io 拉取预构建镜像并启动服务

#### 场景:用户更新服务
- **当** 用户执行 `docker compose pull && docker compose up -d`
- **那么** Docker 拉取最新镜像并重启服务，完成更新

### 需求:保留本地构建能力
必须提供 `docker-compose.build.yml` 文件，包含 `build:` 指令，供开发者或想自行构建的用户使用。该文件必须包含与 `docker-compose.yml` 相同的 volumes、networks、environment 等配置。

#### 场景:开发者本地构建
- **当** 开发者执行 `docker compose -f docker-compose.build.yml up -d --build`
- **那么** Docker 使用本地 Dockerfile 构建镜像并启动服务

### 需求:compose 配置完整性
两个 compose 文件必须保持以下配置一致：
- Docker socket 挂载（`${DOCKER_SOCK:-/var/run/docker.sock}`）
- 数据目录挂载（`./data:/app/packages/server/data`）
- 网络配置（`review-net` bridge network）
- 环境变量加载（`env_file: .env`）
- 端口映射（`${PORT:-3333}:${PORT:-3333}`）
- 重启策略（`restart: unless-stopped`）

#### 场景:两种方式启动的服务行为一致
- **当** 分别使用 `docker-compose.yml` 和 `docker-compose.build.yml` 启动服务
- **那么** 两种方式启动的容器在 volumes、networks、ports、environment 配置上完全一致
