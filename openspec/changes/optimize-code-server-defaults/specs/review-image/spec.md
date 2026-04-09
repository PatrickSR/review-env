## MODIFIED Requirements

### 需求:code-server 服务
容器就绪后必须运行 code-server 进程，提供 web IDE 服务。

#### 场景:code-server 监听端口
- **当** 容器初始化完成（无论成功或失败）
- **那么** code-server 必须在容器内 8080 端口监听

#### 场景:code-server 免认证
- **当** code-server 启动时
- **那么** 必须使用 `--auth none` 参数，禁止要求密码认证

#### 场景:code-server 工作目录
- **当** 用户通过浏览器访问 code-server
- **那么** code-server 必须自动打开 `/workspace` 目录（clone 的代码目录）

#### 场景:code-server 禁用遥测
- **当** code-server 启动时
- **那么** 必须使用 `--disable-telemetry` 参数禁用遥测数据收集

#### 场景:code-server 禁用内置认证扩展
- **当** code-server 启动时
- **那么** 必须使用 `--disable-extension vscode.github-authentication` 参数禁用内置 GitHub 认证扩展
