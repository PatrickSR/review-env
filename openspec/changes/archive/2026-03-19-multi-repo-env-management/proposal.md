## 为什么

当前系统硬编码为单个 GitLab 仓库，每个 MR 只能启动一种固定的容器环境。随着团队管理多个项目的需求增长，以及 AI 编码工具（Claude Code、Codex、OpenCode 等）的多样化，需要将系统升级为支持多仓库、多环境类型、并提供可视化管理界面。同时，现有的内存状态管理在服务重启时依赖 Docker labels 恢复，不够可靠，需要引入持久化存储。

## 变更内容

- **引入 Turborepo monorepo 结构**：将项目拆分为 `packages/server`（后端）和 `packages/web`（管理前端）
- **引入 SQLite 持久化**：使用 better-sqlite3 替代内存 Map，存储项目配置、镜像配置和容器状态
- **多 GitLab 仓库支持**：从 .env 硬编码单仓库改为数据库动态管理多个 GitLab 项目，每个项目独立 PAT 和 Webhook Secret
- **多环境镜像支持**：每个项目可配置多个 Docker 镜像（对应不同 AI 工具），用户在终端页面选择工具后启动对应容器，同一 MR 同时只运行一个容器，切换工具时销毁重建
- **Webhook 路由改造**：从单一 `/webhook` 改为 `/webhook/:projectId`，按项目分发和验证
- **砍掉评论命令系统**：移除 `/review-start`、`/review-stop`、`/review-status` 评论命令，容器生命周期完全由 Web 驱动
- **BREAKING**: URL 从 `/mr/:id` 变为 `/mr/:projectId/:mrIid`
- **BREAKING**: 配置从 .env 单仓库模式迁移到 SQLite 动态管理
- **管理界面 (SPA)**：使用 React + shadcn/ui + Vite 构建管理后台，基于 shadcn dashboard-01 block 模板，采用 Sidebar 布局，支持项目 CRUD、镜像配置、容器监控
- **shadcn/ui 迁移**：将 Phase 4 中手写的裸 Tailwind CSS 组件全部迁移为 shadcn/ui 标准组件，严格遵循 shadcn 的组件使用方式，禁止自定义替代组件

## 功能 (Capabilities)

### 新增功能
- `multi-repo`: 支持动态管理多个 GitLab 仓库，每个项目独立配置（PAT、Webhook Secret、Git 用户信息）
- `multi-image`: 每个项目可配置多个 AI 工具镜像，用户在终端页面选择后启动对应容器，切换时销毁重建
- `sqlite-persistence`: 使用 SQLite 持久化项目、镜像和容器状态，替代内存 Map
- `admin-spa`: React + shadcn/ui 管理界面，基于 dashboard-01 block 模板，Sidebar 布局，提供项目管理、镜像配置、容器监控功能。严格使用 shadcn/ui 组件（Button、Card、Table、Input、Label、Badge、AlertDialog、Drawer、DropdownMenu、Select、Tabs 等），不允许手写替代组件
- `monorepo-infra`: Turborepo monorepo 基础设施，拆分 server 和 web 两个包

### 修改功能
- `review-service`: Webhook 路由从 `/webhook` 改为 `/webhook/:projectId`，移除评论命令系统，MR open 时发送的评论链接格式变更
- `container-networking`: 容器命名从 `review-env-mr-{mrIid}` 变为 `review-env-{projectId}-mr-{mrIid}`，代理层适配新命名
- `comment-commands`: 完全移除评论命令功能

## 影响

- **数据模型**：从内存 Map 迁移到 SQLite（projects、project_images、containers 三张表）
- **API 路由**：所有现有路由增加 projectId 维度，新增 `/api/*` 管理 API
- **配置**：.env 中移除单仓库相关配置（GITLAB_PROJECT_ID、GITLAB_PROJECT_PATH 等），保留全局配置（PORT、MAX_CONTAINERS 等）
- **前端**：terminal.html 重构为带工具选择的交互页面，新增 SPA 管理界面
- **依赖**：新增 better-sqlite3、React、shadcn/ui（含 Radix UI 原语）、@tabler/icons-react、@tanstack/react-table、recharts、@dnd-kit、sonner、zod、Vite、Turborepo
- **Docker**：Dockerfile 需适配 monorepo 构建，docker-compose.yml 需挂载 SQLite 数据卷
- **部署**：需要数据库迁移步骤，现有单仓库部署需要通过管理界面重新配置项目
