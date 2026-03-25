## ADDED Requirements

### 需求:review-base 镜像 CI 构建
CI workflow 必须在发布时自动构建并推送 review-base 镜像到 ghcr.io。

#### 场景:tag 触发构建
- **当** 推送 `v*` 格式的 git tag
- **那么** CI 必须构建 review-base 镜像并推送到 `ghcr.io/patricksr/review-base`

#### 场景:多架构支持
- **当** 构建 review-base 镜像
- **那么** 必须同时构建 linux/amd64 和 linux/arm64 架构

#### 场景:tag 策略
- **当** 推送 tag v1.2.3
- **那么** review-base 镜像必须打上 `1.2.3`、`1.2` 和 `latest` 三个 tag

#### 场景:与 review-env 并行构建
- **当** CI workflow 触发
- **那么** review-base 和 review-env 两个镜像的构建 job 必须并行执行，互不依赖
