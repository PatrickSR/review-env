## 上下文

当前 review-base 基础镜像内置 ttyd 作为 web 交互层，用户通过浏览器访问 ttyd 获得纯终端体验。前端 Terminal.tsx 通过 iframe 嵌入 ttyd 页面。系统定位已从"MR 审查终端"升级为"与 GitLab MR 深度绑定的临时开发环境"，纯终端无法满足代码阅读、编辑、搜索等核心需求。Colima 资源已升级到 8C 16GB，不再受资源约束。

当前代码中 ttyd 的触点：
- `docker/Dockerfile.base` — 安装 ttyd 二进制
- `docker/entrypoint.sh` — `start_ttyd()` 函数，启动 `ttyd -W -p 7681`
- `packages/server/src/services/docker-manager.ts` — 硬编码 `"7681/tcp"` 端口映射
- `packages/server/src/routes/docker.ts` — 测试容器硬编码 `"7681/tcp"`
- `packages/server/src/proxy/ttyd-proxy.ts` — 测试容器的 ttyd 反向代理
- `packages/web/src/pages/Terminal.tsx` — iframe 嵌入 ttyd，端口过滤 `"7681"`
- `packages/web/src/pages/Images.tsx` — 测试容器 iframe 嵌入 ttyd
- `packages/server/src/routes/webhook.ts` — 评论文案"终端"

## 目标 / 非目标

**目标：**
- 用 code-server 完全替换 ttyd，容器内提供完整的 VS Code IDE 体验
- 前端从 iframe 嵌入改为直接跳转（方案 B），Terminal.tsx 变为"启动器 + 控制面板"
- 保持 before_script、容器生命周期、状态轮询等现有机制不变
- 测试容器同步改为 code-server

**非目标：**
- 不预装 code-server 扩展
- 不开发自定义 code-server 扩展
- 不改变容器生命周期管理逻辑
- 不改变 before_script 机制
- 不做 code-server 的反向代理（直连模式）

## 决策

### 1. code-server 安装方式：官方安装脚本

**影响 package**: docker/Dockerfile.base

在 Dockerfile.base 中使用 `curl -fsSL https://code-server.dev/install.sh | sh` 安装 code-server，替换 ttyd 的手动二进制下载。

**替代方案**：手动下载 .deb 包。放弃原因：安装脚本自动处理架构检测和依赖，更简洁。

### 2. code-server 启动参数

**影响 package**: docker/entrypoint.sh

```bash
start_ide() {
  code-server \
    --bind-addr 0.0.0.0:8080 \
    --auth none \
    --disable-telemetry \
    /workspace &
}
```

- `--bind-addr 0.0.0.0:8080`：监听所有接口的 8080 端口
- `--auth none`：内网环境，免认证
- `--disable-telemetry`：禁用遥测
- `/workspace`：自动打开 clone 的代码目录
- 后台运行（`&`），与 ttyd 相同的模式，`sleep infinity` 保持容器

**影响 package**: server（`docker-manager.ts` 端口映射 7681→8080）

### 3. 端口变更：7681 → 8080

**影响 package**: server, web

所有硬编码的 `"7681/tcp"` 改为 `"8080/tcp"`：
- `docker-manager.ts` 的 `createContainer`：exposedPorts 和 portBindings
- `docker.ts` 的测试容器创建逻辑
- `Terminal.tsx` 的端口判断和 URL 构建
- `Images.tsx` 的测试容器端口轮询

### 4. 前端：直接跳转模式（方案 B）

**影响 package**: web

Terminal.tsx 重构为控制面板页面，不再使用 iframe：

状态流程不变：验证 MR → 选择镜像 → 等待就绪

就绪后的行为变更：
- 不再渲染 iframe
- 显示控制面板：MR 信息、"打开 IDE"按钮、端口映射列表、停止容器按钮
- "打开 IDE"按钮调用 `window.open(ideUrl, '_blank')` 在新标签页打开 code-server
- IDE URL 格式：`http://${location.hostname}:${ports["8080"]}/`
- 端口映射列表过滤掉 8080（code-server 自身端口），显示用户配置的应用端口

右侧可收起面板删除，信息直接展示在控制面板主体中。

### 5. 测试容器：新标签页跳转

**影响 package**: web

Images.tsx 的测试容器交互从 overlay iframe 改为新标签页跳转：
- 点击"测试运行" → 创建容器 → 轮询就绪 → 自动 `window.open` 打开 code-server
- 保留"停止并关闭"按钮在 Images 页面上

### 6. ttyd-proxy.ts 处理

**影响 package**: server

`ttyd-proxy.ts` 当前处理测试容器的 `/api/docker/test/:containerId/terminal` 代理。改为 code-server 后：
- 重命名为 `ide-proxy.ts`
- 代理目标端口从 7681 改为 8080
- WebSocket 代理逻辑保持不变（code-server 同样使用 WebSocket）

注意：正式容器（MR 容器）已经是直连模式（前端直接访问宿主机映射端口），不经过代理。测试容器仍通过代理访问。

### 7. Webhook 评论文案

**影响 package**: server

`webhook.ts` 中 MR open 时发布的评论：
```
当前: "🚀 **Review Environment 可用**\n\n- 终端：${baseUrl}/mr/..."
改为: "🚀 **Review Environment 可用**\n\n- 开发环境：${baseUrl}/mr/..."
```

## 风险 / 权衡

- [镜像体积] review-base 从 ~150MB 增至 ~600MB → 拉取一次后缓存，可接受
- [启动时间] code-server 首次启动 5-15 秒，比 ttyd 的 <1 秒慢 → 用户已在等 git clone + before_script，多几秒可接受；且 code-server 自带 loading 页面
- [内存占用] 单容器从 ~5MB 增至 ~300-500MB → 16GB 下可跑 10-15 个并发容器，满足需求
- [iframe cookie] 不再使用 iframe，直接跳转，完全规避 cookie/CORS 问题
- [扩展市场] code-server 使用 Open VSX 而非微软市场，部分扩展不可用 → 对 MR 审查场景影响不大，后续 change 处理
- [测试容器代理] code-server 的 WebSocket 协议与 ttyd 不同 → http-proxy-middleware 对两者都支持，改端口即可
