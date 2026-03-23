## 上下文

当前系统有两套容器管理机制：

1. **正式容器**（MR Review 环境）：通过 `containersDb` 持久化到 SQLite `containers` 表，由 `docker-manager.ts` 管理生命周期，`recoverState()` 在重启后恢复，`cleanupExpired()` 定期清理超时容器。
2. **测试容器**（镜像测试）：通过 `routes/docker.ts` 中的内存 `Map<string, TestContainer>` 管理，30 分钟 `setTimeout` 超时清理。服务重启后记录丢失，Docker 中的容器变成孤儿。

前端容器监控页面 (`/containers`) 只查询 `/api/containers`，该接口只读取 SQLite `containers` 表，因此测试容器不可见。

ttyd 代理 (`ttyd-proxy.ts`) 对两种容器使用不同的查找方式：正式容器查 DB，测试容器查内存 Map。

## 目标 / 非目标

**目标：**
- 将测试容器从内存 Map 迁移到 SQLite 持久化，解决重启丢失和孤儿容器问题
- 统一容器监控视图，在同一页面展示正式容器和测试容器
- 保证全局最多 1 个测试容器，同镜像复用已有容器
- 测试容器超时基于最后访问时间，活跃使用不被清理

**非目标：**
- 不合并 `containers` 和 `test_containers` 为同一张表（两者字段差异大，正式容器的外键约束不应放松）
- 不展示系统中所有 Docker 容器（只展示 review-service 管理的容器）
- 不改变正式容器的管理逻辑

## 决策

### D1: 新建独立的 `test_containers` 表

**选择**：新建 `test_containers` 表，而非在现有 `containers` 表中添加 `type` 字段。

**理由**：`containers` 表有 `project_id`（FK → projects）、`mr_iid`、`branch`、`image_id`（FK → project_images）等字段和 `UNIQUE(project_id, mr_iid)` 约束。测试容器没有项目、MR、分支等概念，强行塞入需要放松 NOT NULL 和外键约束，削弱正式容器的数据完整性。

**替代方案**：在 `containers` 表加 `type` 字段 + nullable 字段。被否决，因为会破坏现有约束。

### D2: API 层合并返回，带 `type` 字段

**选择**：`/api/containers` 接口同时查询两张表，合并后返回统一列表，每条记录带 `type: "review" | "test"` 字段。

**理由**：前端只需一个接口即可获取所有容器，减少请求次数和前端复杂度。

### D3: 测试容器单例 + 同镜像复用

**选择**：`POST /api/docker/test` 的行为变更为：
1. 查询 DB 中是否已有测试容器
2. 如果有且镜像相同，检查 Docker 中容器是否存活 → 存活则直接返回连接信息并刷新 `last_accessed_at` → 不存活则清理记录并创建新容器
3. 如果有但镜像不同，销毁旧容器后创建新容器
4. 如果没有，直接创建新容器

**理由**：避免资源浪费，同镜像无需重建；不同镜像必须替换因为全局只允许 1 个。

### D4: 超时基于 `last_accessed_at`

**选择**：`test_containers` 表包含 `last_accessed_at` 字段，每次复用连接时更新。`cleanupExpired()` 基于此字段判断超时。

**替代方案**：基于 `created_at` 固定超时。被否决，因为活跃使用的容器不应被清理。

### D5: 移除内存 Map，ttyd 代理改查 DB

**选择**：完全移除 `testContainers` Map，`ttyd-proxy.ts` 改为从 `test_containers` 表查询 `host_port`。

**理由**：SQLite 读性能对此场景完全足够，正式容器的代理已经在每次请求时查 DB，保持一致。消除内存与 DB 的双重状态源。

### D6: 测试容器超时独立配置

**选择**：新增 `TEST_CONTAINER_TIMEOUT_MINUTES` 环境变量（默认 30），与正式容器的 `CONTAINER_TIMEOUT_HOURS` 分开配置。

**理由**：测试容器是临时性的，超时应远短于正式容器。

## 风险 / 权衡

- **[风险] 服务重启时测试容器的 Docker 存活检查可能失败** → `recoverState()` 已有容错逻辑（inspect 失败则删除记录），同样适用于 `test_containers` 表
- **[风险] `/api/containers` 响应格式变更可能影响前端** → 新增 `type` 字段是向后兼容的，现有字段不变；前端需要适配新字段的展示
- **[权衡] 每次 WebSocket 连接查 DB vs 内存查找** → SQLite 单次读取 < 1ms，对终端连接频率完全可接受，换来的是状态一致性
