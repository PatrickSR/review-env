## 1. 数据层 — 端口字段扩展

- [ ] 1.1 修改 `packages/server/src/db/schema.ts`：在 project_images 表定义中新增 `ports TEXT NOT NULL DEFAULT ''` 列，并添加 ALTER TABLE 迁移逻辑（兼容已有数据库）
- [ ] 1.2 修改 `packages/server/src/db/project-images.ts`：ProjectImage 接口新增 ports 字段，CreateImageInput 和 UpdateImageInput 支持 ports
- [ ] 1.3 修改 `packages/server/src/routes/api.ts`：POST 和 PUT 镜像接口支持 ports 字段的读写

## 2. 容器创建 — 端口映射逻辑

- [ ] 2.1 修改 `packages/server/src/services/docker-manager.ts` 的 `createContainer()`：读取 imageConfig.ports，解析为端口数组，将每个端口加入 ExposedPorts 和 PortBindings（HostPort:"0"），7681 始终内置
- [ ] 2.2 添加端口解析容错：忽略空项、空格、非数字项

## 3. 前端 — Dialog 组件安装

- [ ] 3.1 运行 `npx shadcn@latest add dialog` 安装 shadcn Dialog 组件到 `packages/web/src/components/ui/dialog.tsx`

## 4. 前端 — 镜像管理 UI 重构

- [ ] 4.1 在 `ProjectDetail.tsx` 中将 AddImageDrawer 组件替换为基于 Dialog 的 ImageFormModal 组件，支持 mode="create" 和 mode="edit" 两种模式
- [ ] 4.2 ImageFormModal 表单新增"映射端口"字段：单行文本输入框，placeholder 为 `3000, 5173, 8080`，提示逗号分隔
- [ ] 4.3 编辑模式：从镜像列表操作菜单新增"编辑"入口，点击后弹出 ImageFormModal 并预填充当前镜像配置
- [ ] 4.4 移除 Drawer 相关的 import 和组件代码，清理不再使用的依赖
