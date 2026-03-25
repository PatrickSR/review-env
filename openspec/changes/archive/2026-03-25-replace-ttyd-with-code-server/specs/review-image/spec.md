## MODIFIED Requirements

### 需求:镜像构建
Review 镜像必须基于 `review-base` 构建，由用户自行编写 Dockerfile 决定安装的工具和运行时。review-base 基于 ubuntu:24.04，包含 git、curl、code-server 和 entrypoint.sh。

#### 场景:镜像内容由用户决定
- **当** 用户编写 Dockerfile 构建 review 镜像
- **那么** 用户必须使用 `FROM ghcr.io/patricksr/review-base:latest` 作为基础，自行安装所需的语言运行时和 AI 工具

#### 场景:code-server 可用
- **当** 基于 review-base 的镜像启动容器
- **那么** code-server 必须已安装并存在于 PATH 中（由 review-base 提供），可直接执行

### 需求:Entrypoint 脚本
容器启动时，entrypoint 脚本必须自动完成代码准备、执行 before_script、启动 code-server 并保持容器运行。

#### 场景:正常启动
- **当** 容器启动，环境变量中包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 执行以下步骤：写 status "cloning" → 配置 git credentials → git clone 到 /workspace → 写 status "initializing" → 执行 before_script（如有）→ 写 status "ready" → 启动 code-server（`code-server --bind-addr 0.0.0.0:8080 --auth none --disable-telemetry /workspace`，后台运行）→ sleep infinity

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 写入 "error: clone failed"，启动 code-server，保持容器运行

#### 场景:before_script 失败
- **当** before_script 执行返回非零退出码
- **那么** entrypoint 写入 "error: before-script failed"，启动 code-server，保持容器运行

### 需求:code-server 服务
容器就绪后必须运行 code-server 进程，提供 web IDE 服务。

#### 场景:code-server 监听端口
- **当** 容器初始化完成（无论成功或失败）
- **那么** code-server 必须在容器内 8080 端口监听

#### 场景:code-server 免认证
- **当** code-server 启动时
- **那么** 必须使用 `--auth none` 参数，禁止要求密码认证

#### 场景:code-server 工作目录
- **当** 用户通过浏览器访问 code-server
- **那么** code-server 必须自动打开 `/workspace` 目录（clone 的代码目录）

#### 场景:code-server 禁用遥测
- **当** code-server 启动时
- **那么** 必须使用 `--disable-telemetry` 参数禁用遥测数据收集

## REMOVED Requirements

### 需求:ttyd 服务
**Reason**: ttyd 被 code-server 完全替代，容器内不再需要 ttyd 进程
**Migration**: 所有 ttyd 相关功能由 code-server 服务需求承接，端口从 7681 改为 8080
