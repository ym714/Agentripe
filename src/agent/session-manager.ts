import { Session } from "./session";
import { LogWriter } from "../logging/log-writer";
import type { WSClient } from "../types";

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private logWriter: LogWriter;

  constructor() {
    this.logWriter = new LogWriter();
  }

  /**
   * Create a new session
   */
  createSession(): Session {
    const id = this.generateSessionId();
    const session = new Session(id, this.logWriter);
    this.sessions.set(id, session);
    console.log(`Created session: ${id}`);
    return session;
  }

  /**
   * Get an existing session by ID
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get or create a session
   */
  getOrCreateSession(id?: string): Session {
    if (id) {
      const existing = this.sessions.get(id);
      if (existing) {
        return existing;
      }
    }
    return this.createSession();
  }

  /**
   * List all sessions
   */
  listSessions(): Array<{
    id: string;
    messageCount: number;
    isActive: boolean;
    createdAt: string;
  }> {
    return Array.from(this.sessions.values()).map((s) => s.getInfo());
  }

  /**
   * Subscribe a client to a session
   */
  subscribeClient(sessionId: string, client: WSClient): Session | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.subscribe(client);
      return session;
    }
    return null;
  }

  /**
   * Unsubscribe a client from their current session
   */
  unsubscribeClient(client: WSClient): void {
    const sessionId = client.data.sessionId;
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.unsubscribe(client);
      }
    }
  }

  /**
   * Stop a running session
   */
  stopSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      return session.stop();
    }
    return false;
  }

  /**
   * Clean up a session
   */
  async deleteSession(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (session) {
      await session.cleanup();
      this.sessions.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.cleanup();
    }
    this.sessions.clear();
    this.logWriter.close();
  }

  /**
   * Get the log writer instance
   */
  getLogWriter(): LogWriter {
    return this.logWriter;
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }
}
