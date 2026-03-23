## 上下文

当前 `docker-manager.ts` 创建容器时只映射 ttyd 端口（7681 → 随机宿主机端口）。用户在容器内启动的 dev server 无法从外部访问。端口配置之前设计为全局环境变量 `APP_PORTS`，但未实现。现在将端口配置下沉到镜像级别，因为不同镜像（Node 开发、ML 开发等）的端口需求不同。

同时，镜像管理 UI 使用 Drawer 组件，缺少编辑功能，需要重构为 Dialog 并补充编辑能力。

## 目标 / 非目标

**目标：**
- 支持按镜像配置需要映射的容器内端口
- 容器创建时自动将配置的端口加入 Docker 随机映射
- 镜像管理 UI 改为 Dialog，新增编辑功能

**非目标：**
- 不实现运行时动态端口发现
- 不修改 ttyd 7681 的内置映射逻辑
- 不修改全局 APP_PORTS 环境变量（该功能未实现，本次不涉及）

## 决策

### 1. 端口配置放在 project_images 而非 projects

**选择**：在 `project_images` 表新增 `ports TEXT NOT NULL DEFAULT ''` 字段，存储逗号分隔的端口号（如 `"3000,5173,8080"`）。

**替代方案**：在 `projects` 表新增 `app_ports` 字段，项目级统一配置。

**理由**：不同镜像对应不同开发场景（Node 镜像需要 3000/5173，ML 镜像需要 8888/6006），镜像级配置更灵活。

### 2. 端口存储格式使用逗号分隔字符串

**选择**：`ports` 字段存储为逗号分隔字符串（如 `"3000,5173"`），空字符串表示无额外端口。

**替代方案**：JSON 数组（如 `"[3000,5173]"`）。

**理由**：端口列表结构简单，逗号分隔更直观，与前端输入格式一致，解析成本低。

### 3. ttyd 7681 始终内置映射

**选择**：`docker-manager.ts` 中 7681 端口硬编码在 ExposedPorts/PortBindings 中，不受用户配置影响。用户配置的端口是"额外"端口。

**理由**：ttyd 是系统基础设施，不应暴露给用户配置。

### 4. 镜像管理 UI 从 Drawer 改为 Dialog

**选择**：使用 shadcn Dialog 组件（基于 `@base-ui/react/dialog`）替换 Drawer。添加和编辑共用同一个 Modal 组件，通过 mode 区分。

**替代方案**：保持 Drawer，仅新增编辑功能。

**理由**：用户明确要求改为 Modal 形式。Dialog 组件需要通过 `npx shadcn@latest add dialog` 安装。

### 5. 数据库迁移策略

**选择**：在 `schema.ts` 的 `CREATE TABLE IF NOT EXISTS` 中添加 `ports` 列。对于已有数据库，使用 `ALTER TABLE` 添加列（如果不存在）。

**影响 (server)**：
```sql
-- schema.ts 新增
ALTER TABLE project_images ADD COLUMN ports TEXT NOT NULL DEFAULT '';
```

### 6. API 变更

**影响 (server)**：

`POST /api/projects/:id/images` 和 `PUT /api/projects/:id/images/:imageId` 接受新的 `ports` 字段：

```
请求体: { ..., ports: "3000,5173,8080" }
响应体: { ..., ports: "3000,5173,8080" }
```

### 7. 容器创建端口映射逻辑

**影响 (server)**：

`docker-manager.ts` `createContainer()` 变更：
```
读取 imageConfig.ports → 解析为数组
对每个端口: exposedPorts[`${port}/tcp`] = {}
对每个端口: portBindings[`${port}/tcp`] = [{ HostPort: "0" }]
7681 始终包含（内置）
```

## 风险 / 权衡

- **[端口冲突]** 用户可能配置了容器内未监听的端口 → Docker 会正常映射，只是访问时连接不上，无实际危害
- **[已有数据迁移]** 已有的 project_images 记录 ports 为空字符串 → 行为与之前一致（只映射 ttyd），无破坏性
- **[Dialog 组件依赖]** 需要安装 shadcn Dialog 组件 → 通过 CLI 安装，`@base-ui/react` 已在依赖中
