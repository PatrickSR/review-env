## ADDED Requirements

### 需求:before_script 配置
项目镜像配置必须支持 before_script 字段，允许用户指定容器 clone 代码后自动执行的初始化脚本。

#### 场景:添加镜像时配置 before_script
- **当** 用户在添加镜像弹窗中填写 before_script 内容
- **那么** 系统必须将 before_script 存储到 project_images 表的 before_script 列

#### 场景:编辑镜像时修改 before_script
- **当** 用户在编辑镜像弹窗中修改 before_script 内容
- **那么** 系统必须更新 project_images 表中对应记录的 before_script 列

#### 场景:before_script 表单展示
- **当** 用户打开添加或编辑镜像弹窗
- **那么** 弹窗必须包含 before_script textarea（monospace 字体），底部提示文字为"容器启动并 clone 代码后执行此脚本"

#### 场景:before_script 传入容器
- **当** 创建 MR review 容器且镜像配置的 before_script 非空
- **那么** 系统必须将 before_script 内容 base64 编码后作为 BEFORE_SCRIPT 环境变量传入容器

#### 场景:before_script 为空时不传入
- **当** 创建 MR review 容器且镜像配置的 before_script 为空
- **那么** 系统禁止传入 BEFORE_SCRIPT 环境变量
