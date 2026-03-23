## MODIFIED Requirements

### 需求:ttyd 通过宿主机端口直连
review-service 创建 MR 容器时，必须将 ttyd 端口（7681）映射到宿主机随机端口（`HostPort: "0"`）。前端必须通过宿主机地址和映射端口直连 ttyd，禁止通过反向代理访问。测试容器的 ttyd 端口映射策略保持不变。

#### 场景:正式容器 ttyd 端口映射
- **当** 创建新的 MR review 容器
- **那么** 容器的 7681 端口必须映射到宿主机随机端口，映射信息必须通过 `container.inspect()` 获取并存储到 `containers` 表的 `ports` 字段

#### 场景:前端直连 ttyd
- **当** 用户在终端页面选择工具并启动容器后，容器状态变为 ready
- **那么** 前端必须从 status API 的 `ports` 字段获取 7681 对应的宿主机端口，使用 `http://${location.hostname}:${ttydPort}/` 作为 iframe src 直连 ttyd

#### 场景:测试容器 ttyd 端口映射不变
- **当** 创建测试容器
- **那么** ttyd 端口映射策略保持现有行为（映射到宿主机随机端口，通过 `DOCKER_HOST_IP` 访问）

## REMOVED Requirements

### 需求:ttyd 通过 Docker network 代理
**Reason**: MR 容器改为端口映射直连方案，不再需要通过 Docker network 内部地址代理 ttyd 请求
**Migration**: 前端 iframe 直连宿主机 ttyd 端口，代理代码从 `ttyd-proxy.ts` 中删除
