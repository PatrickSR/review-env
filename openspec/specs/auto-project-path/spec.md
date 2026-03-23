## 目的

定义创建项目时自动通过 GitLab API 获取 project_path 的行为。

## Requirements

### 需求:自动获取项目路径
系统在创建项目时，必须使用用户提供的 `gitlab_pat` 和 `gitlab_project_id` 调用 GitLab API (`GET /api/v4/projects/:id`) 自动获取 `path_with_namespace`，并将其作为 `project_path` 存入数据库。用户禁止被要求手动填写项目路径。

#### 场景:成功获取项目路径
- **当** 管理员通过 `POST /api/projects` 提交项目配置（name、gitlab_project_id、gitlab_pat、webhook_secret），且 PAT 有权访问该项目
- **那么** 系统必须调用 GitLab API 获取 `path_with_namespace`，将其存为 `project_path`，并返回包含完整信息的项目对象

#### 场景:PAT 无权限访问项目
- **当** 管理员提交的 `gitlab_pat` 无权访问指定的 `gitlab_project_id`
- **那么** 系统必须返回 400 错误，提示"无法访问 GitLab 项目，请检查 PAT 权限和项目 ID"

#### 场景:GitLab 服务不可达
- **当** 系统无法连接到 GitLab 服务
- **那么** 系统必须返回 400 错误，提示"无法连接 GitLab 服务"

#### 场景:项目 ID 不存在
- **当** 管理员提交的 `gitlab_project_id` 在 GitLab 中不存在
- **那么** 系统必须返回 400 错误，提示"GitLab 项目不存在"
