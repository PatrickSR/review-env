import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        ws: true,
      },
      "/webhook": "http://localhost:3333",
      // 只代理终端 API 端点，不拦截 SPA 页面路由
      "/mr": {
        target: "http://localhost:3333",
        ws: true,
        bypass(req) {
          // 终端 API 路径格式: /mr/:pid/:mrid/(status|start|stop|images)
          if (req.url && /^\/mr\/\d+\/\d+\/(status|start|stop|images)/.test(req.url)) {
            return undefined; // 走代理
          }
          return req.url; // 其他返回 index.html（SPA 路由）
        },
      },
    },
  },
});
