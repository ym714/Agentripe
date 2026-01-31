import { startServer } from "./server";

// Start the Valley Agent server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
