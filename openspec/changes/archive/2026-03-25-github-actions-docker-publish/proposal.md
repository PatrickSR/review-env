## 为什么

项目准备开源到 GitHub（https://github.com/PatrickSR/review-env）。当前用户部署需要 clone 源码并在本地执行 `docker compose up --build`，每次更新都要重新构建镜像（npm ci + turbo build），耗时 2-5 分钟。需要通过 GitHub Actions CI/CD 流水线自动构建并发布预构建 Docker 镜像到 ghcr.io，让用户只需 `docker compose pull && docker compose up -d` 即可完成部署和更新。

## 变更内容

- **新增** GitHub Actions workflow 文件（`.github/workflows/docker-publish.yml`），在 push tag `v*` 时自动构建多平台（linux/amd64 + linux/arm64）Docker 镜像并推送到 ghcr.io
- **新增** `docker-compose.build.yml`，供开发者或想自行构建的用户使用
- **修改** `docker-compose.yml`，默认使用 ghcr.io 预构建镜像（`image: ghcr.io/patricksr/review-env:latest`）替代本地 `build:`
- **修改** 项目级 git config，设置 `user.name=patrick`、`user.email=15920996910sun@gmail.com`

## 非目标

- 不涉及阿里云 ACR 或其他国内镜像仓库的推送
- 不涉及自动部署到服务器（Watchtower 等），仅构建和发布镜像
- 不修改 Dockerfile 的构建逻辑本身
- 不涉及 CI 中的测试、lint 等步骤

## 功能 (Capabilities)

### 新增功能
- `ci-docker-publish`: GitHub Actions CI/CD 流水线，tag 触发自动构建多平台 Docker 镜像并推送到 ghcr.io
- `compose-prebuilt`: docker-compose 配置改造，默认使用预构建镜像，同时保留本地构建选项

### 修改功能

## 影响

- 新增 `.github/workflows/docker-publish.yml`
- 新增 `docker-compose.build.yml`
- 修改 `docker-compose.yml`（`build:` → `image:`）
- 项目级 `.git/config` 变更（user.name / user.email）
- 用户部署方式变更：从 clone+build 变为直接 pull 预构建镜像
