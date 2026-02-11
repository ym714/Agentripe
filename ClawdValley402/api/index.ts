import { createApp } from "../src/app";

// Cache the app instance for re-use
let appPromise: Promise<any> | null = null;

// Handle OPTIONS preflight requests before passing to Express
export default async function handler(req: any, res: any) {
    // Set CORS headers for all responses
    const setCorsHeaders = (response: any) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X402-Payment, X402-Redeem-Token');
        response.setHeader('Access-Control-Allow-Credentials', 'true');
    };

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        return res.status(204).end();
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
        setCorsHeaders(res);
        res.status(500).json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    }
}
