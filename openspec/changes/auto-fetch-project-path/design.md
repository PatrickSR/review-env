## 上下文

当前创建项目时，用户需要手动填写 `project_path`（如 `group/subgroup/project`），用于容器启动时拼接 git clone URL。但用户已经提供了 `gitlab_project_id`，系统可以通过 GitLab REST API 自动获取该信息。

涉及的现有代码：
- `packages/server/src/routes/api.ts` — POST /api/projects 路由
- `packages/server/src/services/gitlab-api.ts` — GitLab API 封装
- `packages/web/src/pages/ProjectList.tsx` — 创建项目表单
- `packages/web/src/pages/ProjectDetail.tsx` — 项目详情展示

## 目标 / 非目标

**目标：**
- 创建项目时自动通过 GitLab API 获取 `path_with_namespace`，用户无需手动填写
- 创建时验证 PAT 和项目 ID 的有效性（连通性校验）
- 前端移除项目路径输入框

**非目标：**
- 不处理项目在 GitLab 上改名/移动后的自动同步
- 不修改数据库 schema（`project_path` 字段保留，改为系统自动填充）
- 不修改 entrypoint.sh 和容器启动逻辑

## 决策

### 1. 在 POST /api/projects 路由中调用 GitLab API 获取项目信息

**方案 A**：在 entrypoint.sh 中动态获取 path → 每次容器启动多一次 API 调用，bash 脚本复杂化，API 不可用时 clone 失败。

**方案 B（选定）**：在创建项目时一次性获取并存入 DB → 零额外运行时开销，entrypoint.sh 不变。

理由：容器启动是高频操作，项目创建是低频操作。把 API 调用放在低频路径上更合理。

### 2. GitLab API 调用方式

使用 `GET /api/v4/projects/:id`，响应中包含 `path_with_namespace` 字段。

请求需要 `PRIVATE-TOKEN` header，复用用户提供的 `gitlab_pat`。

**影响 package**: `packages/server`

```
// gitlab-api.ts 新增方法
async getProjectInfo(gitlabUrl: string, pat: string, projectId: number)
  → GET ${gitlabUrl}/api/v4/projects/${projectId}
  → 返回 { path_with_namespace: string }
```

### 3. 错误处理

| 情况 | HTTP 状态 | 错误信息 |
|------|-----------|----------|
| PAT 无权限访问项目 | 400 | "无法访问 GitLab 项目，请检查 PAT 权限和项目 ID" |
| GitLab 服务不可达 | 400 | "无法连接 GitLab 服务" |
| 项目 ID 不存在 | 400 | "GitLab 项目不存在" |

### 4. API 请求/响应格式变更

**影响 package**: `packages/server`

POST /api/projects 请求体变更：
```json
// 之前
{ "name", "gitlab_project_id", "project_path", "gitlab_pat", "webhook_secret" }

// 之后（移除 project_path）
{ "name", "gitlab_project_id", "gitlab_pat", "webhook_secret" }
```

响应不变，仍返回完整的 project 对象（包含系统填充的 `project_path`）。

### 5. 前端变更

**影响 package**: `packages/web`

- `ProjectList.tsx`：移除"项目路径"输入框和相关 form state
- `ProjectDetail.tsx`：`project_path` 保留展示但标注为"自动获取"

## 风险 / 权衡

- **[风险] 项目改名/移动后 path 过期** → 暂不处理，后续可加"刷新项目信息"按钮。当前手动填写也有同样问题。
- **[风险] GitLab API 限流** → 创建项目是低频操作，不会触发限流。
- **[权衡] DB 中保留 project_path 字段** → 虽然用户不再填写，但字段保留可避免 schema 迁移，entrypoint.sh 无需改动。
