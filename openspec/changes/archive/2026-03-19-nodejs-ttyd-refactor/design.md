## 上下文

当前 Review Service 基于 Bun 运行，web 终端通过 `Bun.spawn("docker exec")` 桥接 xterm.js 前端。实践中发现 Bun 的 spawn pipe 不是 PTY，导致交互式终端完全不可用。dockerode 的 hijack 模式在 Bun 下也无法工作。

现有代码结构：
- `src/server.ts` — Bun.serve() 入口，包含 WebSocket handler
- `src/routes/terminal.ts` — 终端页面和 docker exec 桥接
- `src/routes/preview.ts` — 应用预览反向代理
- `src/routes/webhook.ts` — GitLab webhook 处理
- `src/services/docker-manager.ts` — dockerode 封装
- `src/services/port-allocator.ts` — slot 池端口分配
- `src/services/gitlab-api.ts` — GitLab API 封装
- `docker/Dockerfile` + `docker/entrypoint.sh` — 容器镜像
- `public/terminal.html` — xterm.js 前端

约束：
- macOS + Colima（2 CPU / 2GB 内存），容器 IP 不可直连
- 内网环境，无需认证
- TypeScript 编写，Node.js 运行
- 完全重写代码，不保留 Bun 特定 API

## 目标 / 非目标

**目标：**
- 将 runtime 从 Bun 切换到 Node.js，使用 tsx 运行 TypeScript
- 用 ttyd 替代自实现终端，Review Service 只做反向代理
- 保持所有现有功能：webhook、容器管理、评论命令、应用预览
- 代码全部用 TypeScript 编写
- 每个容器映射两个端口：ttyd 端口 + preview 端口

**非目标：**
- 不改变容器生命周期管理逻辑（创建/停止/超时/恢复）
- 不改变 GitLab API 集成方式
- 不改变 slot 池分配策略（仍然 20 个 slot）
- 不添加用户认证

## 决策

### D1: Runtime — Node.js + tsx

**选择**：Node.js 运行 TypeScript，使用 `tsx` 作为 loader（`npx tsx src/server.ts`）。

**替代方案**：
- ts-node：配置复杂，ESM 支持不如 tsx
- 编译后运行（tsc + node）：开发体验差，需要 build 步骤

**理由**：tsx 零配置运行 TypeScript + ESM，体验最接近 Bun。

### D2: HTTP 框架 — Express + http-proxy-middleware

**选择**：Express 处理路由，http-proxy-middleware 处理 ttyd 和 preview 的反向代理（包括 WebSocket 自动升级）。

**替代方案**：
- 原生 http 模块 + 手动代理：代码量大，WebSocket 代理需要手动处理
- Fastify：性能更好但团队更熟悉 Express
- Koa：中间件生态不如 Express

**理由**：Express 生态成熟，http-proxy-middleware 内置 WebSocket 代理支持，一行配置即可代理 ttyd 的 HTTP + WebSocket。

### D3: 终端方案 — ttyd 反向代理

**选择**：容器内运行 ttyd（监听 7681 端口），Review Service 通过 http-proxy-middleware 将 `/mr/:id/terminal/` 反向代理到容器的 ttyd 端口。前端 terminal.html 使用 iframe 嵌入 ttyd 页面。

**替代方案**：
- Node.js + dockerode exec hijack：可行，但需要自己处理 PTY resize、demux、xterm.js 集成
- node-pty：需要 native addon，Bun/Node 兼容性不确定

**理由**：ttyd 是成熟的 web terminal 方案，自带 xterm.js 前端、PTY 管理、resize 支持。Review Service 只需做反向代理，逻辑极简。

### D4: 端口映射 — 双端口 slot

**选择**：每个 slot 分配两个端口：
- ttyd 端口：`TTYD_PORT_BASE + slot`（默认 7000 起）
- preview 端口：`PREVIEW_PORT_BASE + slot`（默认 9000 起）

容器创建时映射两个端口：
```
-p 127.0.0.1:<ttyd_port>:7681    # ttyd
-p 127.0.0.1:<preview_port>:APP_PORT  # preview
```

