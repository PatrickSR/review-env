## 为什么

当前容器创建时只映射了 ttyd 终端端口（7681），用户在容器内启动的 dev server（如 vite:5173、tensorboard:6006）无法从外部访问。随着 Claude Code 等 AI 工具在 MR 环境中的使用，用户经常需要在容器内启动各种服务并从浏览器访问，这是一个高频需求。

## 变更内容

- **新增** `project_images` 表的 `ports` 字段，允许按镜像配置需要映射的容器内端口
- **修改** 容器创建逻辑，除内置的 ttyd 7681 外，将镜像配置的端口也加入 Docker 随机端口映射
- **修改** 镜像管理 UI，从 Drawer 改为 Dialog (Modal) 形式
- **新增** 镜像编辑功能（当前只有添加和删除，缺少编辑）
- **新增** 镜像表单中的"映射端口"输入字段（逗号分隔格式）

### 非目标

- 不实现容器运行时动态端口发现（只支持预配置端口）
- 不修改 ttyd 端口的处理方式（保持内置，不暴露给用户）
- 不修改全局 `APP_PORTS` 环境变量逻辑（端口配置下沉到镜像级别）

## 功能 (Capabilities)

### 新增功能
- `image-port-config`: 镜像级别的端口映射配置，包括数据模型扩展、容器创建时的端口映射、以及前端表单支持

### 修改功能
- `multi-image`: 镜像管理 UI 重构（Drawer → Dialog）并新增编辑功能
- `dynamic-ports`: 端口配置从全局环境变量改为镜像级别配置，容器创建时读取镜像的 ports 字段

## 影响

- `packages/server/src/db/schema.ts` — project_images 表新增 ports 列
- `packages/server/src/db/project-images.ts` — 接口和 CRUD 支持 ports 字段
- `packages/server/src/routes/api.ts` — POST/PUT 镜像接口支持 ports
- `packages/server/src/services/docker-manager.ts` — createContainer 端口映射逻辑
- `packages/web/src/pages/ProjectDetail.tsx` — 镜像管理 UI 重构
- `packages/web/src/components/ui/dialog.tsx` — 新增 shadcn Dialog 组件
