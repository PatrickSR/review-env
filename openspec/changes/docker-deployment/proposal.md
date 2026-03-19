## 为什么

当前 review-service 直接通过 `npm start` 运行在宿主机上，部署不可复现。同时端口策略存在多个问题：preview 端口使用固定范围分配（9000-9019），只支持单个 app 端口，且通过路径前缀代理（`/mr/<id>/preview`）导致前端框架的资源路径容易出问题。需要将服务容器化，并重构网络和端口策略以同时支持 macOS (Colima) 和 Linux 生产环境。

## 变更内容

- **新增** review-service 的 Dockerfile 和 docker-compose.yml，实现容器化部署
- **新增** Docker network（review-net），所有容器加入同一网络，实现跨平台一致的容器间通信
- **修改** 端口策略：从单个固定 app 端口改为支持一组可配置端口（如 3000,5173,8080），每个端口由 Docker 随机分配宿主机端口，用户直接通过随机端口访问
- **修改** ttyd 代理：从 `127.0.0.1:固定端口` 改为通过 Docker network 内部通信（`review-env-mr-<id>:7681`），ttyd 不再映射到宿主机
- **移除** preview 路由代理（`/mr/<id>/preview`），改为直接通过随机端口访问
- **移除** 固定端口范围分配机制（previewPortBase、ttydPortBase），port-allocator 大幅简化或删除

## 功能 (Capabilities)

### 新增功能
- `service-containerization`: 将 review-service 打包为 Docker 镜像，通过 docker-compose 编排，挂载 Docker socket 实现 sibling container 管理
- `container-networking`: 使用 Docker bridge network 实现容器间通信，支持 macOS (Colima) 和 Linux 双平台
- `dynamic-ports`: 支持一组可配置的容器端口，由 Docker 随机分配宿主机端口，通过 API 返回端口映射信息

### 修改功能

## 影响

- `src/services/docker-manager.ts`：重构容器创建逻辑（网络、端口映射、inspect 获取随机端口）
- `src/services/port-allocator.ts`：大幅简化或删除
- `src/proxy/ttyd-proxy.ts`：代理目标改为 Docker network 内部地址
- `src/routes/preview.ts`：删除
- `src/routes/webhook.ts`：评论中的 URL 格式变更
- `src/config.ts`：appPort 改为 appPorts 数组，去掉 previewPortBase/ttydPortBase
- `docker-compose.yml`：新增
- `Dockerfile`（根目录）：新增
