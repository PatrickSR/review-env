## 1. 推送前准备

- [x] 1.1 使用 git filter-repo 改写所有历史 commit 的 author 为 `patrick <15920996910sun@gmail.com>`
- [x] 1.2 设置项目级 git config（`user.name=patrick`，`user.email=15920996910sun@gmail.com`）
- [ ] 1.3 添加 GitHub remote 并推送代码到 https://github.com/PatrickSR/review-env

## 2. GitHub Actions Workflow

- [ ] 2.1 创建 `.github/workflows/docker-publish.yml` workflow 文件，配置 tag 推送（`v*`）和 `workflow_dispatch` 触发条件
- [ ] 2.2 配置 Docker Buildx 和 QEMU 多平台构建环境（linux/amd64 + linux/arm64）
- [ ] 2.3 配置 ghcr.io 登录（使用 GITHUB_TOKEN）和 metadata-action 自动生成镜像标签（版本号 + latest）
- [ ] 2.4 配置 build-push-action 执行多平台构建并推送到 `ghcr.io/patricksr/review-env`

## 3. Docker Compose 配置改造

- [ ] 3.1 修改 `docker-compose.yml`，将 `build:` 替换为 `image: ghcr.io/patricksr/review-env:latest`，保持其余配置不变
- [ ] 3.2 创建 `docker-compose.build.yml`，包含 `build:` 指令和与 `docker-compose.yml` 完全一致的 volumes/networks/environment/ports 配置

## 4. 验证

- [ ] 4.1 本地构建验证：使用 `docker compose -f docker-compose.build.yml up -d --build` 构建并启动，确认服务正常（API 响应、SPA 页面加载）
- [ ] 4.2 打 tag 并推送，触发 GitHub Actions 构建，确认 workflow 执行成功
- [ ] 4.3 预构建镜像验证：使用 `docker compose up -d` 拉取 ghcr.io 镜像并启动，确认服务正常
