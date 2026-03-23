## 为什么

创建项目时要求用户手动填写 `project_path`（如 `group/subgroup/project`）不现实。用户已经提供了 `gitlab_project_id`，系统完全可以通过 GitLab API 自动获取 `path_with_namespace`，减少一个必填字段，同时顺便验证 PAT 和项目 ID 的有效性。

## 非目标

- 不处理项目在 GitLab 上改名/移动后的自动同步（后续可加"刷新"功能）
- 不移除数据库中的 `project_path` 字段（entrypoint.sh 仍需要它来拼 clone URL）

## 变更内容

- **移除** 前端创建项目表单中的"项目路径"输入框
- **移除** `POST /api/projects` 请求体中 `project_path` 的必填校验
- **新增** 服务端在创建项目时调用 `GET /api/v4/projects/:id` 自动获取 `path_with_namespace`
- **新增** 创建时的连通性验证：PAT 无法访问该项目则报错

## 功能 (Capabilities)

### 新增功能

- `auto-project-path`: 创建项目时通过 GitLab API 自动获取 project_path，移除用户手动输入

### 修改功能

- `multi-repo`: 添加项目的必填字段变更（移除 project_path），新增 API 连通性验证

## 影响

- `packages/server/src/routes/api.ts` — POST /api/projects 路由逻辑
- `packages/server/src/services/gitlab-api.ts` — 新增 getProjectInfo 方法
- `packages/web/src/pages/ProjectList.tsx` — 移除项目路径输入框
- `packages/web/src/pages/ProjectDetail.tsx` — project_path 改为只读展示
- `openspec/specs/multi-repo/spec.md` — 更新添加项目场景的必填字段
