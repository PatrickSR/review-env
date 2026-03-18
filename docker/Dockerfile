FROM node:22

# 安装 git 和 curl
RUN apt-get update && apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

# 安装 ttyd（预编译二进制）
RUN curl -fSL https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.aarch64 \
    -o /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd

# 配置 CVTE npm registry 并安装 Claude Code
RUN npm config set registry http://artifactory.gz.cvte.cn/artifactory/api/npm/cvte-npm-registry/ && \
    npm install -g @anthropic-ai/claude-code

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
