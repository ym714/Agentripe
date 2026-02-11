import { createApp } from "../src/app";

// Cache the app instance for re-use
let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
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
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    }
}
