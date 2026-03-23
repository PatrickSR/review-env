## 为什么

当前系统存在两套独立的容器管理机制：正式容器（MR Review 环境）通过 SQLite 持久化，测试容器（镜像测试）仅存于内存 Map。这导致：
1. 容器监控页面只能看到正式容器，测试容器完全不可见
2. 服务重启后测试容器记录丢失，Docker 中的容器变成孤儿
3. 测试容器无法被统一管理和清理

## 变更内容

- **新增** `test_containers` 数据库表，将测试容器从内存 Map 迁移到 SQLite 持久化
- **修改** `/api/containers` 接口，合并返回正式容器和测试容器，通过 `type` 字段区分
- **修改** 测试容器创建逻辑：全局最多 1 个测试容器；同镜像复用已有容器并刷新超时；不同镜像替换旧容器
- **修改** `recoverState()` 和 `cleanupExpired()` 覆盖测试容器
- **修改** ttyd 代理从 DB 查询测试容器信息，移除内存 Map
- **修改** 前端容器监控页面展示两种容器类型
- **新增** 测试容器超时配置 `TEST_CONTAINER_TIMEOUT_MINUTES`（默认 30），基于 `last_accessed_at` 判断
- **移除** 内存中的 `testContainers` Map

## 功能 (Capabilities)

### 新增功能
- `test-container-persistence`: 测试容器的 SQLite 持久化存储，包括创建、查询、删除和超时清理

### 修改功能
- `admin-spa`: 容器监控页面增加测试容器展示，通过类型标识区分正式容器和测试容器
- `review-service`: 测试容器创建逻辑变更为单例复用模式；recoverState 和 cleanupExpired 扩展覆盖测试容器
- `container-networking`: ttyd 代理改为从 DB 查询测试容器的连接信息

## 影响

- **数据库**: 新增 `test_containers` 表
- **API**: `/api/containers` 响应格式变更（新增 `type` 字段）；`/api/docker/test` 行为变更（单例复用）
- **配置**: 新增 `TEST_CONTAINER_TIMEOUT_MINUTES` 环境变量
- **代码**: `packages/server/src/routes/docker.ts`、`packages/server/src/proxy/ttyd-proxy.ts`、`packages/server/src/services/docker-manager.ts`、`packages/server/src/routes/api.ts`、`packages/web/src/pages/Containers.tsx`
