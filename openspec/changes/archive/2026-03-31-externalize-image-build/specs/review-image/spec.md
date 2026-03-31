## MODIFIED Requirements

### 需求:镜像构建
Review 镜像必须基于 `review-base` 构建，由用户自行编写 Dockerfile 决定安装的工具和运行时。review-base 基于 ubuntu:24.04，包含 git、curl、ttyd 和 entrypoint.sh。

#### 场景:镜像内容由用户决定
- **当** 用户编写 Dockerfile 构建 review 镜像
- **那么** 用户必须使用 `FROM ghcr.io/patricksr/review-base:latest` 作为基础，自行安装所需的语言运行时和 AI 工具

#### 场景:ttyd 可用
- **当** 基于 review-base 的镜像启动容器
- **那么** ttyd 二进制文件必须存在于 PATH 中（由 review-base 提供），可直接执行

### 需求:Entrypoint 脚本
容器启动时，entrypoint 脚本必须自动完成代码准备、执行 before_script、启动 ttyd 并保持容器运行。

#### 场景:正常启动
- **当** 容器启动，环境变量中包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 执行以下步骤：写 status "cloning" → 配置 git credentials → git clone 到 /workspace → 写 status "initializing" → 执行 before_script（如有）→ 写 status "ready" → 启动 ttyd（使用 $SHELL 或 /bin/bash）→ sleep infinity

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 写入 "error: clone failed"，启动 ttyd，保持容器运行

#### 场景:before_script 失败
- **当** before_script 执行返回非零退出码
- **那么** entrypoint 写入 "error: before-script failed"，启动 ttyd，保持容器运行

### 需求:ttyd 服务
容器就绪后必须运行 ttyd 进程，提供 web terminal 服务。

#### 场景:ttyd 监听端口
- **当** 容器初始化完成（无论成功或失败）
- **那么** ttyd 必须在容器内 7681 端口监听

#### 场景:ttyd 使用用户 shell
- **当** ttyd 启动时
- **那么** ttyd 必须使用 `$SHELL` 环境变量指定的 shell 启动交互式终端，如果 `$SHELL` 未设置则使用 `/bin/bash`

#### 场景:ttyd 工作目录
- **当** 用户通过 ttyd 连接终端
- **那么** shell 的工作目录必须为 `/workspace`

#### 场景:ttyd 允许写入
- **当** ttyd 启动时
- **那么** 必须使用 `-W` 参数允许客户端输入

#### 场景:无终端复用器
- **当** ttyd 启动时
- **那么** ttyd 必须直接启动 shell，禁止通过 tmux 或 screen 等终端复用器间接启动
