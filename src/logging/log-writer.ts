import * as fs from "fs";
import * as path from "path";
import { WorkspaceManager } from "../workspace/workspace-manager";
import type { SDKMessage } from "../types";

export interface LogEntry {
  timestamp: string;
  sessionId: string;
  type: string;
  data: unknown;
}

export class LogWriter {
  private workspaceManager: WorkspaceManager;
  private fileHandles: Map<string, fs.WriteStream> = new Map();

  constructor() {
    this.workspaceManager = WorkspaceManager.getInstance();
  }

  /**
   * Write a log entry for a session
   */
  async writeLog(sessionId: string, message: SDKMessage): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      type: message.type,
      data: message,
    };

    const line = JSON.stringify(entry) + "\n";
    const filePath = this.getLogPath(sessionId);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to file
    await Bun.write(filePath, line, { mode: 0o644 });
  }

  /**
   * Append a log entry (more efficient for streaming)
   */
  appendLog(sessionId: string, message: SDKMessage): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      type: message.type,
      data: message,
    };

    const line = JSON.stringify(entry) + "\n";
    const filePath = this.getLogPath(sessionId);

    // Get or create file handle
    let stream = this.fileHandles.get(sessionId);
    if (!stream) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      stream = fs.createWriteStream(filePath, { flags: "a" });
      this.fileHandles.set(sessionId, stream);
    }

    stream.write(line);
  }

  /**
   * Read all logs for a session
   */
  async readLogs(sessionId: string): Promise<LogEntry[]> {
    const filePath = this.getLogPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await Bun.file(filePath).text();
    const lines = content.trim().split("\n").filter(Boolean);

    return lines.map((line) => JSON.parse(line) as LogEntry);
  }

  /**
   * Close all file handles
   */
  close(): void {
    for (const stream of this.fileHandles.values()) {
      stream.end();
    }
    this.fileHandles.clear();
  }

  /**
   * Close a specific session's file handle
   */
  closeSession(sessionId: string): void {
    const stream = this.fileHandles.get(sessionId);
    if (stream) {
      stream.end();
      this.fileHandles.delete(sessionId);
    }
  }

  private getLogPath(sessionId: string): string {
    const sessionsDir = this.workspaceManager.getSessionsDir();
    return path.join(sessionsDir, `${sessionId}.jsonl`);
  }
}
