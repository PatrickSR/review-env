## MODIFIED Requirements

### 需求:镜像构建
Review 镜像必须基于 node:22 构建，包含 git、curl、Claude Code、ttyd 和 entrypoint 脚本。

#### 场景:镜像内容完整
- **当** 使用 Dockerfile 构建镜像
- **那么** 镜像包含 node 22、git、curl、Claude Code（通过 CVTE npm registry 安装）、ttyd 二进制文件、entrypoint.sh 脚本

#### 场景:ttyd 可用
- **当** 容器启动后
- **那么** ttyd 二进制文件必须存在于 PATH 中，可直接执行

### 需求:Entrypoint 脚本
容器启动时，entrypoint 脚本必须自动完成代码准备、启动 ttyd 并保持容器运行。

#### 场景:正常启动
- **当** 容器启动，环境变量中包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 执行以下步骤：配置 git credentials → `git clone --depth 1 --single-branch -b $BRANCH` 到 /workspace → yarn install → 写入就绪标记 → 启动 ttyd（`ttyd -W -p 7681 /bin/bash`，后台运行）→ 保持容器运行（`sleep infinity`）

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 写入错误标记文件，仍启动 ttyd（reviewer 可通过终端排查），保持容器运行

#### 场景:install 失败
- **当** yarn install 失败
- **那么** entrypoint 写入就绪标记文件（附带 install 失败警告），启动 ttyd，保持容器运行

### 需求:状态标记
容器必须通过文件标记当前初始化状态，供 Review Service 查询。

#### 场景:初始化进度
- **当** entrypoint 执行各阶段
- **那么** 写入状态文件 `/tmp/review-status`，内容为当前阶段（cloning / installing / ready / error）

#### 场景:Review Service 查询状态
- **当** Review Service 需要知道容器初始化进度
- **那么** 通过 `docker exec cat /tmp/review-status` 读取状态文件

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
