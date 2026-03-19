## 1. 基础设施

- [x] 1.1 在项目根目录创建 review-service 的 Dockerfile（基于 node:22-slim，复制源码，安装依赖，启动命令）
- [x] 1.2 添加 .dockerignore 文件
- [x] 1.3 创建 docker-compose.yml：定义 review-service 服务（构建上下文、Docker socket 挂载、review-net 网络、env_file、restart: unless-stopped）
- [x] 1.4 更新 .env.example，补充 APP_PORTS 等新配置项说明

## 2. 配置重构

- [x] 2.1 修改 config.ts：将 appPort 改为 appPorts 数组（解析 APP_PORTS 环境变量，默认 7702），移除 previewPortBase 和 ttydPortBase
- [x] 2.2 简化或删除 port-allocator.ts，移除 preview/ttyd 固定端口分配逻辑

## 3. Docker network 和容器管理

- [x] 3.1 在 docker-manager.ts 中添加 ensureNetwork() 方法，启动时创建或获取 review-net 网络
- [x] 3.2 修改 createContainer()：容器加入 review-net，ttyd 端口不映射到宿主机，appPorts 各端口使用 HostPort:"" 随机映射
- [x] 3.3 创建后通过 container.inspect() 获取实际端口映射，存入 ContainerInfo（新增 ports: Record<number, number> 字段）
- [x] 3.4 修改 recoverState()：恢复时对每个容器执行 inspect 获取端口映射

## 4. 代理和路由重构

- [x] 4.1 修改 ttyd-proxy.ts：代理目标从 127.0.0.1:固定端口 改为 review-env-mr-<id>:7681（Docker network 内部通信）
- [x] 4.2 删除 src/routes/preview.ts，从 server.ts 中移除 previewRouter
- [x] 4.3 修改 getContainerStatus() 返回值，包含 ports 字段（容器端口→宿主机端口映射）
- [x] 4.4 修改 webhook.ts 中的评论格式，终端 URL 保持 /mr/<id>，包含端口映射信息，移除 /preview 链接

## 5. 验证

- [ ] 5.1 在 macOS (Colima) 环境验证 docker compose up 启动、容器创建、ttyd 代理、随机端口访问
- [ ] 5.2 在 Linux 环境验证同样的功能，确认行为一致
