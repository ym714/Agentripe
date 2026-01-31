import type { ScheduledTask, ScheduledTaskRun, WSClient } from "../types";
import { SessionManager } from "../agent/session-manager";

export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private sessionManager: SessionManager;
  private taskRuns: ScheduledTaskRun[] = [];
  private subscribers: Set<WSClient> = new Set();
  private onTasksChanged?: () => Promise<void>;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Set a callback to be called when tasks change (for persistence)
   */
  setOnTasksChanged(callback: () => Promise<void>): void {
    this.onTasksChanged = callback;
  }

  /**
   * Subscribe a WebSocket client to scheduler updates
   */
  subscribe(client: WSClient): void {
    this.subscribers.add(client);
  }

  /**
   * Unsubscribe a WebSocket client
   */
  unsubscribe(client: WSClient): void {
    this.subscribers.delete(client);
  }

  /**
   * Initialize scheduler with saved tasks
   */
  async initialize(savedTasks: ScheduledTask[]): Promise<void> {
    for (const task of savedTasks) {
      this.tasks.set(task.id, task);
      if (task.enabled) {
        this.scheduleNextRun(task);
      }
    }
    console.log(`Scheduler initialized with ${savedTasks.length} tasks`);
  }

  /**
   * Create a new scheduled task
   */
  async createTask(params: {
    name: string;
    prompt: string;
    intervalMs: number;
    enabled?: boolean;
  }): Promise<ScheduledTask> {
    const id = this.generateTaskId();
    const now = new Date().toISOString();

    const task: ScheduledTask = {
      id,
      name: params.name,
      prompt: params.prompt,
      intervalMs: params.intervalMs,
      enabled: params.enabled ?? true,
      createdAt: now,
      lastRunAt: null,
      nextRunAt: params.enabled !== false ? new Date(Date.now() + params.intervalMs).toISOString() : null,
      sessionId: null, // Will be set on first run
    };

    this.tasks.set(id, task);

    if (task.enabled) {
      this.scheduleNextRun(task);
    }

    await this.notifyTasksChanged();
    this.broadcastTaskUpdate(task, "created");

    console.log(`Created scheduled task: ${task.name} (${task.id}) - interval: ${task.intervalMs}ms`);
    return task;
  }

  /**
   * Update an existing scheduled task
   */
  async updateTask(
    id: string,
    updates: Partial<Pick<ScheduledTask, "name" | "prompt" | "intervalMs" | "enabled" | "sessionId">>
  ): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    // Cancel existing timer if any
    this.cancelTimer(id);

    // Apply updates
    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
    };

    // Recalculate nextRunAt if interval or enabled changed
    if (updatedTask.enabled) {
      updatedTask.nextRunAt = new Date(Date.now() + updatedTask.intervalMs).toISOString();
      this.scheduleNextRun(updatedTask);
    } else {
      updatedTask.nextRunAt = null;
    }

    this.tasks.set(id, updatedTask);
    await this.notifyTasksChanged();
    this.broadcastTaskUpdate(updatedTask, "updated");

    console.log(`Updated scheduled task: ${updatedTask.name} (${id})`);
    return updatedTask;
  }

  /**
   * Delete a scheduled task
   */
  async deleteTask(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }

    this.cancelTimer(id);
    this.tasks.delete(id);
    await this.notifyTasksChanged();
    this.broadcastTaskUpdate(task, "deleted");

    console.log(`Deleted scheduled task: ${task.name} (${id})`);
    return true;
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * List all tasks
   */
  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get all tasks as array (for persistence)
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Manually trigger a task to run now
   */
  async runTaskNow(id: string): Promise<ScheduledTaskRun | null> {
    const task = this.tasks.get(id);
    if (!task) {
      return null;
    }

    return this.executeTask(task);
  }

  /**
   * Get recent task runs
   */
  getTaskRuns(taskId?: string, limit = 50): ScheduledTaskRun[] {
    let runs = this.taskRuns;
    if (taskId) {
      runs = runs.filter((r) => r.taskId === taskId);
    }
    return runs.slice(-limit);
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    for (const [id] of this.timers) {
      this.cancelTimer(id);
    }
    this.subscribers.clear();
    console.log("Scheduler stopped");
  }

  private scheduleNextRun(task: ScheduledTask): void {
    // Calculate time until next run
    let delay = task.intervalMs;

    if (task.nextRunAt) {
      const nextRunTime = new Date(task.nextRunAt).getTime();
      const now = Date.now();
      delay = Math.max(0, nextRunTime - now);
    }

    console.log(`Scheduling task ${task.name} to run in ${delay}ms`);

    const timer = setTimeout(async () => {
      await this.executeTask(task);

      // Schedule next run if still enabled
      const currentTask = this.tasks.get(task.id);
      if (currentTask && currentTask.enabled) {
        this.scheduleNextRun(currentTask);
      }
    }, delay);

    this.timers.set(task.id, timer);
  }

  private async executeTask(task: ScheduledTask): Promise<ScheduledTaskRun> {
    const startedAt = new Date().toISOString();

    // Reuse existing session or create a new one
    let session = task.sessionId ? this.sessionManager.getSession(task.sessionId) : undefined;
    let isNewSession = false;

    if (!session) {
      session = this.sessionManager.createSession();
      isNewSession = true;
      console.log(`Created new session for task: ${task.name} (${task.id}) -> session ${session.id}`);
    } else {
      console.log(`Reusing existing session for task: ${task.name} (${task.id}) -> session ${session.id}`);
    }

    console.log(`Executing scheduled task: ${task.name} (${task.id}) in session ${session.id}`);

    const run: ScheduledTaskRun = {
      taskId: task.id,
      sessionId: session.id,
      startedAt,
      completedAt: null,
      success: false,
    };

    this.broadcastTaskRun(run, "started");

    try {
      // Execute the task prompt
      await session.addUserMessage(task.prompt);

      run.completedAt = new Date().toISOString();
      run.success = true;

      // Update task's lastRunAt, nextRunAt, and sessionId
      task.lastRunAt = startedAt;
      task.nextRunAt = new Date(Date.now() + task.intervalMs).toISOString();

      // Save session ID if this is a new session
      if (isNewSession) {
        task.sessionId = session.id;
        console.log(`Saved session ID for task: ${task.name} -> ${session.id}`);
      }

      this.tasks.set(task.id, task);
      await this.notifyTasksChanged();

      console.log(`Scheduled task completed: ${task.name} (${task.id})`);
    } catch (error) {
      run.completedAt = new Date().toISOString();
      run.success = false;
      run.error = (error as Error).message;

      console.error(`Scheduled task failed: ${task.name} (${task.id})`, error);
    }

    this.taskRuns.push(run);

    // Keep only last 1000 runs
    if (this.taskRuns.length > 1000) {
      this.taskRuns = this.taskRuns.slice(-1000);
    }

    this.broadcastTaskRun(run, "completed");
    this.broadcastTaskUpdate(task, "updated");

    return run;
  }

  private cancelTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private async notifyTasksChanged(): Promise<void> {
    if (this.onTasksChanged) {
      await this.onTasksChanged();
    }
  }

  private broadcastTaskUpdate(task: ScheduledTask, action: "created" | "updated" | "deleted"): void {
    const message = JSON.stringify({
      type: "scheduler_task_update",
      action,
      task,
    });

    for (const client of this.subscribers) {
      try {
        client.send(message);
      } catch (error) {
        console.error("Error broadcasting scheduler update:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastTaskRun(run: ScheduledTaskRun, status: "started" | "completed"): void {
    const message = JSON.stringify({
      type: "scheduler_task_run",
      status,
      run,
    });

    for (const client of this.subscribers) {
      try {
        client.send(message);
      } catch (error) {
        console.error("Error broadcasting task run:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `task-${timestamp}-${random}`;
  }
}
