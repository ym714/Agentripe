import { Router } from "express";
import type { Request, Response } from "express";
import type { GetTaskStatus } from "../../application/usecases/GetTaskStatus";
import type { GetTaskResult } from "../../application/usecases/GetTaskResult";
import { TaskStatus } from "../../domain/entities/Task";

export function createTasksRoutes(
  getTaskStatus: GetTaskStatus,
  getTaskResult: GetTaskResult
): Router {
  const router = Router();

  router.get("/status", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId as string;

      if (!taskId) {
        res.status(400).json({ error: "Task ID is required" });
        return;
      }

      const result = await getTaskStatus.execute({ taskId });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/result", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId as string;

      if (!taskId) {
        res.status(400).json({ error: "Task ID is required" });
        return;
      }

      const result = await getTaskResult.execute({ taskId });
      res.json({
        status: result.status,
        result: result.result,
        errorMessage: result.errorMessage,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
