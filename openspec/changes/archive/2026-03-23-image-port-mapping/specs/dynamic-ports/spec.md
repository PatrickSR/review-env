## MODIFIED Requirements

### 需求:APP_PORTS 配置
系统必须支持通过镜像级别的 `ports` 字段配置容器内端口，替代全局环境变量 `APP_PORTS`。创建容器时，系统必须从 `project_images` 表读取对应镜像的 ports 配置，将每个端口使用 `HostPort: "0"` 让 Docker 随机分配宿主机端口。

#### 场景:从镜像配置读取端口
- **当** 创建容器时指定的 imageId 对应的镜像 ports 为 `"3000,5173"`
- **那么** 系统必须将容器内 3000、5173 端口各自映射到 Docker 随机分配的宿主机端口

#### 场景:镜像无端口配置
- **当** 创建容器时指定的 imageId 对应的镜像 ports 为空字符串
- **那么** 系统必须只映射内置的 ttyd 7681 端口
