import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { dockerManager } from "./services/docker-manager.js";
import { webhookRouter } from "./routes/webhook.js";
import { terminalRouter } from "./routes/terminal.js";
import { previewRouter } from "./routes/preview.js";
import { setupTtydProxy } from "./proxy/ttyd-proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Webhook needs raw JSON body
app.use("/webhook", express.json());

// Routes
app.use(webhookRouter);
app.use(terminalRouter);

// Static files (terminal.html)
app.use("/public", express.static(path.join(__dirname, "../public")));

// Recover state from existing containers
await dockerManager.recoverState();

// Periodic cleanup (every 60s)
setInterval(() => dockerManager.cleanupExpired(), 60_000);

const server = app.listen(config.port, () => {
  console.log(`Review Service running on http://localhost:${config.port}`);
});

// Setup proxies (needs server instance for WebSocket upgrade)
setupTtydProxy(app, server);
app.use(previewRouter);
