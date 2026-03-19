## 为什么

当前 Review Service 基于 Bun 运行，web 终端通过 `Bun.spawn("docker exec")` 桥接。实践中发现 Bun 的 spawn pipe 是 socket fd 而非 PTY，导致 `docker exec -it` 无法获得交互式终端（无 echo、无 prompt、`script` wrapper 也因 `tcgetattr` 失败而不可用）。dockerode 的 `exec.start({ hijack: true })` 在 Bun 下 promise 永远不 resolve。终端功能完全不可用。

需要两个变更：
1. 将 runtime 从 Bun 切换到 Node.js — 解决 dockerode hijack 和 spawn PTY 兼容性问题
2. 将自实现终端替换为 ttyd — 使用成熟的 web terminal 方案，Review Service 只做反向代理

## 变更内容

- **修改**：Review Service runtime 从 Bun 切换到 Node.js + TypeScript（ts-node 或 tsx 运行）。HTTP 框架从 `Bun.serve()` 改为 Express + express-ws 或 http-proxy。**BREAKING**：启动命令从 `bun run src/server.ts` 改为 `npx tsx src/server.ts`
- **修改**：Web Terminal 方案从自实现（xterm.js + docker exec stream）改为 ttyd 反向代理。Review Service 不再处理终端 WebSocket，只将 `/mr/:id/terminal/` 反向代理到容器内 ttyd 端口。前端 terminal.html 改为 iframe 嵌入 ttyd 页面
- **修改**：容器镜像增加 ttyd 安装，entrypoint 启动 ttyd 进程监听固定端口
- **修改**：端口映射从单端口（preview）改为双端口（ttyd + preview），slot 池需要管理两组端口
- **移除**：server.ts 中的 WebSocket handler、docker exec stream 桥接逻辑、xterm.js 前端代码

## 功能 (Capabilities)

### 新增功能

（无新增功能，所有功能在原有 capability 基础上修改实现方式）

### 修改功能

- `review-service`: Web Terminal 需求变更 — 从 docker exec stream 桥接改为 ttyd HTTP/WS 反向代理；runtime 从 Bun 改为 Node.js；路由框架从 Bun.serve() 改为 Express/http-proxy-middleware
- `review-image`: 镜像需求变更 — 需要安装 ttyd；entrypoint 需要启动 ttyd 进程；容器需要暴露 ttyd 端口
- `comment-commands`: 评论命令中的终端 URL 格式变更 — 从 `/mr/:id` 改为 `/mr/:id/terminal/`

## 影响

- **Runtime**：从 Bun 切换到 Node.js，需要 `tsx` 或 `ts-node` 运行 TypeScript
- **依赖**：移除 `@types/bun`；新增 `express`、`http-proxy-middleware`、`express-ws` 或类似库、`dotenv`、`tsx`
- **Docker 镜像**：review 容器镜像增加 ttyd 二进制（约 3MB），entrypoint 多启动一个 ttyd 进程
- **端口映射**：每个容器从 1 个端口映射变为 2 个（ttyd + preview），slot 池逻辑需调整
- **前端**：terminal.html 从 xterm.js 直连 WebSocket 改为 iframe 嵌入 ttyd 页面
- **启动命令**：`bun run src/server.ts` → `npx tsx src/server.ts`
- **环境变量加载**：从 Bun 自动加载 .env 改为使用 `dotenv` 包
