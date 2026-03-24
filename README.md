# Review Environment Service

MR 临时开发环境服务。为 GitLab Merge Request 提供一键式 Review 环境——Reviewer 通过 URL 即可进入已就绪的 Web 终端，内置 AI 编码工具，支持查看 UI、交互追问、即时修改代码。

## 功能概览

- 多项目管理：通过 SPA 管理界面配置多个 GitLab 项目，每个项目独立的 PAT、Webhook Secret、镜像配置
- MR 自动感知：GitLab Webhook 自动检测 MR 事件，MR 打开时自动发布 Review 环境链接
- 一键启动容器：在终端页面选择 AI 工具镜像，一键创建 Review 容器
- Web 终端：容器内运行 ttyd，通过 Docker 随机端口映射直接访问
- 应用预览：容器内 dev server 端口自动映射到宿主机随机端口，直接通过端口访问
- 镜像模板系统：在管理界面选择 AI 工具 × 运行环境组合，在线构建 Review 镜像
- 容器生命周期：超时自动清理、资源限制（CPU/内存）、MR 关闭/合并自动销毁

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
├──────────────────────┬──────────────────────────────────────┤
│   React SPA          │   ttyd / dev server                  │
│   (管理界面)         │   (直接访问容器随机端口)              │
│   localhost:3333     │   localhost:<随机端口>                │
└──────────┬───────────┴──────────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│   Express Server     │
│   (API + SPA 托管)   │
│   :3333              │
├──────────┬───────────┤
│          │           │
│  ┌───────▼────────┐  │
│  │   dockerode    │  │──── Docker API ──── review-net (bridge)
│  └────────────────┘  │                      │
│  ┌────────────────┐  │              ┌───────▼────────┐
│  │  better-sqlite3│  │              │ review-env-*   │
│  │  (data/review  │  │              │ (ttyd + AI工具) │
│  │   .sqlite)     │  │              └────────────────┘
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │  GitLab API    │  │
│  └────────────────┘  │
└──────────────────────┘
```

技术栈：

- 前端：React + TypeScript + Vite + shadcn/ui + TanStack Table
- 后端：Express + TypeScript
- 数据库：SQLite (better-sqlite3)
- 容器管理：dockerode
- 构建工具：Turbo (monorepo)

## 项目结构

```
review-env/
├── packages/
│   ├── web/                    # React SPA 前端
│   │   └── src/
│   │       ├── pages/          # 页面组件
│   │       │   ├── Dashboard.tsx       # 首页概览
│   │       │   ├── ProjectList.tsx     # 项目列表
│   │       │   ├── ProjectDetail.tsx   # 项目详情（镜像配置）
│   │       │   ├── Images.tsx          # 镜像管理（构建/测试/删除）
│   │       │   ├── ImageBuild.tsx      # 镜像构建向导
│   │       │   ├── Containers.tsx      # 容器监控
│   │       │   └── Terminal.tsx        # MR Review 终端页
│   │       └── components/     # 通用组件（侧边栏、导航等）
│   └── server/                 # Express 后端
│       └── src/
│           ├── server.ts               # 入口，路由注册
│           ├── config.ts               # 环境变量配置
│           ├── db/                     # SQLite 数据层
│           │   ├── schema.ts           # 建表 + 迁移
│           │   ├── projects.ts         # 项目 CRUD
│           │   ├── project-images.ts   # 镜像配置 CRUD
│           │   ├── containers.ts       # Review 容器记录
│           │   └── test-containers.ts  # 测试容器记录
│           ├── routes/
│           │   ├── api.ts              # 管理 API（项目/镜像/容器/MR/统计）
│           │   ├── docker.ts           # Docker API（镜像列表/构建/测试容器）
│           │   ├── terminal.ts         # 终端页 API（状态/启动/停止）
│           │   └── webhook.ts          # GitLab Webhook 处理
│           └── services/
│               ├── docker-manager.ts   # 容器生命周期管理
│               ├── gitlab-api.ts       # GitLab REST API 封装
│               └── image-templates.ts  # Dockerfile 模板生成
├── Dockerfile                  # 服务容器镜像（多阶段构建）
├── docker-compose.yml          # 生产部署编排
├── turbo.json                  # Turbo 构建配置
└── .env.example                # 环境变量模板
```

## 快速开始

### 前置条件

- Node.js 22+
- Docker（macOS 推荐 Colima 或 Docker Desktop）
- GitLab 实例 + Personal Access Token（需要 api 权限）

### 开发模式

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 GITLAB_URL

# 启动开发服务（前后端同时启动，支持热更新）
npm run dev
```

前端默认 `http://localhost:5173`（Vite dev server），后端 `http://localhost:3333`。

### Docker 部署

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env

# 一键启动
docker compose up -d
```

服务运行在 `http://localhost:3333`。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GITLAB_URL` | GitLab 实例地址 | `https://gitlab.internal` |
| `PORT` | 服务监听端口 | `3333` |
| `MAX_CONTAINERS` | 最大并发容器数 | `20` |
| `CONTAINER_TIMEOUT_HOURS` | Review 容器超时时间（小时） | `4` |
| `CONTAINER_CPU_LIMIT` | 容器 CPU 核数限制 | `2` |
| `CONTAINER_MEMORY_LIMIT` | 容器内存限制 | `4g` |
| `DOCKER_HOST_IP` | Docker 宿主机 IP（容器内运行时设为 `host.docker.internal`） | `127.0.0.1` |
| `TEST_CONTAINER_TIMEOUT_MINUTES` | 测试容器超时时间（分钟） | `30` |
| `DOCKER_SOCK` | Docker socket 路径（macOS Colima 用户需设置） | `/var/run/docker.sock` |

