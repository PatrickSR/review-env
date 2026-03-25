## 目的

定义 GitHub Actions CI/CD 流水线规范，用于自动构建和发布 Docker 镜像到 ghcr.io。

## Requirements

### 需求:Tag 推送触发镜像构建
GitHub Actions workflow 必须在推送匹配 `v*` 格式的 git tag 时自动触发 Docker 镜像构建流程。workflow 必须同时支持 `workflow_dispatch` 手动触发。

#### 场景:推送版本 tag 触发构建
- **当** 开发者推送格式为 `v1.0.0` 的 git tag
- **那么** GitHub Actions 自动触发 docker-publish workflow 开始构建

#### 场景:手动触发构建
- **当** 开发者在 GitHub Actions 页面手动触发 workflow_dispatch
- **那么** workflow 使用当前 main 分支代码执行构建

#### 场景:普通 push 不触发
- **当** 开发者 push 代码到 main 分支（无 tag）
- **那么** docker-publish workflow 不被触发

### 需求:多平台镜像构建
workflow 必须使用 Docker Buildx 和 QEMU 构建支持 linux/amd64 和 linux/arm64 双平台的 Docker 镜像。

#### 场景:构建双平台镜像
- **当** workflow 被触发执行构建
- **那么** 产出的镜像 manifest 必须包含 linux/amd64 和 linux/arm64 两个平台的镜像层

### 需求:镜像推送到 ghcr.io
workflow 必须将构建完成的镜像推送到 `ghcr.io/patricksr/review-env`。必须使用 `GITHUB_TOKEN` 进行认证，禁止使用额外的密钥配置。

#### 场景:推送带版本标签的镜像
- **当** 由 tag `v1.2.3` 触发的构建完成
- **那么** 镜像被推送为 `ghcr.io/patricksr/review-env:v1.2.3`

#### 场景:同时更新 latest 标签
- **当** 由任意 `v*` tag 触发的构建完成
- **那么** 镜像同时被推送为 `ghcr.io/patricksr/review-env:latest`

### 需求:使用官方 Docker Actions
workflow 必须使用以下官方 GitHub Actions：
- `actions/checkout@v4`
- `docker/setup-qemu-action@v3`
- `docker/setup-buildx-action@v3`
- `docker/login-action@v3`
- `docker/metadata-action@v5`
- `docker/build-push-action@v6`

#### 场景:workflow 使用标准 Actions
- **当** 查看 workflow 文件内容
- **那么** 所有 Docker 相关步骤必须使用上述官方 Actions，禁止使用自定义脚本替代
