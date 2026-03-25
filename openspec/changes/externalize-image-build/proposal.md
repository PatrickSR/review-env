## 为什么

当前镜像构建系统采用硬编码的模板矩阵（AI 工具 × 运行环境），只支持 Claude Code + Node/Python 两种组合。用户无法自定义工具链、无法选择其他语言运行时（Go、Rust、Java 等），也无法安装自己需要的开发工具。每新增一个工具或运行环境都需要修改后端代码，维护成本随组合数量指数增长。

## 变更内容

- 新增 `review-base` 基础镜像（基于 ubuntu:24.04），仅包含 git、ttyd、curl、bash 和 entrypoint.sh，不绑定任何语言运行时或 AI 工具
- 改造 entrypoint.sh：支持通过环境变量 `BEFORE_SCRIPT`（base64 编码）传入用户自定义初始化脚本，在 clone 后、ready 前执行；ttyd 启动时检测 `$SHELL`；before_script 失败时写 error 但 ttyd 照样启动
- 改造 `/images/build` 页面：从"选择模板"改为"编写/粘贴 Dockerfile"，预填可直接构建的示例 Dockerfile
- 改造 `POST /api/docker/build` API：从接收 `tool + runtime` 改为接收用户提供的 `dockerfile` 内容
- **BREAKING** 删除 Dockerfile 模板系统（`image-templates.ts`、`GET /api/docker/templates`）
- 改造镜像删除逻辑：去掉 `managed-by` label 限制，所有镜像均可删除
- 项目镜像配置新增 `before_script` 字段，在添加/编辑镜像弹窗中提供 textarea 输入
- CI workflow 新增 `review-base` 镜像构建 job，与 `review-env` 共用同一个 workflow
- 仓库新增 `docker/Dockerfile.base` 和 `docker/entrypoint.sh` 文件

### 非目标

- 不提供在线 Dockerfile 语法校验或 lint
- 不支持多文件构建上下文（COPY 本地文件）
- 不做 review-base 镜像的版本管理 UI
- 不提供镜像市场或社区模板

## 功能 (Capabilities)

### 新增功能
- `review-base-image`: review-base 基础镜像定义（Dockerfile.base + entrypoint.sh），包含 git、ttyd、curl、before_script hook 机制，发布到 ghcr.io
- `dockerfile-build`: 用户自定义 Dockerfile 构建功能，替代原有模板构建，用户在 UI 中编写 Dockerfile 并通过 SSE 实时查看构建日志

### 修改功能
- `image-builder`: 构建 API 从模板驱动改为接收用户 Dockerfile 内容，删除模板系统
- `image-registry`: 去掉 managed-by label 区分逻辑，所有镜像均可删除
- `multi-image`: 添加镜像表单新增 before_script textarea 字段
- `review-image`: entrypoint 重写，支持 before_script 环境变量和 $SHELL 检测，基础镜像从 node:22 改为 review-base
- `ci-docker-publish`: CI workflow 新增 review-base 镜像构建 job

## 影响

- 后端删除：`image-templates.ts`、`GET /api/docker/templates` 端点
- 后端修改：`POST /api/docker/build` 参数变更（`dockerfile` 替代 `tool + runtime`）、`DELETE /api/docker/images/:id` 去掉 managed 检查
- 后端新增：`project_images` 表新增 `before_script` 列，`createContainer` 传入 `BEFORE_SCRIPT` 环境变量
- 前端删除：模板选择 UI（TOOLS/RUNTIMES 卡片）
- 前端修改：`ImageBuild.tsx` 改为 Dockerfile 编辑器、`ImageFormModal` 新增 before_script textarea、`Images.tsx` 去掉 managed badge 和删除限制
- CI 修改：`docker-publish.yml` 新增 review-base 构建 job
- 新增文件：`docker/Dockerfile.base`、`docker/entrypoint.sh`
