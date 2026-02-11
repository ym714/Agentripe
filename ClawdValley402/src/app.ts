import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { PrismaVendorRepository } from "./infrastructure/prisma/repositories/PrismaVendorRepository.js";
import { PrismaProductRepository } from "./infrastructure/prisma/repositories/PrismaProductRepository.js";
import { PrismaPaymentRepository } from "./infrastructure/prisma/repositories/PrismaPaymentRepository.js";
import { PrismaTaskRepository } from "./infrastructure/prisma/repositories/PrismaTaskRepository.js";
import { PrismaAPIKeyRepository } from "./infrastructure/prisma/repositories/PrismaAPIKeyRepository.js";
import { PrismaRedeemTokenRepository } from "./infrastructure/prisma/repositories/PrismaRedeemTokenRepository.js";
import { X402PaymentGateway } from "./infrastructure/x402/X402PaymentGateway.js";
import { EvmEscrowService } from "./infrastructure/escrow/EvmEscrowService.js";
import { RegisterVendor } from "./application/usecases/RegisterVendor.js";
import { RegisterProduct } from "./application/usecases/RegisterProduct.js";
import { ProcessX402Request } from "./application/usecases/ProcessX402Request.js";
import { GetVendorTasks } from "./application/usecases/GetVendorTasks.js";
import { StartTaskProcessing } from "./application/usecases/StartTaskProcessing.js";
import { ReportTaskResult } from "./application/usecases/ReportTaskResult.js";
import { GetTaskStatus } from "./application/usecases/GetTaskStatus.js";
import { GetTaskResult } from "./application/usecases/GetTaskResult.js";
import { CreateRedeemToken } from "./application/usecases/CreateRedeemToken.js";
import { RedeemAPIKey } from "./application/usecases/RedeemAPIKey.js";
import { createAdminRoutes } from "./presentation/routes/admin.js";
import { createX402Routes } from "./presentation/routes/x402.js";
import { createVendorRoutes } from "./presentation/routes/vendor.js";
import { createTasksRoutes } from "./presentation/routes/tasks.js";
import { createRedeemRoutes } from "./presentation/routes/redeem.js";
import { createDemoRoutes } from "./presentation/routes/demo.js";
import { createVendorAuthMiddleware } from "./presentation/middleware/vendorAuth.js";

// Global Prisma Client to prevent multiple instances in serverless
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function createApp() {
    const vendorRepository = new PrismaVendorRepository(prisma);
    const productRepository = new PrismaProductRepository(prisma);
    const paymentRepository = new PrismaPaymentRepository(prisma);
    const taskRepository = new PrismaTaskRepository(prisma);
    const apiKeyRepository = new PrismaAPIKeyRepository(prisma);
    const redeemTokenRepository = new PrismaRedeemTokenRepository(prisma);

    const registerVendor = new RegisterVendor(vendorRepository);
    const registerProduct = new RegisterProduct(productRepository, vendorRepository);

    const facilitatorUrl = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
    const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    const paymentGateway = new X402PaymentGateway(facilitatorClient);

    // Note: Initializing payment gateway might need to be optimized for serverless if it makes heavy network calls
    try {
        await paymentGateway.initialize();
    } catch (error) {
        console.warn("Failed to initialize Payment Gateway:", error);
        // We continue, as it might be a temporary network issue or configuration error
    }

    const redeemTokenExpiryHours = parseInt(process.env.REDEEM_TOKEN_EXPIRY_HOURS ?? "24", 10);
    const createRedeemToken = new CreateRedeemToken(redeemTokenRepository, redeemTokenExpiryHours);
    const redeemAPIKey = new RedeemAPIKey(redeemTokenRepository, apiKeyRepository);

    const escrowPrivateKey = process.env.ESCROW_PRIVATE_KEY;
    let escrowService: EvmEscrowService | undefined;

    if (escrowPrivateKey) {
        try {
            escrowService = new EvmEscrowService(
                escrowPrivateKey,
                process.env.USDC_CONTRACT_ADDRESS,
                process.env.RPC_URL
            );
            console.log(`Escrow wallet address: ${escrowService.getEscrowAddress()}`);
        } catch (error) {
            console.error("Failed to initialize Escrow Service:", error);
            // We continue without escrow service if initialization fails
        }
    }

    const processX402Request = new ProcessX402Request(
        productRepository,
        vendorRepository,
        paymentGateway,
        paymentRepository,
        taskRepository,
        createRedeemToken,
        escrowService
    );

    const getVendorTasks = new GetVendorTasks(taskRepository);
    const startTaskProcessing = new StartTaskProcessing(taskRepository);
    const reportTaskResult = new ReportTaskResult(
        taskRepository,
        paymentRepository,
        vendorRepository,
        escrowService
    );
    const getTaskStatus = new GetTaskStatus(taskRepository);
    const getTaskResult = new GetTaskResult(taskRepository);

    const app = express();

    // Configure CORS to allow frontend origins
    app.use(cors({
        origin: [
            'http://localhost:3000',
            'https://agentripe.vercel.app',
            'https://agentripe-8ot3.vercel.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X402-Payment', 'X402-Redeem-Token']
    }));

    app.use(express.json());

    app.get("/health", (req, res) => {
        res.json({ status: "ok", version: "1.0.0" });
    });

    app.use("/admin", createAdminRoutes(registerVendor, registerProduct));
    app.use(
        "/vendor",
        createVendorAuthMiddleware(vendorRepository, apiKeyRepository),
        createVendorRoutes(getVendorTasks, startTaskProcessing, reportTaskResult)
    );
    app.use("/tasks", createTasksRoutes(getTaskStatus, getTaskResult));
    app.use("/redeem", createRedeemRoutes(redeemAPIKey));
    app.use("/demo", createDemoRoutes(prisma, getVendorTasks, startTaskProcessing, reportTaskResult, escrowService));
    app.use("/", createX402Routes(processX402Request, paymentGateway));

    return app;
}
