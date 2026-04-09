## ADDED Requirements

### 需求:深色主题默认值
review-base 镜像中的 code-server 必须默认使用深色主题。

#### 场景:首次打开 code-server
- **当** 用户首次打开基于 review-base 的容器中的 code-server
- **那么** 界面必须显示为 "Default Dark Modern" 主题，无需手动切换

### 需求:禁用 workspace trust
review-base 镜像中的 code-server 必须禁用 workspace trust 机制，禁止弹出信任确认对话框。

#### 场景:打开工作区无弹窗
- **当** code-server 打开 /workspace 目录
- **那么** 禁止显示 "Do you trust the authors of the files in this folder?" 弹窗

#### 场景:扩展不受限制模式影响
- **当** workspace trust 被禁用
- **那么** 所有已安装扩展必须以完整功能模式运行，禁止进入 Restricted Mode

### 需求:禁用扩展推荐通知
review-base 镜像中的 code-server 必须禁用所有扩展推荐和自动更新通知。

#### 场景:无扩展推荐弹窗
- **当** 用户在 code-server 中编辑文件
- **那么** 右下角禁止弹出扩展推荐或安装建议的通知

#### 场景:无自动更新提示
- **当** code-server 启动
- **那么** 禁止自动检查扩展更新或弹出更新通知

### 需求:禁用内置 AI 功能
review-base 镜像中的 code-server 必须禁用所有内置 AI/Copilot 相关功能。

#### 场景:无 Copilot 提示
- **当** 用户在 code-server 中编码
- **那么** 禁止出现 GitHub Copilot 相关的内联建议、聊天入口或激活提示

#### 场景:AI 功能入口隐藏
- **当** code-server 启动
- **那么** 聊天命令中心和 AI 功能入口必须被隐藏

### 需求:禁用账号登录
review-base 镜像中的 code-server 必须禁用 GitHub 账号登录体系。

#### 场景:无 GitHub 登录提示
- **当** 用户使用 code-server
- **那么** 禁止弹出 GitHub 账号登录对话框或认证请求

#### 场景:git 操作使用容器凭证
- **当** 用户在 code-server 终端执行 git 操作
- **那么** 必须使用 entrypoint 中配置的 git credential helper，禁止触发 VS Code 内置的 GitHub 认证流程

### 需求:禁用干扰性启动内容
review-base 镜像中的 code-server 必须禁用欢迎页、更新说明等启动干扰内容。

#### 场景:启动无欢迎页
- **当** code-server 首次启动
- **那么** 禁止显示 Welcome 标签页或 Getting Started 引导

#### 场景:无更新说明
- **当** code-server 版本更新后首次启动
- **那么** 禁止弹出 Release Notes 页面
