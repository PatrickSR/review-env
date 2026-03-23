## 目的

定义动态端口配置、固定端口范围移除和 Webhook 评论格式更新。

## Requirements

### 需求:APP_PORTS 配置
系统必须支持通过镜像级别的 `ports` 字段配置容器内端口，替代全局环境变量 `APP_PORTS`。创建容器时，系统必须从 `project_images` 表读取对应镜像的 ports 配置，将每个端口使用 `HostPort: "0"` 让 Docker 随机分配宿主机端口。

#### 场景:从镜像配置读取端口
- **当** 创建容器时指定的 imageId 对应的镜像 ports 为 `"3000,5173"`
- **那么** 系统必须将容器内 3000、5173 端口各自映射到 Docker 随机分配的宿主机端口

#### 场景:镜像无端口配置
- **当** 创建容器时指定的 imageId 对应的镜像 ports 为空字符串
- **那么** 系统必须只映射内置的 ttyd 7681 端口

### 需求:移除固定端口范围配置
系统必须移除 `PREVIEW_PORT_BASE` 和 `TTYD_PORT_BASE` 配置项。port-allocator 中与 preview 和 ttyd 固定端口相关的逻辑必须移除。

#### 场景:旧配置项不再生效
- **当** .env 中设置了 PREVIEW_PORT_BASE 或 TTYD_PORT_BASE
- **那么** 系统必须忽略这些配置，不产生错误

### 需求:Webhook 评论格式更新
GitLab webhook 评论中的 URL 必须反映新的端口策略。终端 URL 保持 `/mr/<id>` 格式。app 端口信息必须通过状态 API 获取，评论中必须引导用户查看状态页面获取端口信息。

#### 场景:MR 打开时的评论
- **当** 新 MR 打开触发 webhook
- **那么** 评论必须包含终端 URL（`/mr/<id>`），禁止包含 `/mr/<id>/preview` 格式的链接

#### 场景:review-start 命令的评论
- **当** 用户执行 `/review-start` 命令
- **那么** 评论必须包含终端 URL 和端口映射信息（各 app 端口对应的宿主机随机端口）
