## 上下文

当前 Review Service 是一个单仓库、单镜像、内存状态的系统。所有配置硬编码在 .env 中，容器状态存储在内存 Map 中，每个 MR 只能启动一种固定的容器环境。需要将其升级为支持多仓库、多镜像选择、持久化存储，并提供 Web 管理界面。

现有代码结构：
- `src/server.ts` — Express 入口
- `src/config.ts` — 从 .env 读取单仓库配置
- `src/services/docker-manager.ts` — 内存 Map 管理容器
- `src/services/gitlab-api.ts` — 硬编码单仓库的 GitLab API 调用
- `src/routes/webhook.ts` — 单 endpoint Webhook + 评论命令
- `src/routes/terminal.ts` — 终端页面路由
- `src/proxy/ttyd-proxy.ts` — ttyd 反向代理
- `public/terminal.html` — 终端前端页面

## 目标 / 非目标

**目标：**
- 支持动态管理多个 GitLab 仓库，每个项目独立配置
- 每个项目可配置多个 Docker 镜像（对应不同 AI 工具），用户在终端页面选择
- 同一 MR 同时只运行一个容器，切换工具时销毁重建
- 使用 SQLite 持久化所有状态，替代内存 Map
- 提供 React + shadcn SPA 管理界面
- 使用 Turborepo monorepo 组织前后端代码
- 每个项目独立 Webhook endpoint 和 Secret

**非目标：**
- 不支持多 GitLab 实例（只考虑单个 GitLab 服务器）
- 不支持同一 MR 同时运行多个容器
- 不做用户认证/权限系统（管理界面无登录）
- 不做评论命令系统（已砍掉 /review-start 等命令）
- 不做容器日志实时查看
- 不做操作审计

## 决策

### D1: Monorepo 方案 — Turborepo

使用 Turborepo 管理 monorepo，拆分为 `packages/server` 和 `packages/web`。

替代方案：
- Nx：功能更强但过于重量级
- pnpm workspaces（无 orchestrator）：缺少任务编排和缓存
- 单 package 前后端混合：随着 SPA 复杂度增长会变得混乱

理由：Turborepo 轻量、配置简单，适合两个包的小型 monorepo。

### D2: 持久化方案 — SQLite + better-sqlite3

使用 better-sqlite3 直接操作 SQLite，不使用 ORM。

替代方案：
- Drizzle ORM：类型安全但多一层抽象，项目规模不需要
- PostgreSQL：需要额外的数据库服务，增加部署复杂度
- JSON 文件：并发写入不安全，查询能力弱

理由：better-sqlite3 是同步 API，简单直接，零部署依赖，适合这个规模的项目。数据库文件存储在 `data/review-env.db`。

### D3: 数据模型

三张核心表：

```sql
CREATE TABLE projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  gitlab_url      TEXT NOT NULL,
  gitlab_project_id INTEGER NOT NULL UNIQUE,
  project_path    TEXT NOT NULL,
  gitlab_pat      TEXT NOT NULL,
  webhook_secret  TEXT NOT NULL,
  git_user_name   TEXT NOT NULL DEFAULT 'review-bot',
  git_user_email  TEXT NOT NULL DEFAULT 'review-bot@company.com',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE project_images (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  image           TEXT NOT NULL,
  env_vars        TEXT NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id, name)
);

CREATE TABLE containers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mr_iid          INTEGER NOT NULL,
  branch          TEXT NOT NULL,
  image_id        INTEGER NOT NULL REFERENCES project_images(id),
  container_id    TEXT NOT NULL,
  ports           TEXT NOT NULL DEFAULT '{}',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(project_id, mr_iid)
);
```

`UNIQUE(project_id, mr_iid)` 确保同一项目同一 MR 只有一个容器。切换工具时先删除旧记录再插入新记录。

### D4: URL 设计 — 使用 GitLab Project ID

所有路由以 `gitlab_project_id` 作为项目标识：

- Webhook: `POST /webhook/:projectId`
- 终端页面: `GET /mr/:projectId/:mrIid`
- 终端状态: `GET /mr/:projectId/:mrIid/status`
- 启动容器: `POST /mr/:projectId/:mrIid/start` (body: `{ imageId: number }`)
- 停止容器: `POST /mr/:projectId/:mrIid/stop`
- ttyd 代理: `/mr/:projectId/:mrIid/terminal/*`

管理 API:
- `GET/POST /api/projects`
- `GET/PUT/DELETE /api/projects/:id`
- `GET/POST /api/projects/:id/images`
- `PUT/DELETE /api/projects/:id/images/:imageId`
- `GET /api/containers`
- `DELETE /api/containers/:id`
- `GET /api/stats` (全局统计)

替代方案：
- 使用内部自增 ID：不够直观，且 GitLab Project ID 在单实例下全局唯一
- 使用可读 slug：需要额外维护映射关系

### D5: 容器命名与代理

容器命名规则：`review-env-{projectId}-mr-{mrIid}`

ttyd 代理目标：`http://review-env-{projectId}-mr-{mrIid}:7681`

