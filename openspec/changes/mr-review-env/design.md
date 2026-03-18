## 上下文

MR 创建后，reviewer 需要本地拉分支验证，流程繁琐。本设计描述一个基于 Bun 的 Review Service，运行在 macOS + Colima 环境，通过 webhook 监听 MR 事件，按需启动 Docker 容器，让 reviewer 通过 URL 即可进入就绪的开发环境。

关键约束：
- 运行环境为 macOS + Colima（Docker Engine via Linux VM）
- 所有用户在同一内网，网络互通
- 现有 CI 镜像（gzj-livod-ci:node22）已预装 Node.js 22 和 Claude Code
- 当前项目即 Review Service 本身
- 只服务单个 GitLab 项目，最多 20 个活跃 MR
- macOS 下宿主机无法直连容器 IP（容器运行在 Colima VM 内），需通过端口映射或 docker exec

## 目标 / 非目标

**目标：**
- reviewer 通过 `/mr/:id` URL 一键进入临时开发环境
- 访问时显示初始化进度，就绪后自动切换到 web 终端
- 通过 `/mr/:id/preview` 访问容器内 dev server
- 容器生命周期可控：手动启动/停止、超时自动清理、MR 合并/关闭时自动清理
- MR 评论命令作为补充交互方式

**非目标：**
- 不做 tunnel/反向代理到外网（内网直连即可）
- 不做用户认证（内网环境，信任网络）
- 不做 Web IDE（code-server 等），web 终端足够
- 不支持多 runner 宿主机调度
- 不支持多 repo（单 repo 模式）

## 整体架构

```
  浏览器                      Review Service (Bun)                Docker (Colima)
  ══════                      ════════════════════                ═══════════════

  GET /mr/123
       │
       ├─ 容器不存在 ──▶ 返回 loading 页面 ──▶ 自动创建容器
       │                  轮询 /mr/123/status     docker run -p 127.0.0.1:<slot>:APP_PORT
       │
       ├─ 初始化中 ────▶ 返回 loading 页面
       │                  显示进度（clone/install）
       │
       └─ 就绪 ────────▶ 返回 xterm.js 页面
                          WS /mr/123/ws
                               ↕
                          docker exec stream ◀══▶ /bin/bash in 容器

  GET /mr/123/preview/*
       │
       └─ HTTP 反向代理 ──▶ localhost:<slot端口>（映射到容器内 APP_PORT）
```

## 决策

### D1: 技术栈 — Bun + TypeScript

**选择**：Bun + TypeScript，使用 `Bun.serve()` 处理 HTTP 和 WebSocket，dockerode 操作 Docker API。

**替代方案**：
- Node.js + Express：团队熟悉，但 Bun 已是项目选型，`Bun.serve()` 原生支持 WebSocket，不需要额外框架
- Go：性能更好，但团队更熟悉 TypeScript，且服务逻辑简单

**理由**：项目已选定 Bun，`Bun.serve()` 内置路由和 WebSocket 支持，不需要 Express。Bun 自动加载 .env，简化配置。

### D2: 终端方案 — xterm.js + docker exec（不用 ttyd）

**选择**：Review Service 自己实现 web terminal。前端用 xterm.js，后端通过 dockerode 的 `container.exec()` 获取 shell stream，WebSocket 双向桥接。

**替代方案**：
- ttyd：成熟方案，但需要安装到镜像、需要代理 WebSocket、需要容器暴露端口
- 反向代理 ttyd：WebSocket 代理复杂，ttyd 的静态资源路径需要 rewrite

**理由**：
- 容器不需要暴露任何端口
- 不需要在镜像里安装 ttyd
- Review Service 完全控制终端体验（loading → terminal 的过渡）
- docker exec 通过 dockerode API 直接拿到 stream，桥接逻辑简单
- `Bun.serve()` 原生支持 WebSocket

### D3: 容器网络与 Preview 端口 — localhost 端口映射 + slot 池

**选择**：macOS + Colima 环境下，容器 IP 不可从宿主机直连（容器运行在 Colima Linux VM 内）。终端通过 docker exec（走 API socket，不走网络）。Preview 通过端口映射到 localhost（`-p 127.0.0.1:<slot端口>:APP_PORT`），Review Service 代理到 `localhost:<slot端口>`。

**端口分配**：slot 池模式，20 个 slot 对应 PREVIEW_PORT_BASE 起始的 20 个端口。容器创建时分配空闲 slot，销毁时释放。slot 号记录在 Docker label 中，服务重启时可恢复。

```
  slot 0:  -p 127.0.0.1:9000:APP_PORT
  slot 1:  -p 127.0.0.1:9001:APP_PORT
  ...
  slot 19: -p 127.0.0.1:9019:APP_PORT
```

**替代方案**：
- 容器 IP 直连：Linux 上可行，但 macOS + Colima 下宿主机无法访问容器 IP
- 自定义 bridge network：仍然无法从 macOS 宿主机直连
- Review Service 容器化 + 共享网络：引入 docker-in-docker 复杂度

**理由**：
- 终端通过 docker exec，完全不走网络，macOS/Linux 都没问题
- Preview 是唯一需要网络的部分，端口映射到 localhost 是 macOS 下最简单的方案
- 20 个 slot 足够覆盖最大并发数，内存 Map + Docker labels 管理

