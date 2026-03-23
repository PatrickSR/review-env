## 为什么

当前 MR 容器的 ttyd 终端通过 `http-proxy-middleware` 反向代理访问，涉及 HTTP 代理、WebSocket 升级处理、路径重写等复杂逻辑。这套代理在 Express 挂载路径下存在 `req.url` 被截断的问题，导致 `router` 回调无法正确解析目标地址，实际调试中反复出现 502/403 错误。

测试容器已经在使用端口映射 + 直连的方式，运行稳定。在单机部署场景下，MR 容器完全可以采用相同策略，删除整套代理逻辑，大幅降低复杂度。

## 变更内容

- MR 容器创建时将 ttyd 端口（7681）映射到宿主机随机端口（与测试容器一致）
- 终端页面 iframe 直连宿主机 ttyd 端口，不再经过反向代理
- 删除 `ttyd-proxy.ts` 中 MR 容器相关的 HTTP 代理和 WebSocket 代理逻辑
- status API 返回 ttyd 的宿主机端口，前端据此构建 iframe URL
- 保留测试容器的代理逻辑不变（如仍需要）

## 功能 (Capabilities)

### 新增功能

（无新增功能）

### 修改功能

- `container-networking`: ttyd 端口策略变更 — 正式容器的 7681 端口从"禁止映射到宿主机"改为"映射到宿主机随机端口"，删除 Docker network 内部代理需求
- `review-service`: 终端页面访问方式变更 — iframe 从代理路径改为直连宿主机端口，删除 `/mr/:projectId/:mrIid/terminal` 代理路由

## 影响

- `packages/server/src/proxy/ttyd-proxy.ts` — 删除 MR 代理相关代码（约 60 行）
- `packages/server/src/services/docker-manager.ts` — MR 容器添加 7681 端口映射
- `packages/server/public/terminal.html` — iframe src 改为直连 ttyd 端口
- `packages/server/src/routes/terminal.ts` — status API 需返回 ttyd 宿主机端口
- `docker-compose.yml` — 无变更（服务仍需在 review-net 中管理容器生命周期）
