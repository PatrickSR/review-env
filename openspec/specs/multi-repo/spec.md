## 目的

定义动态多项目管理、项目级 Webhook 路由和项目级 GitLab API 调用。

## Requirements

### 需求:多项目动态管理
系统必须支持通过 API 动态添加、修改和删除 GitLab 项目配置。每个项目必须包含独立的 GitLab PAT、Webhook Secret、项目路径和 Git 用户信息。项目配置必须持久化在 SQLite 数据库中。

#### 场景:添加新项目
- **当** 管理员通过 `POST /api/projects` 提交项目配置（name、gitlab_project_id、project_path、gitlab_pat、webhook_secret）
- **那么** 系统必须将项目保存到数据库并返回创建的项目信息

#### 场景:gitlab_project_id 唯一性
- **当** 添加项目时提供的 gitlab_project_id 已存在
- **那么** 系统必须返回 409 冲突错误

#### 场景:获取项目列表
- **当** 请求 `GET /api/projects`
- **那么** 系统必须返回所有已配置项目的列表，包含基本信息（不含 PAT 明文）

#### 场景:更新项目配置
- **当** 管理员通过 `PUT /api/projects/:id` 提交更新
- **那么** 系统必须更新对应项目的配置

#### 场景:删除项目
- **当** 管理员通过 `DELETE /api/projects/:id` 删除项目
- **那么** 系统必须删除项目及其关联的镜像配置，并停止该项目所有运行中的容器

### 需求:项目级 Webhook 路由
每个项目必须拥有独立的 Webhook endpoint `/webhook/:projectId`。系统必须根据 URL 中的 projectId 查找项目配置并验证对应的 webhook_secret。

#### 场景:合法的 Webhook 请求
- **当** GitLab 发送 POST 到 `/webhook/42` 且 X-Gitlab-Token 与项目 42 的 webhook_secret 匹配
- **那么** 系统必须处理该事件

#### 场景:项目不存在
- **当** 收到 POST `/webhook/999` 但数据库中不存在 gitlab_project_id=999 的项目
- **那么** 系统必须返回 404

#### 场景:Secret 不匹配
- **当** 收到 POST `/webhook/42` 但 X-Gitlab-Token 与项目 42 的 webhook_secret 不匹配
- **那么** 系统必须返回 401

### 需求:项目级 GitLab API 调用
系统调用 GitLab API 时必须使用对应项目的配置（gitlab_url、gitlab_pat、gitlab_project_id），禁止使用全局硬编码配置。

#### 场景:发布 MR 评论
- **当** 需要在某个项目的 MR 中发布评论
- **那么** 系统必须使用该项目的 gitlab_pat 和 gitlab_url 构造 API 请求
