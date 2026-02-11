// Vercel serverless function handler
// Uses TypeScript compilation via @vercel/node
const { createApp } = require("../src/app");

// Cache the app instance for re-use across invocations
let appPromise = null;

module.exports = async function handler(req, res) {
    try {
        if (!appPromise) {
            console.log("Initializing app...");
            appPromise = createApp();
        }
        const app = await appPromise;
        app(req, res);
    } catch (error) {
        console.error("Critical error in serverless function:", error);
        res.status(500).json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