### D4: 容器镜像 — 基于 CI 镜像，不需要 ttyd

**选择**：基于 `gzj-livod-ci:node22` 构建 `gzj-review-env:latest`，添加 entrypoint 脚本。不需要安装 ttyd。

**理由**：终端通过 docker exec 实现，不需要 ttyd。CI 镜像已有 Node.js、git、Claude Code，只需加 entrypoint。

### D5: Clone 策略 — shallow clone 单分支

**选择**：`git clone --depth 1 --single-branch -b <source_branch>` 仅拉取 MR 的 source 分支。

**替代方案**：
- 完整 clone：浪费时间和空间
- bare repo reference clone：复杂，需要宿主机维护 bare repo

**理由**：Review 环境是一种接力，从 MR 快速进入编辑。shallow clone 最快，单分支足够。

### D6: 触发方式 — URL 访问自动启动 + 评论命令补充

**选择**：
- 主要方式：reviewer 访问 `/mr/:id` 时，如果容器不存在则自动创建
- 补充方式：MR 评论命令 `/review-start`、`/review-stop`、`/review-status`
- MR 创建时自动评论提示可用命令和 URL

**理由**：URL 访问是最自然的交互方式，评论命令作为补充（停止、查状态）。

### D7: 容器生命周期管理

**选择**：三种销毁触发方式并存：
1. 手动：`/review-stop` 评论命令
2. 超时：默认 4 小时，定时任务检查
3. 自动：MR merge/close 时 webhook 触发

服务启动时扫描已有容器（`docker ps --filter label=review-env`），恢复内存状态。

### D8: 状态管理 — 纯内存 + Docker labels

**选择**：不使用数据库。容器状态通过 Docker labels 持久化（mr_iid、branch、created_at），服务内存中维护活跃容器映射。服务重启时从 `docker ps` 重建状态。

**理由**：Docker 本身就是状态的 source of truth，labels 足够存储必要的元数据。最多 20 个容器，内存 Map 足够。

### D9: Git 配置 — 服务级统一配置

**选择**：PAT、git user name、git email 通过服务环境变量配置，启动容器时传入。所有容器共用同一个 identity。

**理由**：单 repo 模式，统一配置最简单。容器销毁时 token 随之消失。

## 项目结构

```
  src/
  ├── server.ts                # 入口：Bun.serve() 路由注册
  ├── config.ts                # 环境变量配置
  ├── routes/
  │   ├── webhook.ts           # POST /webhook — GitLab webhook 处理
  │   ├── terminal.ts          # GET /mr/:id, WS /mr/:id/ws — 终端页面与 WebSocket
  │   └── preview.ts           # ALL /mr/:id/preview/* — 应用预览反向代理
  └── services/
      ├── docker-manager.ts    # dockerode 封装，容器生命周期
      ├── port-allocator.ts    # slot 池管理，preview 端口分配
      └── gitlab-api.ts        # GitLab REST API 封装

  docker/
  ├── Dockerfile               # review 容器镜像
  └── entrypoint.sh            # 容器启动脚本

  public/
  └── terminal.html            # xterm.js 前端页面（含 loading 状态）
```

## 路由设计

```
  POST /webhook                → routes/webhook.ts（验证 X-Gitlab-Token）
  GET  /mr/:id                 → routes/terminal.ts（loading / xterm.js 页面）
  GET  /mr/:id/ws              → routes/terminal.ts（WebSocket docker exec 桥接）
  GET  /mr/:id/status          → routes/terminal.ts（容器状态 JSON API）
  ALL  /mr/:id/preview/*       → routes/preview.ts（反向代理到 localhost:slot端口）
```

## 配置项

```
  GITLAB_URL=https://gitlab.internal
  GITLAB_PAT=glpat-xxxxx
  GITLAB_PROJECT_ID=42
  GIT_USER_NAME=review-bot
  GIT_USER_EMAIL=review-bot@company.com
  WEBHOOK_SECRET=xxx
  PORT=3000                    # Review Service 监听端口
  MAX_CONTAINERS=20
  CONTAINER_TIMEOUT_HOURS=4
  APP_PORT=7702                # 容器内 dev server 端口
  PREVIEW_PORT_BASE=9000       # Preview 端口池起始端口
  REVIEW_IMAGE=gzj-review-env:latest
```

## 风险 / 权衡

- **[宿主机资源]** 多个容器同时运行可能耗尽内存 → 限制最大并发容器数（默认 20），超限时拒绝新建并提示
- **[容器残留]** 服务崩溃时容器可能未清理 → 服务启动时扫描并清理超时容器；容器设置 Docker label 便于识别
- **[Git 认证]** 容器内 clone 需要 token → 通过环境变量传入 GITLAB_PAT，容器销毁时 token 随之消失
- **[Webhook 安全]** 任何人可以发送伪造 webhook → 验证 GitLab Secret Token（X-Gitlab-Token header）
- **[端口池耗尽]** 20 个 slot 全部占用时无法创建新容器 → 与 MAX_CONTAINERS 限制一致，拒绝并提示
- **[docker exec 安全]** 任何能访问 Review Service 的人都能获得容器 shell → 内网信任环境，可接受
- **[Colima VM 资源]** Colima 默认分配 2 CPU / 2GB 内存，多容器可能不够 → 启动 Colima 时需调大资源（`colima start --cpu 4 --memory 8`）
