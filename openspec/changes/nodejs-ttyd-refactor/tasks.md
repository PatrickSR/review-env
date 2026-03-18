## 1. 项目基础 — Runtime 切换

- [x] 1.1 更新 package.json：移除 Bun 相关依赖（@types/bun），新增 Node.js 依赖（express、@types/express、http-proxy-middleware、dotenv、tsx、typescript），更新 scripts（start 改为 `npx tsx src/server.ts`），移除 `"module"` 字段
- [x] 1.2 重写 src/config.ts：使用 dotenv 加载 .env，新增 TTYD_PORT_BASE 配置项（默认 7000），保留所有现有配置
- [x] 1.3 更新 .env.example：新增 TTYD_PORT_BASE=7000
- [x] 1.4 更新 tsconfig.json：确保 Node.js + ESM 兼容配置

## 2. 容器镜像 — 安装 ttyd

- [x] 2.1 更新 docker/Dockerfile：在 node:22 基础上安装 ttyd（从 GitHub releases 下载预编译 aarch64 二进制）
- [x] 2.2 更新 docker/entrypoint.sh：初始化完成后启动 ttyd（`ttyd -W -p 7681 -w /workspace /bin/bash &`），clone 失败时也启动 ttyd 供排查

## 3. 服务层 — 端口分配与容器管理

- [x] 3.1 重写 src/services/port-allocator.ts：新增 getTtydPort(slot) 方法，基于 TTYD_PORT_BASE + slot 计算 ttyd 端口
- [x] 3.2 重写 src/services/docker-manager.ts：移除 execShell 方法和 Bun.spawn 调用，createContainer 改为双端口映射（ttyd 7681 + preview APP_PORT），使用 Node.js 标准 API
- [x] 3.3 保持 src/services/gitlab-api.ts 不变（已使用标准 fetch API，Node.js 18+ 原生支持）

## 4. 路由层 — Express 重写

- [x] 4.1 重写 src/server.ts：从 Bun.serve() 改为 Express app，注册路由和代理中间件，移除 WebSocket handler，启动时恢复状态和定时清理
- [x] 4.2 重写 src/routes/terminal.ts：移除 Bun.file() 和 handleTerminalWs，使用 Express 的 res.sendFile 返回 terminal.html，保留 status API 和自动创建容器逻辑
- [x] 4.3 重写 src/routes/webhook.ts：从 Request/Response 改为 Express req/res，逻辑不变
- [x] 4.4 重写 src/routes/preview.ts：使用 http-proxy-middleware 代理到容器 preview 端口
- [x] 4.5 新建 src/proxy/ttyd-proxy.ts：使用 http-proxy-middleware 将 `/mr/:id/terminal/` 代理到容器 ttyd 端口，支持 WebSocket 升级和路径重写

## 5. 前端 — iframe 嵌入 ttyd

- [x] 5.1 重写 public/terminal.html：移除 xterm.js 依赖，就绪后用 iframe 加载 `/mr/:id/terminal/`，保留 loading 状态轮询逻辑

## 6. 验证

- [x] 6.1 安装依赖（npm install），确认无报错
- [x] 6.2 构建 Docker 镜像（docker build -t review-env:latest docker/），确认 ttyd 安装成功
- [x] 6.3 端到端验证：启动服务 → 访问 /mr/:id → 容器创建 → loading → ttyd 终端可用 → 可输入命令
