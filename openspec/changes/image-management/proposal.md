## 为什么

用户通过 Docker 部署系统、配置 GitLab 项目后，在终端页面选择 AI 工具时看到一片空白。当前系统缺少镜像构建和管理的可视化入口，用户不知道如何构建 Review 镜像、不知道镜像名称填什么、也无法直观地管理宿主机上的 Docker 镜像。整个从"部署完成"到"用户能用"的链路在镜像这一环断裂了。

## 变更内容

- 新增 Admin SPA 镜像管理页面（`/admin/images`），展示宿主机上所有 Docker 镜像，支持对 review-service 构建的镜像进行删除操作，外部镜像只读
- 新增模板化镜像构建功能，用户在 Web 界面选择 AI 工具（Claude Code）和运行环境（Node / Python），一键构建镜像，实时展示构建日志
- 构建的镜像通过 Docker Label（`managed-by=review-service`）标识，用于区分 review 镜像和外部镜像
- 改造项目详情页的"添加镜像"表单：image 字段改为下拉选择宿主机已有镜像，env_vars 改为 key-value 表格编辑
- 侧边栏导航新增"镜像管理"入口

## 功能 (Capabilities)

### 新增功能
- `image-registry`: Docker 镜像列表管理，包括列出宿主机镜像、删除 review 镜像、镜像详情查看、启动临时测试容器验证镜像
- `image-builder`: 模板化镜像构建，支持 AI 工具 × 运行环境的组合选择，SSE 实时推送构建日志

### 修改功能
- `admin-spa`: 新增镜像管理页面路由和侧边栏导航入口
- `multi-image`: 添加镜像表单改造 — image 字段改为下拉选择，env_vars 改为 key-value 表格编辑

## 影响

- 后端新增 API：`GET /api/docker/images`、`POST /api/docker/build`、`DELETE /api/docker/images/:id`、`POST /api/docker/test`（启动临时测试容器）、`DELETE /api/docker/test/:id`（停止测试容器）
- 后端依赖：dockerode 已有，新增 SSE 支持用于构建日志推送
- 前端新增页面：`/admin/images`（镜像列表 + 构建入口）
- 前端修改：项目详情页的 AddImageDrawer 组件（下拉选择 + key-value 表格）
- 前端修改：侧边栏导航组件
- Docker 构建模板：需要维护 Dockerfile 模板（claude-code × node、claude-code × python）
- 现有 `docker/Dockerfile` 和 `docker/entrypoint.sh` 作为模板基础
