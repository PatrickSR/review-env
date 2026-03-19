## 为什么

当 MR 创建后，reviewer 需要本地拉分支、yarn install、yarn dev 才能验证效果，这个循环耗时 10-20 分钟且每个 MR 都要重复。我们需要一个"即测即走"的临时开发环境，让 reviewer 通过 URL 就能进入已就绪的终端，直接查看 UI、用 Claude Code 交互追问、甚至即时修改代码。

## 变更内容

构建一个基于 Bun 的 Review Service，部署在 GitLab Runner 宿主机上：

- **新增**：Review Service — 接收 GitLab Webhook，管理 Docker 容器生命周期，通过 GitLab API 在 MR 评论中回写环境链接；同时作为 Web 入口，提供终端页面（xterm.js + docker exec）和应用预览反向代理
- **新增**：Review 镜像 — 基于现有 CI 镜像（gzj-livod-ci:node22），entrypoint 自动 shallow clone 分支并安装依赖
- **新增**：GitLab Webhook 配置 — MR 事件和评论事件触发 Review Service
- **新增**：MR 评论命令交互 — reviewer 通过评论 `/review-start`、`/review-stop` 等命令控制环境

核心流程：MR 创建 → webhook 通知 → MR 评论贴环境链接 → reviewer 访问 `/mr/:id` → 容器按需启动（显示初始化进度）→ 就绪后展示 web 终端 → reviewer 使用 → 手动/超时/MR 合并时销毁。

## 关键设计决策

- **技术栈**：Bun + TypeScript，使用 `Bun.serve()` 处理 HTTP/WebSocket，dockerode 操作 Docker API
- **终端方案**：不使用 ttyd，Review Service 自己实现 web terminal（xterm.js 前端 + docker exec stream 后端），通过 WebSocket 桥接
- **应用预览**：Review Service 反向代理到容器 dev server，容器通过端口映射（`-p 127.0.0.1:<slot端口>:APP_PORT`）暴露 preview 端口到 localhost
- **容器网络**：macOS + Colima 环境，容器 IP 不可直连；终端通过 docker exec（不走网络），preview 通过 localhost 端口映射
- **端口分配**：slot 池模式，20 个 slot 对应 20 个 localhost 端口，容器创建时分配、销毁时释放
- **单 repo 模式**：只服务一个 GitLab 项目，最多 20 个活跃 MR
- **Git 配置**：PAT、git user、git email 通过服务配置统一管理，传入容器环境变量
- **Clone 策略**：shallow clone（`--depth 1 --single-branch`），仅拉取 MR source 分支

## 功能 (Capabilities)

### 新增功能
- `review-service`: Review Service 核心服务 — webhook 接收、Docker 容器管理、web terminal（xterm.js + docker exec）、应用预览反向代理、GitLab API 集成、容器生命周期管理
- `review-image`: Review 容器镜像 — 基于 CI 镜像扩展，entrypoint 脚本处理 shallow clone / install / 保持运行
- `comment-commands`: MR 评论命令系统 — 解析 `/review-start`、`/review-stop`、`/review-status` 等命令，触发对应操作

### 修改功能

（无，这是一个全新的独立服务）

## 影响

- **基础设施**：macOS + Colima 环境，运行 Review Service（Bun 进程），需要 Docker socket 访问权限
- **Docker 资源**：每个 review 容器占用内存（yarn install + dev server），最多 20 个并发容器
- **GitLab 配置**：需要配置 Webhook 指向 Review Service，需要 Access Token 用于 API 回写和容器内 git 操作
- **网络**：reviewer 需要能访问 Review Service 的地址（内网环境已满足），容器 preview 端口映射到 localhost
- **镜像仓库**：需要构建并推送 review 专用镜像
