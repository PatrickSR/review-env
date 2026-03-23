## MODIFIED Requirements

### 需求:容器停止与清理
Review Service 必须支持三种方式停止并移除容器：Web 页面手动停止、超时自动清理、MR 状态变更触发。测试容器必须纳入超时自动清理范围。

#### 场景:Web 页面手动停止
- **当** 用户在终端页面或管理界面点击停止按钮
- **那么** 服务停止并移除对应容器，更新数据库记录

#### 场景:超时自动清理
- **当** 容器运行时间超过配置的超时时间（正式容器默认 4 小时，测试容器默认 30 分钟）
- **那么** 服务自动停止并移除容器，删除数据库记录
- **并且** 测试容器的超时必须基于 `last_accessed_at` 字段判断，正式容器基于 `created_at` 字段判断

#### 场景:MR 合并或关闭时清理
- **当** 收到 merge_request webhook 且 action 为 merge 或 close
- **那么** 服务停止并移除该项目该 MR 对应的容器（如果存在），删除数据库记录

### 需求:状态恢复
Review Service 重启后必须从 SQLite 数据库恢复容器管理状态，并与 Docker 实际状态校验。恢复范围必须包括正式容器和测试容器。

#### 场景:服务重启
- **当** Review Service 进程重启
- **那么** 服务必须从 `containers` 表和 `test_containers` 表读取记录，对每个记录检查 Docker 容器是否实际存在，删除已不存在的记录，更新端口映射信息

### 需求:容器列表 API
`GET /api/containers` 必须返回所有由 review-service 管理的容器，包括正式容器和测试容器。

#### 场景:统一容器列表
- **当** 前端请求 `GET /api/containers`
- **那么** 接口必须合并 `containers` 表和 `test_containers` 表的数据，每条记录必须包含 `type` 字段（值为 `"review"` 或 `"test"`）
- **并且** 测试容器的 `project_name` 为 null，`mr_iid` 为 null，`image_display_name` 取自 `test_containers.image` 字段