这要求 ttyd-proxy 从 URL 中同时提取 projectId 和 mrIid。

### D6: 镜像配置模型 — 项目独立配置

每个项目通过 `project_images` 表独立配置可用的 Docker 镜像。不设全局模板。

替代方案：
- 全局模板 + 项目启用：更简洁但不够灵活，不同语言项目需要不同基础镜像
- 镜像标签约定：太隐式，不好管理

理由：不同项目（前端/后端/不同语言）需要不同的基础环境，项目独立配置最灵活。

### D7: 容器生命周期 — Web 驱动

容器创建完全由 Web 页面驱动，不再通过评论命令：

1. 用户打开 `/mr/:projectId/:mrIid`
2. 页面从 API 获取该项目可用的镜像列表
3. 用户选择 AI 工具，点击启动
4. `POST /mr/:projectId/:mrIid/start { imageId }` 创建容器
5. 前端轮询状态直到 ready，然后加载 ttyd iframe
6. 切换工具：`POST /mr/:projectId/:mrIid/start { imageId }` 自动销毁旧容器再创建新容器

容器销毁触发：
- 用户手动停止（页面按钮或管理界面）
- MR merge/close（Webhook 触发）
- 超时自动清理（定时任务）

### D8: Webhook 精简

每个项目独立 Webhook endpoint `/webhook/:projectId`。

Webhook 只处理：
- `merge_request` + `open`：发评论，带 `/mr/{pid}/{mrIid}` 链接
- `merge_request` + `merge/close`：销毁容器

不再处理 `note` 事件（评论命令已砍掉）。

### D9: 前端技术栈

管理界面 SPA：
- React + TypeScript
- shadcn/ui 组件库
- Vite 构建
- React Router 客户端路由
- fetch 调用后端 API

终端页面：
- 从静态 HTML 升级为带工具选择的交互页面
- 可以是独立的 HTML 页面（不需要 React），保持轻量

Express 托管：
- `/admin/*` → SPA 静态文件（`packages/web/dist`）
- SPA 的 fallback 路由指向 `index.html`

### D10: 配置迁移

全局配置保留在 .env 中：
- `PORT` — 服务端口
- `MAX_CONTAINERS` — 最大容器数
- `CONTAINER_TIMEOUT_HOURS` — 容器超时时间
- `CONTAINER_CPU_LIMIT` — CPU 限制
- `CONTAINER_MEMORY_LIMIT` — 内存限制
- `GITLAB_URL` — GitLab 服务器地址（全局唯一）

移除的配置（迁移到 DB）：
- `GITLAB_PAT` → projects.gitlab_pat
- `GITLAB_PROJECT_ID` → projects.gitlab_project_id
- `GITLAB_PROJECT_PATH` → projects.project_path
- `WEBHOOK_SECRET` → projects.webhook_secret
- `REVIEW_IMAGE` → project_images.image
- `ANTHROPIC_*` → project_images.env_vars

### D11: 应用日志策略

系统必须在关键操作点打印结构化日志，用于问题定位和排查。不做容器日志实时查看，但应用自身的日志必须清晰可追踪。

日志级别：
- `INFO`：正常操作（容器创建/销毁、Webhook 接收、项目配置变更）
- `WARN`：异常但可恢复的情况（容器状态不一致、Docker 操作超时重试）
- `ERROR`：失败操作（容器创建失败、GitLab API 调用失败、数据库操作异常）

关键日志点：
- Webhook 接收：projectId、事件类型、MR IID
- 容器生命周期：创建（projectId、mrIid、镜像名）、销毁（原因：手动/超时/MR关闭）、状态变更
- GitLab API 调用：成功/失败、HTTP 状态码
- 数据库操作：项目/镜像的增删改
- 状态恢复：恢复的容器数、清理的过期记录数
- 错误详情：完整的 error message 和 stack（ERROR 级别）

格式：使用 `console.log/warn/error` 加统一前缀，格式为 `[时间] [级别] [模块] 消息`。当前阶段不引入日志库（如 pino/winston），保持简单。后续如有需要可替换。

替代方案：
- pino/winston：结构化日志库，功能强大但当前规模不需要
- 无日志：不可接受，无法排查生产问题

## 风险 / 权衡

- **[风险] SQLite 并发写入**：better-sqlite3 是同步的，高并发下可能阻塞事件循环 → 缓解：当前规模（几十个容器）不会有并发问题，WAL 模式可提升读并发
- **[风险] 数据库文件丢失**：SQLite 文件如果被删除，所有项目配置丢失 → 缓解：Docker volume 持久化 `data/` 目录，建议定期备份
- **[风险] 容器状态与 DB 不一致**：容器可能被外部删除但 DB 记录还在 → 缓解：启动时和定期清理时校验 Docker 实际状态
- **[权衡] 无认证的管理界面**：任何能访问服务的人都能管理项目 → 当前阶段可接受，后续可加 basic auth 或 OAuth
- **[权衡] 切换工具需要重建容器**：切换 AI 工具时需要销毁重建，包括重新 clone 代码 → 这是有意的设计选择，保证环境干净
