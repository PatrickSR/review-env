## 目的

更新多项目管理规范，反映创建项目时不再需要用户提供 project_path。

## MODIFIED Requirements

### 需求:多项目动态管理
系统必须支持通过 API 动态添加、修改和删除 GitLab 项目配置。每个项目必须包含独立的 GitLab PAT、Webhook Secret 和 Git 用户信息。项目路径（project_path）由系统自动从 GitLab API 获取，禁止要求用户手动提供。项目配置必须持久化在 SQLite 数据库中。

#### 场景:添加新项目
- **当** 管理员通过 `POST /api/projects` 提交项目配置（name、gitlab_project_id、gitlab_pat、webhook_secret）
- **那么** 系统必须通过 GitLab API 自动获取 project_path，将项目保存到数据库并返回创建的项目信息

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
