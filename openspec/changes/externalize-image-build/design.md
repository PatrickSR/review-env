## 上下文

当前镜像构建系统在 `image-templates.ts` 中硬编码了 AI 工具（claude-code）和运行环境（node/python）的组合矩阵，通过字符串拼接生成 Dockerfile。entrypoint.sh 也以字符串常量形式内嵌在代码中。用户无法自定义工具链或运行环境，每新增一个组合都需要修改后端代码。

本次变更将镜像构建从"模板驱动"改为"用户驱动"：提供一个最小化的 `review-base` 基础镜像（仅含协议基础设施），用户基于它编写自己的 Dockerfile，在 UI 中构建。

## 目标 / 非目标

**目标：**
- 用户能基于 `review-base` 编写任意 Dockerfile 并在 UI 中构建
- `review-base` 仅包含协议基础设施（git + ttyd + entrypoint），不绑定语言运行时
- 用户能在项目镜像配置中指定 before_script，在容器 clone 代码后自动执行
- CI 自动构建并发布 `review-base` 镜像

**非目标：**
- 不支持多文件构建上下文（用户无法 COPY 本地文件到镜像）
- 不提供 Dockerfile 语法校验
- 不做 review-base 版本管理 UI

## 决策

### 1. review-base 基础镜像：ubuntu:24.04

基础镜像选择 `ubuntu:24.04`，安装 git、ttyd、curl、bash，内置 entrypoint.sh。

**影响 package**: 新增 `docker/Dockerfile.base`、`docker/entrypoint.sh`

**替代方案**：debian:bookworm-slim（更小）。放弃原因：用户更熟悉 ubuntu，apt 包更丰富，体积差异可接受。

### 2. entrypoint.sh：协议 + before_script + $SHELL 检测

entrypoint.sh 从代码字符串常量改为独立文件 `docker/entrypoint.sh`，打包进 review-base 镜像。

流程：
1. 写 status → `"cloning"`
2. 配置 git credentials
3. `git clone --single-branch -b $BRANCH` → `/workspace`
4. clone 失败 → 写 `"error: clone failed"` → 启动 ttyd → sleep infinity
5. `cd /workspace`
6. 写 status → `"initializing"`
7. 如果 `$BEFORE_SCRIPT` 非空 → base64 解码 → 执行
8. before_script 失败 → 写 `"error: before-script failed"` → 启动 ttyd → sleep infinity（不阻断）
9. 写 status → `"ready"`
10. 启动 ttyd：`ttyd -W -p 7681 -w /workspace ${SHELL:-/bin/bash}`
11. `sleep infinity`

**影响 package**: server（`docker-manager.ts` 传入 `BEFORE_SCRIPT` 环境变量）

### 3. before_script 传递：base64 环境变量

用户在添加镜像弹窗中输入 before_script 内容，存入 `project_images.before_script` 列。容器创建时，后端将内容 base64 编码后作为 `BEFORE_SCRIPT` 环境变量传入。

数据模型变更（**影响 package**: server）：
```sql
ALTER TABLE project_images ADD COLUMN before_script TEXT DEFAULT '';
```

API 变更（**影响 package**: server）：
- `POST /api/projects/:id/images` 和 `PUT /api/projects/:id/images/:imgId` 接受 `before_script` 字段
- `docker-manager.ts` 的 `createContainer` 在 envList 中追加 `BEFORE_SCRIPT=${base64(imageConfig.before_script)}`（仅当 before_script 非空时）

### 4. 构建 API 改造：接收 Dockerfile 内容

`POST /api/docker/build` 参数从 `{ tool, runtime, name, tag }` 改为 `{ dockerfile, name, tag }`。

**影响 package**: server

请求格式：
```json
{
  "dockerfile": "FROM ghcr.io/patricksr/review-base:latest\nRUN apt-get update && ...",
  "name": "my-claude-env",
  "tag": "latest"
}
```

后端直接使用用户提供的 dockerfile 内容构建，不再调用 `generateDockerfile()`。SSE 日志推送机制保持不变。`createTarStream` 函数保留，但只传入 Dockerfile（不再传 entrypoint.sh）。

删除：`image-templates.ts` 整个文件、`GET /api/docker/templates` 端点。

### 5. 镜像删除：去掉 managed-by 限制

`DELETE /api/docker/images/:id` 去掉 `managed-by=review-service` 的检查，所有镜像均可删除。

**影响 package**: server

**替代方案**：保留 managed 概念但改为用户标记。放弃原因：过于复杂，用户自己构建的镜像理应自己管理。

### 6. 构建页面改造：Dockerfile 编辑器

`/images/build` 页面从模板选择改为 Dockerfile 编辑器。

**影响 package**: web

- 去掉 AI 工具选择卡片和运行环境选择卡片
- 新增 Dockerfile textarea（monospace 字体，足够高度）
- 预填示例 Dockerfile（基于 review-base，安装 Node.js 和 Claude Code），用户不编辑也能成功构建
- 保留镜像名称和 Tag 输入
- 保留 SSE 构建日志展示

### 7. 添加镜像弹窗：新增 before_script

`ImageFormModal` 组件新增 before_script textarea。

**影响 package**: web

- monospace 字体，代码编辑器风格
- 底部提示文字："容器启动并 clone 代码后执行此脚本"
- 提交时将 before_script 作为字符串传给后端

### 8. 镜像列表页面：简化

`/images` 页面去掉 managed badge，所有镜像操作菜单统一包含"测试运行"和"删除"。

**影响 package**: web

### 9. CI workflow：新增 review-base job

在 `docker-publish.yml` 中新增一个 job 构建 `review-base` 镜像。

**影响**: `.github/workflows/docker-publish.yml`

- 与 review-env 并行构建（无依赖关系）
- 使用 `docker/Dockerfile.base` 作为构建上下文
- 发布到 `ghcr.io/patricksr/review-base`
- 共享相同的 tag 策略（semver + latest）

## 风险 / 权衡

- [用户门槛] 用户需要会写 Dockerfile → 预填可直接构建的示例降低门槛
- [单文件构建上下文] 用户无法 COPY 本地文件 → 对 `FROM review-base` + `RUN` 场景足够，高级用户可用 CLI
- [before_script 安全] 用户输入的脚本在容器内以 root 执行 → 容器本身是隔离的，风险可接受
- [before_script 每次执行] 每次创建容器都会执行 before_script → 如果脚本耗时长（如 npm install），容器启动会变慢。文档中建议将工具安装放在 Dockerfile RUN 层
- [review-base 更新传播] 用户镜像 FROM review-base 后，base 更新需要用户重新 build → 可接受，用户控制自己的更新节奏
