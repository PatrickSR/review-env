## MODIFIED Requirements

### 需求:Entrypoint 脚本
容器启动时，entrypoint 脚本必须自动完成代码准备、启动 ttyd 并保持容器运行。

#### 场景:正常启动
- **当** 容器启动，环境变量中包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 执行以下步骤：配置 git credentials → `git clone --single-branch -b $BRANCH` 到 /workspace → 写入就绪标记 → 启动 ttyd（`ttyd -W -p 7681 -w /workspace /bin/bash`，后台运行）→ 保持容器运行（`sleep infinity`）

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 写入错误标记文件，启动 ttyd（`ttyd -W -p 7681 -w /workspace /bin/bash`，后台运行），保持容器运行

### 需求:镜像构建
Review 镜像必须基于 node:22 构建，包含 git、curl、Claude Code、ttyd 和 entrypoint 脚本。

#### 场景:镜像内容完整
- **当** 使用 Dockerfile 构建镜像
- **那么** 镜像包含 node 22、git、curl、Claude Code、ttyd 二进制文件、entrypoint.sh 脚本。镜像禁止包含 tmux。

### 需求:ttyd 服务
容器就绪后必须运行 ttyd 进程，提供 web terminal 服务。

#### 场景:ttyd 监听端口
- **当** 容器初始化完成（无论成功或失败）
- **那么** ttyd 必须在容器内 7681 端口监听，提供 `/bin/bash` 交互式终端

#### 场景:ttyd 工作目录
- **当** 用户通过 ttyd 连接终端
- **那么** bash 的工作目录必须为 `/workspace`（clone 的代码目录）

#### 场景:ttyd 允许写入
- **当** ttyd 启动时
- **那么** 必须使用 `-W` 参数允许客户端输入（writable 模式）

#### 场景:无终端复用器
- **当** ttyd 启动时
- **那么** ttyd 必须直接启动 `/bin/bash`，禁止通过 tmux 或 screen 等终端复用器间接启动
