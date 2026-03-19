## 上下文

当前 review-service 通过 `npx tsx src/server.ts` 直接运行在宿主机上。它通过 dockerode 管理 review 容器，并通过 http-proxy-middleware 代理 ttyd 和 preview 请求。

现有问题：
- 服务未容器化，部署依赖宿主机 Node.js 环境
- 端口策略使用固定范围（ttyd: 7000-7019, preview: 9000-9019），只支持单个 app 端口
- preview 通过路径前缀代理（`/mr/<id>/preview`），前端框架资源路径容易出问题
- `network_mode: host` 在 macOS (Colima) 上行为不一致，无法作为跨平台方案

生产环境为 macOS (Colima) 和 Linux 双平台。

## 目标 / 非目标

**目标：**
- 将 review-service 容器化，通过 docker-compose 一键部署
- 使用 Docker bridge network 实现跨平台一致的容器间通信
- 支持一组可配置的 app 端口，由 Docker 随机分配宿主机端口
- ttyd 通过 Docker network 内部代理，不暴露到宿主机
- 去掉 preview 路径代理，用户直接通过随机端口访问 app
- macOS (Colima) 和 Linux 行为一致

**非目标：**
- 不涉及 K8s 部署
- 不做动态端口检测（容器运行时自动发现新监听端口）
- 不改变 review-env 容器镜像（docker/Dockerfile）

## 决策

### 1. Docker bridge network 替代 host 网络

**选择**：创建名为 `review-net` 的 Docker bridge network，review-service 和所有 review 容器加入同一网络。

**替代方案**：
- `network_mode: host`：Linux 上可行，但 macOS (Colima) 上 host 网络指向 VM 内部，Colima 对 host 模式的端口转发行为不一致。
- 不使用网络，通过宿主机端口映射通信：需要 ttyd 也映射到宿主机，浪费端口资源。

**理由**：bridge network 在 macOS 和 Linux 上行为一致。容器间通过容器名直接通信（`review-env-mr-<id>:7681`），不依赖宿主机端口。Colima 会自动将容器映射到宿主机的端口转发到 macOS，用户可以直接访问。

### 2. 多端口随机映射替代固定端口范围

**选择**：通过环境变量 `APP_PORTS` 配置一组容器内端口（如 `3000,5173,8080`），创建容器时每个端口使用 `HostPort: ""` 让 Docker 随机分配宿主机端口。创建后通过 `container.inspect()` 获取实际映射。

**替代方案**：
- 保持固定端口范围：需要预分配大量端口（每个容器 × 每个端口），端口冲突风险高，配置复杂。
- 通过 review-service 代理所有 app 流量（路径前缀方式）：路径重写导致前端框架资源路径问题，SPA 路由、WebSocket 升级等都需要特殊处理。

**理由**：随机端口 + 直接访问是最简单可靠的方案。没有路径前缀问题，前端框架零配置即可工作。Docker 的随机端口分配在两个平台上行为一致。

### 3. ttyd 通过 Docker network 内部代理

**选择**：ttyd 端口（7681）不映射到宿主机，review-service 通过 Docker network 代理到 `http://review-env-mr-<id>:7681`。

**理由**：ttyd 需要 WebSocket 支持和路径重写（`/mr/<id>/terminal` → `/`），通过 review-service 代理是合理的。且 ttyd 只有一个端口，代理逻辑简单。与 app 端口不同，ttyd 的路径前缀不会导致问题（ttyd 自身能处理）。

### 4. Sibling container 模式

**选择**：review-service 容器挂载 `/var/run/docker.sock`，管理 sibling review 容器。

**理由**：与之前设计一致。sibling container 模式最简单，生命周期独立，`recoverState()` 可正常工作。

### 5. 服务 Dockerfile 与 review-env Dockerfile 分离

**选择**：项目根目录新建 `Dockerfile`（review-service），保留 `docker/Dockerfile`（review-env）。

**理由**：两个镜像用途完全不同，分离职责清晰。

## 风险 / 权衡

- **[随机端口在容器重启后会变]** → `recoverState()` 需要重新 inspect 获取端口映射。API 返回的端口信息是动态的，前端不应缓存。
- **[Docker socket 挂载的安全性]** → 拥有 socket 访问权限等同于 root。缓解：确保镜像可信，不暴露 socket 到外部。
- **[Colima 端口转发延迟]** → Colima 将容器端口转发到 macOS 可能有短暂延迟。缓解：容器创建后等待端口可达再返回。
- **[review-net 网络需要预创建]** → review-service 启动时需要确保网络存在。在 docker-compose 中定义网络，并在 docker-manager 创建容器时指定加入。
