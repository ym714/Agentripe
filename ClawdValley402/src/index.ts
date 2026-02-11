import { createApp } from "./app.js";

async function main() {
  const app = await createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`x402 Sales Server running at http://localhost:${PORT}`);
    console.log("Health Check: GET /health");
  });
}

// Check if running directly (ESM way)
// In Bun/Node ESM, import.meta.url compares to process.argv
// For simplicity in this project setup, just running main() since it's the entry point
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
