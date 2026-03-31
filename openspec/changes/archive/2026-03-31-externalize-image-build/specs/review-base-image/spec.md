## ADDED Requirements

### 需求:review-base 基础镜像
系统必须提供基于 ubuntu:24.04 的基础镜像 `review-base`，仅包含协议基础设施（git、ttyd、curl、bash、entrypoint.sh），不包含任何语言运行时或 AI 工具。

#### 场景:基础镜像内容
- **当** 构建 review-base 镜像
- **那么** 镜像必须基于 ubuntu:24.04，包含 git、curl、bash、ttyd 二进制文件和 entrypoint.sh 脚本，禁止包含 Node.js、Python 或任何 AI 工具

#### 场景:ttyd 可执行
- **当** 基于 review-base 启动容器
- **那么** ttyd 二进制文件必须存在于 PATH 中，可直接执行

#### 场景:用户扩展镜像
- **当** 用户编写 `FROM ghcr.io/patricksr/review-base:latest` 的 Dockerfile
- **那么** 用户必须能通过 RUN 指令安装任意语言运行时和工具

### 需求:entrypoint 协议
entrypoint.sh 必须实现容器启动协议：clone 代码、执行 before_script、启动 ttyd、保持运行。

#### 场景:正常启动流程
- **当** 容器启动，环境变量包含 BRANCH、GITLAB_URL、GITLAB_PAT、PROJECT_PATH、GIT_USER_NAME、GIT_USER_EMAIL
- **那么** entrypoint 必须按顺序执行：写 status "cloning" → 配置 git credentials → git clone 到 /workspace → 写 status "initializing" → 执行 before_script（如有）→ 写 status "ready" → 启动 ttyd → sleep infinity

#### 场景:clone 失败
- **当** git clone 因网络或认证问题失败
- **那么** entrypoint 必须写 status "error: clone failed"，启动 ttyd（允许用户排查），保持容器运行

#### 场景:before_script 执行
- **当** 环境变量 BEFORE_SCRIPT 非空
- **那么** entrypoint 必须将 BEFORE_SCRIPT 进行 base64 解码，在 /workspace 目录下以 bash 执行

#### 场景:before_script 失败
- **当** before_script 执行返回非零退出码
- **那么** entrypoint 必须写 status "error: before-script failed"，启动 ttyd（允许用户排查），保持容器运行

#### 场景:before_script 为空
- **当** 环境变量 BEFORE_SCRIPT 为空或未设置
- **那么** entrypoint 必须跳过 before_script 步骤，直接进入 ready 状态

#### 场景:ttyd 使用用户 shell
- **当** ttyd 启动时
- **那么** ttyd 必须使用 `$SHELL` 环境变量指定的 shell，如果 `$SHELL` 未设置则使用 `/bin/bash`

#### 场景:状态文件写入
- **当** entrypoint 执行各阶段
- **那么** 必须写入状态文件 `/tmp/review-status`，内容为当前阶段字符串

### 需求:review-base 镜像文件
仓库必须包含 review-base 镜像的 Dockerfile 和 entrypoint.sh 文件。

#### 场景:文件位置
- **当** 查看仓库目录结构
- **那么** 必须存在 `docker/Dockerfile.base` 和 `docker/entrypoint.sh` 两个文件
