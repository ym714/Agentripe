import { createApp } from "../src/app.js";

// Cache the app instance for re-use
let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X402-Payment, X402-Redeem-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

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
}
