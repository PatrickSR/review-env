## ADDED Requirements

### 需求:镜像构建
Review 镜像必须基于 gzj-livod-ci:node22 构建，包含 entrypoint 脚本。不需要安装 ttyd（终端通过 docker exec 实现）。

#### 场景:镜像内容完整
- **当** 使用 Dockerfile 构建镜像
- **那么** 镜像包含 node 22、git、curl、Claude Code（继承自基础镜像）、entrypoint.sh 脚本

### 需求:Entrypoint 脚本
容器启动时，entrypoint 脚本必须自动完成代码准备并保持容器运行。

#### 场景:正常启动
- **当** 容器启动，环境变量中包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 执行以下步骤：配置 git credentials → `git clone --depth 1 --single-branch -b $BRANCH` 到 /workspace → yarn install → 写入就绪标记文件 → 保持容器运行（`sleep infinity`）

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 写入错误标记文件（包含错误信息），但仍保持容器运行（reviewer 可通过终端排查）

#### 场景:install 失败
- **当** yarn install 失败
- **那么** entrypoint 写入就绪标记文件（附带 install 失败警告），保持容器运行（reviewer 可手动排查和重试）

### 需求:状态标记
容器必须通过文件标记当前初始化状态，供 Review Service 查询。

#### 场景:初始化进度
- **当** entrypoint 执行各阶段
- **那么** 写入状态文件 `/tmp/review-status`，内容为当前阶段（cloning / installing / ready / error）

#### 场景:Review Service 查询状态
- **当** Review Service 需要知道容器初始化进度
- **那么** 通过 `docker exec cat /tmp/review-status` 读取状态文件
