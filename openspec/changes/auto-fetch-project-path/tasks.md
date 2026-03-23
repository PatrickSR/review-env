## 1. 后端：GitLab API 扩展

- [ ] 1.1 在 `gitlab-api.ts` 中新增 `getProjectInfo` 方法，调用 `GET /api/v4/projects/:id` 返回 `path_with_namespace`
- [ ] 1.2 处理错误情况：PAT 无权限（401/403）、项目不存在（404）、服务不可达（网络错误）

## 2. 后端：API 路由改造

- [ ] 2.1 修改 `api.ts` 中 `POST /api/projects` 路由：移除 `project_path` 必填校验，调用 `getProjectInfo` 自动获取并填充
- [ ] 2.2 添加错误处理：GitLab API 调用失败时返回 400 及对应中文错误信息

## 3. 前端：表单精简

- [ ] 3.1 修改 `ProjectList.tsx`：移除创建项目对话框中的"项目路径"输入框及相关 form state
- [ ] 3.2 修改 `ProjectDetail.tsx`：project_path 字段标注为"自动获取"，保持只读展示
