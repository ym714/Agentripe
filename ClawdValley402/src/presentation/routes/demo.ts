import { Router } from "express";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { ObjectId } from "bson";
import { PrismaVendorRepository } from "../../infrastructure/prisma/repositories/PrismaVendorRepository.js";
import { PrismaProductRepository } from "../../infrastructure/prisma/repositories/PrismaProductRepository.js";
import { PrismaPaymentRepository } from "../../infrastructure/prisma/repositories/PrismaPaymentRepository.js";
import { PrismaTaskRepository } from "../../infrastructure/prisma/repositories/PrismaTaskRepository.js";
import { GetVendorTasks } from "../../application/usecases/GetVendorTasks.js";
import { StartTaskProcessing } from "../../application/usecases/StartTaskProcessing.js";
import { ReportTaskResult } from "../../application/usecases/ReportTaskResult.js";
import type { IEscrowService } from "../../application/ports/IEscrowService.js";
import { Task } from "../../domain/entities/Task.js";

export function createDemoRoutes(
  prisma: PrismaClient,
  getVendorTasks: GetVendorTasks,
  startTaskProcessing: StartTaskProcessing,
  reportTaskResult: ReportTaskResult,
  escrowService?: IEscrowService
): Router {
  const router = Router();

  // Demo endpoint: Execute prediction market analysis
  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { vendorId, productPath } = req.body;

      if (!vendorId || !productPath) {
        res.status(400).json({ error: "vendorId and productPath are required" });
        return;
      }

      const vendorRepository = new PrismaVendorRepository(prisma);
      const productRepository = new PrismaProductRepository(prisma);
      const paymentRepository = new PrismaPaymentRepository(prisma);
      const taskRepository = new PrismaTaskRepository(prisma);

      // Get vendor and product
      const product = await productRepository.findByVendorIdAndPath(vendorId, productPath);

      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      const vendor = await vendorRepository.findById(vendorId);

      if (!vendor) {
        res.status(404).json({ error: "Vendor not found" });
        return;
      }

      // Create mock payment (for demo purposes)
      const buyerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"; // Demo buyer address

      // Create payment record with proper ObjectId
      const paymentId = new ObjectId().toHexString();

      // Create task entity
      const task = Task.create({
        paymentId: paymentId,
        productId: product.id,
        vendorId: vendorId,
        buyerAddress: buyerAddress,
        requestPayload: JSON.stringify({ action: "market-analysis" }),
      });

      console.log("Task created:", task);
      console.log("Task has toJSON?", typeof task.toJSON);

      await taskRepository.save(task);

      // Start task processing
      await startTaskProcessing.execute({ vendorId: vendorId, taskId: task.id });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete task with result
      const analysisResult = {
        market: "Prediction Market",
        timestamp: new Date().toISOString(),
        analysis: {
          summary: "Market analysis completed successfully",
          trends: [
            { asset: "BTC/USD", trend: "bullish", confidence: 0.75 },
            { asset: "ETH/USD", trend: "neutral", confidence: 0.60 },
          ],
          recommendations: ["HODL", "DCA", "DYOR"],
        },
      };

      // Report result
      if (escrowService) {
        await reportTaskResult.complete({
          vendorId: vendorId,
          taskId: task.id,
          result: JSON.stringify(analysisResult) // Keeping original result format
        });
      }

      res.json({
        success: true,
        taskId: task.id,
        paymentId: paymentId,
        result: analysisResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Demo execute error:", error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
