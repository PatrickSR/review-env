## ADDED Requirements

### 需求:MR 列表 API
系统必须提供 `GET /api/projects/:id/mrs` 端点，返回指定项目的 open 状态 MR 列表。

#### 场景:获取 open MR 列表
- **当** 前端请求 `GET /api/projects/:id/mrs`
- **那么** 后端必须使用该项目的 GitLab PAT 调用 `GET /api/v4/projects/:gitlab_project_id/merge_requests?state=opened`
- **并且** 查询 containers 表，为每个 MR 标记 `has_container` 字段
- **并且** 返回 JSON 数组，每项包含：`iid`、`title`、`source_branch`、`author`（用户名）、`web_url`、`has_container`

#### 场景:项目不存在
- **当** 请求的项目 ID 在数据库中不存在
- **那么** 必须返回 HTTP 404，body 为 `{ "error": "未找到项目" }`

#### 场景:GitLab API 调用失败
- **当** GitLab API 返回错误（网络问题、PAT 失效等）
- **那么** 必须返回 HTTP 502，body 为 `{ "error": "无法获取 MR 列表，请检查 GitLab 配置" }`

### 需求:MR 状态验证 API
系统必须提供 `GET /api/projects/:id/mrs/:mrIid/validate` 端点，验证 MR 是否存在且为 open 状态。

#### 场景:MR 有效
- **当** 请求验证的 MR 在 GitLab 上存在且状态为 opened
- **那么** 必须返回 `{ "valid": true, "title": "...", "source_branch": "...", "author": "..." }`

#### 场景:MR 已关闭或已合并
- **当** 请求验证的 MR 在 GitLab 上存在但状态为 merged 或 closed
- **那么** 必须返回 `{ "valid": false, "reason": "该 MR 已关闭或已合并" }`

#### 场景:MR 不存在
- **当** 请求验证的 MR 在 GitLab 上不存在（404）
- **那么** 必须返回 `{ "valid": false, "reason": "MR 不存在" }`

### 需求:GitLab API 服务扩展
`gitlab-api.ts` 必须新增 `listOpenMrs` 方法，供 MR 列表 API 调用。

#### 场景:调用 listOpenMrs
- **当** 后端需要获取项目的 open MR 列表
- **那么** 必须调用 GitLab REST API `GET /api/v4/projects/:id/merge_requests?state=opened&per_page=100`
- **并且** 返回包含 `iid`、`title`、`source_branch`、`author.username`、`web_url` 的数组
