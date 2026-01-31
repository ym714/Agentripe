#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Check if bun is available
async function checkBun() {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["--version"], { stdio: "pipe" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  // Handle help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Valley Agent - AI Agent Server with Web UI

Usage:
  npx valley-agent [options]

Options:
  --port, -p <port>   Port to run the server on (default: 8453)
  --help, -h          Show this help message
  --version, -v       Show version

Examples:
  npx valley-agent
  npx valley-agent --port 8080

The server will be available at http://localhost:<port>
Workspace directory: ~/.valley/
`);
    process.exit(0);
  }

  // Handle version
  if (args.includes("--version") || args.includes("-v")) {
    const pkg = await import("../package.json", { with: { type: "json" } });
    console.log(`valley-agent v${pkg.default.version}`);
    process.exit(0);
  }

  // Parse port
  let port = 8453;
  const portIndex = args.findIndex((a) => a === "--port" || a === "-p");
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
    if (isNaN(port)) {
      console.error("Error: Invalid port number");
      process.exit(1);
    }
  }

  // Check for bun
  const hasBun = await checkBun();

  if (!hasBun) {
    console.error(`
Error: Bun is required to run Valley Agent.

Please install Bun first:
  curl -fsSL https://bun.sh/install | bash

Or visit: https://bun.sh
`);
    process.exit(1);
  }

  // Set port environment variable
  process.env.VALLEY_AGENT_PORT = String(port);

  // Run the server with bun
  const entryPoint = join(projectRoot, "dist", "index.js");

  console.log(`Starting Valley Agent on port ${port}...`);

  const proc = spawn("bun", ["run", entryPoint], {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, VALLEY_AGENT_PORT: String(port) },
  });

  proc.on("error", (err) => {
    console.error("Failed to start Valley Agent:", err.message);
    process.exit(1);
  });

  proc.on("close", (code) => {
    process.exit(code || 0);
  });

  // Handle termination signals
  process.on("SIGINT", () => {
    proc.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    proc.kill("SIGTERM");
  });
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
