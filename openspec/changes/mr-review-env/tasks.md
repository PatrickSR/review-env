## 1. 项目基础

- [ ] 1.1 配置 package.json，安装核心依赖（dockerode、@types/dockerode、xterm 相关前端依赖）
- [ ] 1.2 创建项目目录结构：src/（server.ts、config.ts、routes/（webhook.ts、terminal.ts、preview.ts）、services/（docker-manager.ts、port-allocator.ts、gitlab-api.ts））、docker/（Dockerfile、entrypoint.sh）、public/（terminal.html）
- [ ] 1.3 实现 config.ts — 从环境变量读取配置（Bun 自动加载 .env），提供类型安全的配置对象，包含 PREVIEW_PORT_BASE
- [ ] 1.4 创建 .env.example 配置模板

## 2. Review 容器镜像

- [ ] 2.1 编写 Dockerfile，基于 gzj-livod-ci:node22（不需要安装 ttyd）
- [ ] 2.2 编写 entrypoint.sh：配置 git credentials → shallow clone 单分支 → yarn install → 写状态标记 → sleep infinity

## 3. Docker 管理

- [ ] 3.1 实现 services/port-allocator.ts — slot 池管理，提供 allocateSlot()、releaseSlot(slot)、getPort(slot)、recoverSlots(containers) 方法，slot 范围 0-19 对应 PREVIEW_PORT_BASE 起始的 20 个端口
- [ ] 3.2 实现 services/docker-manager.ts — 封装 dockerode，提供 createContainer(mrIid, branch)（含端口映射 -p 127.0.0.1:<slot端口>:APP_PORT）、stopContainer(mrIid)（含释放 slot）、getContainerStatus(mrIid)、execShell(mrIid)、recoverState()、cleanupExpired() 方法
- [ ] 3.3 实现容器状态查询 — 通过 docker exec 读取容器内 /tmp/review-status 文件获取初始化进度
- [ ] 3.4 实现服务启动时状态恢复 — 扫描 docker ps 中带 review-env label 的容器，重建内存映射和 slot 分配
- [ ] 3.5 实现定时清理任务 — 每分钟检查容器运行时间，超时（默认 4h）自动停止并移除，释放 slot
- [ ] 3.6 实现最大并发数限制 — 创建前检查当前运行容器数和可用 slot，超限时拒绝

## 4. Web Terminal

- [ ] 4.1 实现 public/terminal.html — xterm.js + WebSocket 客户端，包含 loading 状态和终端状态的切换逻辑
- [ ] 4.2 实现 routes/terminal.ts — GET /mr/:id 返回页面、GET /mr/:id/status 返回状态 JSON、WS /mr/:id/ws 桥接 dockerode exec stream

## 5. HTTP 路由与代理

- [ ] 5.1 实现 src/server.ts — Bun.serve() 入口，注册 routes/ 下各路由模块
- [ ] 5.2 实现 routes/preview.ts — ALL /mr/:id/preview/* HTTP 反向代理到 localhost:<容器 slot 端口>

## 6. GitLab 集成

- [ ] 6.1 实现 services/gitlab-api.ts — 封装 GitLab REST API，提供 postComment(projectId, mrIid, body)、getMrInfo(mrIid) 方法
- [ ] 6.2 实现 routes/webhook.ts — POST /webhook，验证 X-Gitlab-Token，分发 merge_request 和 note 事件
- [ ] 6.3 实现 webhook 事件处理 — MR open 时发提示评论、merge/close 时清理容器、note 事件解析 /review-* 命令
- [ ] 6.4 实现评论命令处理 — /review-start（启动+回写链接）、/review-stop（停止+回写确认）、/review-status（回写状态）

## 7. 部署

- [ ] 7.1 编写 docker-compose.yml 用于部署 Review Service（挂载 /var/run/docker.sock）
- [ ] 7.2 编写 README.md — 部署步骤、GitLab Webhook 配置、环境变量说明、使用方法
