## MODIFIED Requirements

### 需求:ttyd 通过 Docker network 代理
review-service 必须通过 Docker network 内部地址或宿主机端口代理 ttyd 请求。正式容器的 ttyd 端口（7681）禁止映射到宿主机，通过容器名访问。测试容器的 ttyd 端口映射到宿主机随机端口，通过宿主机地址访问。两种容器的连接信息必须从数据库查询获取。

#### 场景:正式容器 ttyd WebSocket 代理
- **当** 用户访问 `/mr/{projectId}/{mrIid}/terminal`
- **那么** review-service 必须通过 Docker network 将请求代理到 `review-env-{projectId}-mr-{mrIid}:7681`

#### 场景:测试容器 ttyd WebSocket 代理
- **当** 用户访问 `/api/docker/test/{containerId}/terminal`
- **那么** review-service 必须从 `test_containers` 表查询该容器的 `host_port`，将请求代理到 `http://{DOCKER_HOST_IP}:{host_port}`
- **并且** 禁止从内存 Map 中查找连接信息

#### 场景:ttyd 端口不暴露到宿主机（正式容器）
- **当** 正式 review 容器创建时
- **那么** 7681 端口禁止绑定到宿主机端口
