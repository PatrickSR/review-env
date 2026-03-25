## 1. review-base 基础镜像改造

- [x] 1.1 修改 `docker/Dockerfile.base`：移除 ttyd 二进制下载安装，替换为 `curl -fsSL https://code-server.dev/install.sh | sh` 安装 code-server
- [x] 1.2 修改 `docker/entrypoint.sh`：将 `start_ttyd()` 函数替换为 `start_ide()` 函数，启动 `code-server --bind-addr 0.0.0.0:8080 --auth none --disable-telemetry /workspace &`

## 2. 后端：端口映射变更

- [x] 2.1 修改 `packages/server/src/services/docker-manager.ts` 的 `createContainer()`：将 exposedPorts 和 portBindings 中的 `"7681/tcp"` 改为 `"8080/tcp"`
- [x] 2.2 修改 `packages/server/src/routes/docker.ts` 的测试容器创建逻辑：将 `"7681/tcp"` 改为 `"8080/tcp"`

## 3. 后端：代理和评论更新

- [x] 3.1 重命名 `packages/server/src/proxy/ttyd-proxy.ts` 为 `ide-proxy.ts`，更新内部代理目标端口从 7681 到 8080，更新变量名和注释中的 ttyd 引用为 code-server
- [x] 3.2 更新 `packages/server/src/server.ts` 中对 ttyd-proxy 的 import 路径（如有引用）
- [x] 3.3 修改 `packages/server/src/routes/webhook.ts`：将评论文案中的"终端"改为"开发环境"

## 4. 前端：Terminal.tsx 重构为控制面板

- [x] 4.1 重构 `packages/web/src/pages/Terminal.tsx`：删除 iframe 嵌入逻辑和右侧可收起面板，就绪后渲染控制面板页面（MR 信息、"打开 IDE"按钮、端口映射列表、停止容器按钮）
- [x] 4.2 实现"打开 IDE"按钮：点击后调用 `window.open(`http://${location.hostname}:${ports["8080"]}/`, '_blank')`，端口映射列表过滤掉 8080

## 5. 前端：测试容器改造

- [x] 5.1 修改 `packages/web/src/pages/Images.tsx`：测试容器从 overlay iframe 改为新标签页跳转，轮询端口从 7681 改为 8080，就绪后 `window.open` 打开 code-server，保留"停止测试容器"按钮
