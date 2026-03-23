import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/admin",
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
        target: "http://localhost:3000",
        ws: true,
      },
      "/webhook": "http://localhost:3000",
      "/mr": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});
