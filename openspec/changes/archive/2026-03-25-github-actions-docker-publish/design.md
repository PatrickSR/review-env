## 上下文

项目即将开源到 GitHub（https://github.com/PatrickSR/review-env）。当前部署方式要求用户 clone 源码并本地构建 Docker 镜像，耗时且对用户不友好。需要建立 CI/CD 流水线自动构建并发布预构建镜像，同时改造 docker-compose 配置以支持两种使用模式：预构建镜像（面向用户）和本地构建（面向开发者）。

当前状态：
- `Dockerfile`：多阶段构建（node:22-slim），已可正常工作
- `docker-compose.yml`：使用 `build:` 指令本地构建
- 镜像仓库：无，未发布过预构建镜像

## 目标 / 非目标

**目标：**
- 通过 GitHub Actions 在 tag 推送时自动构建多平台 Docker 镜像
- 将镜像推送到 ghcr.io/patricksr/review-env
- 改造 docker-compose.yml 默认使用预构建镜像
- 保留本地构建能力供开发者使用

**非目标：**
- 不推送到阿里云 ACR 或 Docker Hub
- 不实现自动部署（Watchtower 等）
- 不在 CI 中运行测试或 lint
- 不修改 Dockerfile 构建逻辑

## 决策

### 决策 1：镜像仓库选择 ghcr.io

**选择**：ghcr.io（GitHub Container Registry）

**理由**：
- 公开 repo 的镜像免费、无拉取频率限制
- `GITHUB_TOKEN` 自动可用，无需额外配置密钥
- 镜像与 repo 关联，在 GitHub 页面可直接查看

**替代方案**：
- Docker Hub：免费版有拉取频率限制（100 pulls/6h），需额外配置凭证
- 阿里云 ACR：国内访问快，但需要额外账号和密钥管理，后续可按需添加

### 决策 2：触发方式选择 tag 推送

**选择**：仅在推送 `v*` 格式 tag 时触发构建

**理由**：
- 不是每个 commit 都需要发布镜像
- 节省 GitHub Actions 免费额度（公开 repo 无限，但构建时间有限）
- 用户拉到的 `latest` 标签始终指向最新稳定版本

**替代方案**：
- 每次 push main 都构建：浪费资源，latest 可能不稳定
- 手动触发：容易忘记，不够自动化

**补充**：同时支持 `workflow_dispatch` 手动触发，方便调试

### 决策 3：多平台构建 linux/amd64 + linux/arm64

**选择**：使用 Docker Buildx + QEMU 构建双平台镜像

**理由**：
- 覆盖主流服务器架构（Intel/AMD x86 + ARM）
- Mac M 系列用户本地测试也能直接拉取匹配的镜像
- `better-sqlite3` 是 native addon，需要在目标平台编译，多平台构建确保兼容

**替代方案**：
- 仅构建 amd64：排除 ARM 服务器和 Mac M 系列用户

### 决策 4：compose 文件组织方式

**选择**：两个独立文件
- `docker-compose.yml`：默认使用 `image:` 引用预构建镜像
- `docker-compose.build.yml`：使用 `build:` 本地构建

**理由**：
- 命名清晰，用户不会混淆
- `docker-compose.override.yml` 会被自动加载，可能导致意外行为

**替代方案**：
- 单文件 + compose profiles：语法复杂，对新手不友好
- `docker-compose.yml` + `docker-compose.override.yml`：override 自动加载会覆盖 image 配置

### 决策 5：镜像标签策略

**选择**：
- `v1.2.3`：精确版本标签（来自 git tag）
- `latest`：始终指向最新 tag

**理由**：
- 用户默认用 `latest` 即可
- 需要锁定版本的用户可以指定精确版本
- 使用 `docker/metadata-action` 自动生成标签，无需手动维护

## 风险 / 权衡

| 风险 | 缓解措施 |
|------|----------|
| ghcr.io 国内访问不稳定 | README 中说明可配置 Docker 镜像加速器；后续可按需添加阿里云 ACR |
| 多平台构建耗时较长（QEMU 模拟 ARM） | 可接受，CI 构建不影响开发体验，通常 5-10 分钟 |
| `better-sqlite3` 跨平台编译可能失败 | node:22-slim 自带编译工具链，已在本地验证可行 |
| 用户使用旧版 docker-compose.yml（含 build:）| 在 README 和 CHANGELOG 中明确说明变更 |