**替代方案**：
- 单端口 + 路径区分：ttyd 和 dev server 共用端口，通过路径区分 — 不可行，两者都是独立的 HTTP 服务
- 动态端口分配：复杂，不如固定 slot 池

**理由**：slot 池模式已验证可行，扩展为双端口只需增加一个 port base 配置。

### D5: ttyd 在容器中的启动方式

**选择**：entrypoint.sh 在完成 clone + install 后，启动 ttyd 作为后台进程（`ttyd -W -p 7681 /bin/bash &`），然后 `sleep infinity` 保持容器运行。`-W` 允许 ttyd 写入（即允许用户输入）。

**替代方案**：
- ttyd 作为 PID 1（ENTRYPOINT ["ttyd"]）：无法先执行 clone/install
- supervisord 管理多进程：过于复杂

**理由**：entrypoint 脚本已有初始化逻辑，ttyd 作为后台进程最简单。ttyd 在 ready 之后启动，确保用户连接时环境已就绪。

### D6: 前端页面 — iframe 嵌入 ttyd

**选择**：terminal.html 保留 loading 状态轮询逻辑，就绪后用 iframe 加载 ttyd 页面（`/mr/:id/terminal/`），不再使用 xterm.js。

**替代方案**：
- 直接跳转到 ttyd URL：失去 loading 状态展示
- 保留 xterm.js 连接 ttyd 的 WebSocket：ttyd 有自己的协议，不兼容原生 xterm.js

**理由**：iframe 最简单，ttyd 自带完整的前端体验。loading → iframe 切换逻辑与现有 loading → xterm 切换逻辑类似。

### D7: 环境变量加载 — dotenv

**选择**：使用 `dotenv` 包在 config.ts 中加载 `.env` 文件。

**理由**：Bun 自动加载 .env，Node.js 不会。dotenv 是标准方案。

## 项目结构（重写后）

```
src/
├── server.ts                # 入口：Express app，路由注册，代理配置
├── config.ts                # dotenv + 环境变量配置（新增 TTYD_PORT_BASE）
├── routes/
│   ├── webhook.ts           # POST /webhook — GitLab webhook 处理（逻辑不变）
│   ├── terminal.ts          # GET /mr/:id — 终端页面（iframe 嵌入 ttyd）
│   └── preview.ts           # ALL /mr/:id/preview/* — 应用预览反向代理
├── proxy/
│   └── ttyd-proxy.ts        # /mr/:id/terminal/* → 容器 ttyd 端口的反向代理
└── services/
    ├── docker-manager.ts    # dockerode 封装（移除 execShell，新增 ttyd 端口映射）
    ├── port-allocator.ts    # slot 池管理（新增 ttyd 端口）
    └── gitlab-api.ts        # GitLab REST API 封装（不变）

docker/
├── Dockerfile               # 新增 ttyd 安装
└── entrypoint.sh            # 新增 ttyd 启动

public/
└── terminal.html            # 改为 iframe 嵌入 ttyd（移除 xterm.js）
```

## 路由设计

```
POST /webhook                    → routes/webhook.ts
GET  /mr/:id                     → routes/terminal.ts（loading / iframe 页面）
GET  /mr/:id/status              → routes/terminal.ts（容器状态 JSON）
ALL  /mr/:id/terminal/*          → proxy/ttyd-proxy.ts（反向代理到 ttyd，含 WS）
ALL  /mr/:id/preview/*           → routes/preview.ts（反向代理到 dev server）
```

## 风险 / 权衡

- **[ttyd 安装]** 容器镜像需要安装 ttyd → ttyd 提供预编译二进制，直接下载即可，约 3MB
- **[双端口占用]** 每个容器占用 2 个宿主机端口 → 20 个 slot × 2 = 40 个端口，可接受
- **[ttyd 路径代理]** ttyd 的静态资源（JS/CSS）路径需要正确代理 → http-proxy-middleware 的 pathRewrite 处理
- **[Colima 资源]** 2 CPU / 2GB 内存下 ttyd 额外开销 → ttyd 本身极轻量（几 MB 内存），影响可忽略
- **[tsx 生产环境]** tsx 适合开发，生产环境可能需要编译 → 当前是内网工具，tsx 直接运行足够
