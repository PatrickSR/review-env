## 1. MR 容器端口映射

- [ ] 1.1 修改 `docker-manager.ts` 的 `createContainer` 方法，将 MR 容器的 7681 端口映射到宿主机随机端口（`PortBindings: { "7681/tcp": [{ HostPort: "0" }] }`）
- [ ] 1.2 确认 `inspectPorts` 方法能正确获取 7681 的宿主机映射端口并存入 DB 的 `ports` 字段

## 2. 前端直连 ttyd

- [ ] 2.1 修改 `terminal.html` 的 `showTerminal` 函数，从 status API 的 `ports` 字段获取 7681 对应的宿主机端口，将 iframe src 设为 `http://${location.hostname}:${ttydPort}/`
- [ ] 2.2 修改 `pollStatus` 函数，在 status 为 ready 时将 ports 数据传递给 `showTerminal`

## 3. 删除 MR 代理代码

- [ ] 3.1 从 `ttyd-proxy.ts` 中删除 MR 相关的 `createProxyMiddleware`（mrProxy）和 Express 中间件
- [ ] 3.2 从 `ttyd-proxy.ts` 的 WebSocket upgrade handler 中删除 MR 相关的分支（`/mr/\d+/\d+/terminal` 匹配）
- [ ] 3.3 删除不再使用的 `extractIds` 和 `getTarget` 函数（如测试容器部分不再引用）
- [ ] 3.4 从 `terminal.ts` 中删除 `/mr/:projectId/:mrIid/terminal` 相关的路由（如果有的话，确认 terminal.ts 中无代理路由）

## 4. 验证

- [ ] 4.1 使用 `docker-compose up --build` 启动服务，创建 MR 容器，确认 ttyd 端口映射到宿主机并可通过 iframe 直连访问
