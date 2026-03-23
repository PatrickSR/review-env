## 1. 数据库层

- [ ] 1.1 在 `schema.ts` 中新增 `test_containers` 表（字段：id, container_id, container_name, image, host_port, created_at, last_accessed_at）
- [ ] 1.2 新建 `db/test-containers.ts` 模块，实现 CRUD 操作：getOne、create、delete、deleteByContainerId、updateLastAccessed、getExpired
- [ ] 1.3 在 `config.ts` 中新增 `testContainerTimeoutMinutes` 配置项（环境变量 `TEST_CONTAINER_TIMEOUT_MINUTES`，默认 30）

## 2. 测试容器管理逻辑重构

- [ ] 2.1 重构 `routes/docker.ts` 中 `POST /api/docker/test`：移除内存 Map 写入，改为查询 DB 实现单例复用逻辑（同镜像复用 + 不同镜像替换 + 无容器新建）
- [ ] 2.2 重构 `routes/docker.ts` 中 `DELETE /api/docker/test/:containerId`：从 DB 删除记录替代内存 Map 删除
- [ ] 2.3 重构 `routes/docker.ts` 中 `GET /api/docker/test`：从 DB 查询替代内存 Map 遍历
- [ ] 2.4 移除 `routes/docker.ts` 中的 `testContainers` Map、`TestContainer` 接口、`setTimeout` 定时器相关代码，移除 `export { testContainers }`

## 3. 状态恢复与清理扩展

- [ ] 3.1 扩展 `docker-manager.ts` 中 `recoverState()` 覆盖 `test_containers` 表：检查 Docker 容器存活性，清理已死亡的记录
- [ ] 3.2 扩展 `docker-manager.ts` 中 `cleanupExpired()` 覆盖测试容器：基于 `last_accessed_at` + `testContainerTimeoutMinutes` 判断超时

## 4. API 层统一

- [ ] 4.1 修改 `routes/api.ts` 中 `GET /api/containers`：合并 `containers` 表和 `test_containers` 表数据，每条记录添加 `type` 字段（`"review"` 或 `"test"`）

## 5. ttyd 代理重构

- [ ] 5.1 修改 `proxy/ttyd-proxy.ts`：将测试容器的 `testContainers.get()` 调用替换为 `testContainersDb` 查询（HTTP 代理 router、WebSocket upgrade、中间件校验）
- [ ] 5.2 移除 `proxy/ttyd-proxy.ts` 中对 `testContainers` 的 import

## 6. 前端容器监控页面

- [ ] 6.1 修改 `Containers.tsx`：Container 接口新增 `type` 字段，表格新增"类型"列（Review / 测试标识），MR 列对测试容器显示"镜像测试"
- [ ] 6.2 修改 `Containers.tsx`：停止按钮根据 `type` 调用不同的删除接口（review → `DELETE /api/containers/:id`，test → `DELETE /api/docker/test/:containerId`）
