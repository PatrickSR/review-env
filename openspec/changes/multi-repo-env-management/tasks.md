## Phase 1. Monorepo 基础设施 + SQLite

- [x] 1.1 初始化 Turborepo monorepo 结构：创建根 `turbo.json`、根 `package.json`（workspaces 配置），创建 `packages/server/` 和 `packages/web/` 目录
- [x] 1.2 将现有后端代码迁移到 `packages/server/`：移动 `src/`、`public/`、`tsconfig.json`、`package.json`，更新导入路径
- [x] 1.3 初始化 `packages/web/`：搭建 React + Vite + TypeScript 项目，安装 shadcn/ui，配置基础路由框架
- [x] 1.4 在 `packages/server` 中引入 better-sqlite3，创建 `src/db/index.ts`（数据库初始化）和 `src/db/schema.ts`（建表语句：projects、project_images、containers）
- [x] 1.5 更新 `src/config.ts`：移除单仓库硬编码配置（GITLAB_PAT、GITLAB_PROJECT_ID 等），保留全局配置（PORT、MAX_CONTAINERS 等），新增 GITLAB_URL 作为全局配置
- [x] 1.6 更新 Dockerfile 适配 monorepo 结构：先构建 web 包生成静态文件，再构建 server 包
- [x] 1.7 更新 docker-compose.yml：添加 `data/` 目录的 volume 挂载用于 SQLite 持久化

- [x] 1.8 创建 `src/utils/logger.ts`：封装统一日志工具，格式为 `[时间] [级别] [模块] 消息`，提供 info/warn/error 方法，替换现有代码中的裸 console.log

验证方式：`npx turbo build` 能成功构建两个包；server 启动时自动创建 `data/review-env.db` 并建表；`packages/web` 能独立 `npm run build` 生成 dist 目录；server 启动日志使用统一格式输出。

## Phase 2. 多 Repo 支持

- [x] 2.1 创建 `src/db/projects.ts`：实现 projects 表的 CRUD 操作（getAll、getByGitlabProjectId、create、update、delete）
- [x] 2.2 创建 `src/db/project-images.ts`：实现 project_images 表的 CRUD 操作（getByProjectId、create、update、delete）
- [x] 2.3 创建 `src/db/containers.ts`：实现 containers 表的 CRUD 操作（getByProjectAndMr、create、delete、getAll、getExpired）
- [x] 2.4 重构 `src/services/docker-manager.ts`：从内存 Map 迁移到 SQLite，createContainer 接受 project 配置和 imageId 参数，容器命名改为 `review-env-{projectId}-mr-{mrIid}`
- [x] 2.5 重构 `src/services/gitlab-api.ts`：从读取全局 config 改为接受 project 配置参数（gitlab_url、gitlab_pat、project_id）
- [x] 2.6 重构 `src/routes/webhook.ts`：路由改为 `/webhook/:projectId`，根据 projectId 查 DB 获取项目配置并验证 secret，移除评论命令处理（/review-start、/review-stop、/review-status），MR open 时发布的评论链接格式改为 `/mr/{projectId}/{mrIid}`
- [x] 2.7 重构 `src/routes/terminal.ts`：路由改为 `/mr/:projectId/:mrIid` 和 `/mr/:projectId/:mrIid/status`，根据 projectId 查 DB 获取项目配置，移除自动创建容器逻辑（改为前端驱动）
- [x] 2.8 重构 `src/proxy/ttyd-proxy.ts`：URL 匹配改为 `/mr/:projectId/:mrIid/terminal`，代理目标改为 `http://review-env-{projectId}-mr-{mrIid}:7681`
- [x] 2.9 重构 `src/server.ts` 中的状态恢复逻辑：从 containers 表读取记录，与 Docker 实际状态校验，删除已不存在的容器记录
- [x] 2.10 创建管理 API 路由 `src/routes/api.ts`：实现 projects CRUD（GET/POST /api/projects、GET/PUT/DELETE /api/projects/:id）和 project_images CRUD（GET/POST /api/projects/:id/images、PUT/DELETE /api/projects/:id/images/:imageId）以及容器管理（GET /api/containers、DELETE /api/containers/:id、GET /api/stats）

验证方式：通过 curl 调用 `POST /api/projects` 添加两个不同的 GitLab 项目；两个项目的 Webhook 都能正常接收和处理；通过 curl 调用 `POST /api/projects/:id/images` 为项目添加镜像配置；数据持久化在 SQLite 中，重启后数据不丢失；所有关键操作（Webhook 接收、容器创建/销毁、API 调用、DB 变更）都有统一格式的日志输出。

## Phase 3. 多镜像 + 工具选择

- [x] 3.1 在 `src/routes/terminal.ts` 中新增 `POST /mr/:projectId/:mrIid/start` 路由：接受 `{ imageId }` 参数，如果已有容器则先销毁，再根据 imageId 创建新容器
- [x] 3.2 在 `src/routes/terminal.ts` 中新增 `POST /mr/:projectId/:mrIid/stop` 路由：停止并移除当前 MR 的容器
- [x] 3.3 在 `src/routes/terminal.ts` 中新增 `GET /mr/:projectId/:mrIid/images` 路由：返回该项目已启用的镜像列表供前端展示
- [x] 3.4 重构 `public/terminal.html`：从自动创建容器改为先展示工具选择界面，用户选择后调用 start API，支持切换工具（销毁重建），显示当前运行的工具信息
- [x] 3.5 更新 `GET /mr/:projectId/:mrIid/status` 响应：增加当前使用的镜像信息（image_id、display_name）

验证方式：打开 `/mr/{projectId}/{mrIid}` 页面能看到工具选项列表；选择一个工具点击启动后容器创建成功，终端可用；切换到另一个工具后旧容器被销毁，新容器创建成功。

## Phase 4. 管理界面 (SPA)

- [x] 4.1 在 `packages/web` 中搭建页面路由结构：`/admin`（首页/统计）、`/admin/projects`（项目列表）、`/admin/projects/:id`（项目详情+镜像管理）、`/admin/containers`（容器监控）
- [x] 4.2 实现项目列表页：展示所有项目（名称、GitLab 路径、镜像数量、容器数量），支持添加和删除项目
- [x] 4.3 实现项目详情页：展示项目配置表单（可编辑），展示该项目的镜像列表，支持添加、编辑、删除、启用/禁用镜像
- [x] 4.4 实现容器监控页：展示所有运行中容器（项目名称、MR 编号、使用的镜像、运行时长），支持手动停止容器
- [x] 4.5 实现首页统计面板：展示活跃容器数、已配置项目数、最大容器限制
- [x] 4.6 在 `packages/server` 中配置 Express 托管 SPA：`/admin/*` 指向 web 包的 `dist/` 目录，支持客户端路由 fallback（所有 `/admin/*` 未匹配的请求返回 `index.html`）
- [x] 4.7 配置 Vite 开发代理：开发模式下将 `/api/*`、`/webhook/*`、`/mr/*` 请求代理到 server 端口

验证方式：访问 `/admin` 能看到统计面板；在 `/admin/projects` 能添加新项目并配置镜像；在 `/admin/containers` 能看到运行中的容器并手动停止；所有操作通过 UI 完成，数据正确持久化。