## 使用指南

### 1. 添加项目

在管理界面 `/projects` 页面点击「添加项目」，填写：

- 项目名称
- GitLab Project ID（数字，在 GitLab 项目 Settings → General 中查看）
- GitLab PAT（Personal Access Token，需要 api 权限）
- Webhook Secret（自定义密钥，用于验证 Webhook 请求）

项目路径（`path_with_namespace`）会通过 GitLab API 自动获取。

### 2. 配置 GitLab Webhook

在 GitLab 项目 Settings → Webhooks 中添加：

- URL: `http://<服务地址>:3333/webhook/<GitLab Project ID>`
- Secret Token: 与添加项目时填写的 Webhook Secret 一致
- Trigger: 勾选 Merge request events

MR 打开时，Webhook 会自动在 MR 中发布 Review 环境链接。MR 关闭或合并时，自动销毁对应容器。

### 3. 构建 Review 镜像

在 `/images` 页面点击「构建新镜像」：

1. 选择 AI 工具（如 Claude Code）
2. 选择运行环境（Node / Python）
3. 确认镜像名称和 Tag
4. 点击构建，实时查看构建日志

构建完成后，在项目详情页的镜像配置中引用该镜像。

### 4. 配置项目镜像

在项目详情页 `/projects/:id` 的镜像列表中添加镜像配置：

- 标识名：唯一标识（如 `claude-code-node`）
- 显示名：用户看到的名称（如 `Claude Code (Node)`）
- Docker 镜像：镜像全名（如 `claude-code-node:latest`）
- 端口：容器需要映射的额外端口，逗号分隔（如 `3000,5173`）
- 环境变量：JSON 格式的额外环境变量

### 5. 使用 Review 环境

Reviewer 访问 MR 评论中的链接（或直接访问 `/mr/<projectId>/<mrIid>`）：

1. 选择 AI 工具镜像
2. 等待容器初始化（clone 代码 → 就绪）
3. 进入 Web 终端
4. 如有配置额外端口，通过随机映射端口访问 dev server

## 技术实现

### 数据模型

```
projects (项目)
├── id, name, gitlab_url, gitlab_project_id, project_path
├── gitlab_pat, webhook_secret
└── git_user_name, git_user_email

project_images (镜像配置)
├── id, project_id (FK → projects)
├── name, display_name, image
├── env_vars (JSON), ports (逗号分隔)
└── sort_order, enabled

containers (Review 容器)
├── id, project_id (FK → projects), image_id (FK → project_images)
├── mr_iid, branch, container_id
├── ports (JSON: {容器端口: 宿主机端口})
└── created_at

test_containers (测试容器)
├── id, container_id, container_name, image
├── host_port
└── created_at, last_accessed_at
```

### 容器管理

- 所有容器加入 `review-net` Docker bridge network
- 容器命名规则：`review-env-<gitlabProjectId>-mr-<mrIid>`
- 端口策略：ttyd (7681) + 用户配置的额外端口，全部映射到宿主机随机端口
- 通过 `docker inspect` 获取实际分配的宿主机端口
- 每 60 秒检查超时容器并自动清理
- 服务启动时从数据库恢复状态，与 Docker 实际状态校验

### 镜像模板系统

`image-templates.ts` 动态生成 Dockerfile 和 entrypoint.sh：

- 模板组合：AI 工具（claude-code）× 运行环境（node / python）
- Dockerfile 包含：基础镜像 + git/curl + ttyd + AI 工具安装
- entrypoint.sh：配置 git 凭证 → shallow clone 分支 → 启动 ttyd
- 构建通过 Docker API 直接传入 tar 流，不依赖本地文件

### API 概览

管理 API (`/api`):

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 项目详情 |
| PUT | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目（同时销毁所有容器） |
| GET | `/api/projects/:id/images` | 项目镜像配置列表 |
| POST | `/api/projects/:id/images` | 添加镜像配置 |
| PUT | `/api/projects/:id/images/:imageId` | 更新镜像配置 |
| DELETE | `/api/projects/:id/images/:imageId` | 删除镜像配置 |
| GET | `/api/projects/:id/mrs` | 项目 Open MR 列表 |
| GET | `/api/projects/:id/mrs/:mrIid/validate` | 验证 MR 是否有效 |
| GET | `/api/containers` | 所有活跃容器 |
| DELETE | `/api/containers/:id` | 停止并删除容器 |
| GET | `/api/stats` | 系统统计 |

Docker API (`/api/docker`):

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/docker/images` | Docker 镜像列表 |
| DELETE | `/api/docker/images/:id` | 删除镜像（仅限 review-service 构建的） |
| GET | `/api/docker/templates` | 可用模板列表 |
| POST | `/api/docker/build` | 构建镜像（SSE 实时日志） |
| POST | `/api/docker/test` | 启动测试容器 |
| DELETE | `/api/docker/test/:containerId` | 停止测试容器 |

终端 API (`/mr`):

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/mr/:projectId/:mrIid/status` | 容器状态 |
| POST | `/mr/:projectId/:mrIid/start` | 启动容器 |
| POST | `/mr/:projectId/:mrIid/stop` | 停止容器 |
| GET | `/mr/:projectId/:mrIid/images` | 可用镜像列表 |

Webhook:

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/webhook/:projectId` | GitLab Webhook 接收 |
