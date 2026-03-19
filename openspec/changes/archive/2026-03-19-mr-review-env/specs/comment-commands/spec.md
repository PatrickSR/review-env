## ADDED Requirements

### 需求:评论命令解析
Review Service 必须识别 MR 评论中以 `/review-` 开头的命令，并提取命令名称。

#### 场景:识别 start 命令
- **当** MR 评论内容为 `/review-start`
- **那么** 服务触发该 MR 的容器启动流程（如果容器已存在则回写已有环境链接）

#### 场景:识别 stop 命令
- **当** MR 评论内容为 `/review-stop`
- **那么** 服务触发该 MR 的容器停止流程

#### 场景:识别 status 命令
- **当** MR 评论内容为 `/review-status`
- **那么** 服务在 MR 评论中回写当前环境状态（运行中/初始化中/不存在）及相关链接

#### 场景:忽略无关评论
- **当** MR 评论内容不以 `/review-` 开头
- **那么** 服务忽略该评论，不执行任何操作

### 需求:MR 创建时自动提示
当 MR 创建时，Review Service 必须自动在 MR 评论中发布一条提示，告知 reviewer 可用的环境链接和命令。

#### 场景:新 MR 创建
- **当** 收到 merge_request webhook 且 action 为 open
- **那么** 服务在 MR 评论中发布提示信息，包含终端 URL（/mr/:id）、预览 URL（/mr/:id/preview）、可用命令列表

#### 场景:非 open 事件
- **当** 收到 merge_request webhook 且 action 不是 open（如 update、merge、close）
- **那么** 服务不发布提示信息（merge/close 触发清理逻辑，update 忽略）
