## 为什么

当前容器内使用 ttyd 提供纯终端访问，用户打开 MR 环境后只能看到一个 bash prompt。对于"与 GitLab MR 深度绑定的临时开发环境"这一定位，纯终端无法满足代码阅读、编辑、搜索等核心需求。code-server（浏览器版 VS Code）能提供完整的 IDE 体验，且 Colima 资源已升级到 8C 16GB，资源约束不再是问题。

## 变更内容

- **BREAKING** 从 review-base 基础镜像中移除 ttyd，替换为 code-server
- 改造 `docker/entrypoint.sh`：将 `start_ttyd()` 替换为 `start_ide()`，启动 code-server 监听 8080 端口，`--auth none` 免认证，自动打开 `/workspace` 目录
- 改造前端 Terminal.tsx：从 iframe 嵌入 ttyd 改为"控制面板 + 跳转"模式，容器就绪后显示"打开 IDE"按钮，点击后 `window.open` 在新标签页打开 code-server
- 后端所有 ttyd 端口引用从 7681 改为 code-server 的 8080
- 测试容器的终端访问同步改为 code-server
- Webhook 评论文案从"终端"更新为"开发环境"

### 非目标

- 不预装 code-server 扩展（留给后续 change）
- 不开发自定义 code-server 扩展（如端口面板、停止按钮等）
- 不改变容器生命周期管理逻辑
- 不改变 before_script 机制

## 功能 (Capabilities)

### 新增功能

（无新增功能，所有功能在现有 capability 基础上修改实现方式）

### 修改功能
- `review-image`: 容器内 web 交互层从 ttyd 替换为 code-server，监听端口从 7681 改为 8080，entrypoint 启动命令变更
- `terminal-page`: 从 iframe 嵌入终端改为控制面板 + 新标签页跳转 code-server，页面角色从"终端容器"变为"启动器 + 控制面板"
- `container-networking`: 内置端口从 ttyd 7681 改为 code-server 8080，端口映射和过滤逻辑同步更新
- `image-registry`: 测试容器的终端访问从 ttyd iframe 改为 code-server 新标签页跳转

## 影响

- 镜像变更：`docker/Dockerfile.base` 移除 ttyd 安装、新增 code-server 安装，基础镜像体积从 ~150MB 增至 ~600MB
- 镜像变更：`docker/entrypoint.sh` 启动命令从 ttyd 改为 code-server
- 后端修改：`docker-manager.ts` 端口 7681→8080、`docker.ts` 测试容器端口 7681→8080、`ttyd-proxy.ts` 重命名并更新端口
- 后端修改：`webhook.ts` 评论文案更新
- 前端修改：`Terminal.tsx` 重构为控制面板模式、`Images.tsx` 测试容器跳转逻辑
- 配置变更：`config.ts` 中 Colima 资源相关默认值可能需要更新
