import type { WSClient, SDKMessage } from "../types";
import { AIClient, type AIQueryOptions } from "./ai-client";
import { LogWriter } from "../logging/log-writer";

export class Session {
  public readonly id: string;
  private queryPromise: Promise<void> | null = null;
  private subscribers: Set<WSClient> = new Set();
  private messageCount = 0;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;
  private logWriter: LogWriter;
  private createdAt: Date;
  private abortController: AbortController | null = null;

  constructor(id: string, logWriter: LogWriter) {
    this.id = id;
    this.aiClient = new AIClient();
    this.logWriter = logWriter;
    this.createdAt = new Date();
  }

  /**
   * Process a single user message
   */
  async addUserMessage(content: string): Promise<void> {
    if (this.queryPromise) {
      // Wait for current query to finish
      await this.queryPromise;
    }

    this.messageCount++;
    console.log(`Processing message ${this.messageCount} in session ${this.id}`);

    // Create new abort controller for this query
    this.abortController = new AbortController();

    this.queryPromise = (async () => {
      try {
        // Use resume for multi-turn, fresh for first message
        const options: Partial<AIQueryOptions> = this.sdkSessionId
          ? { resume: this.sdkSessionId, abortSignal: this.abortController?.signal }
          : { abortSignal: this.abortController?.signal };

        for await (const message of this.aiClient.queryStream(content, options)) {
          // Check if aborted
          if (this.abortController?.signal.aborted) {
            console.log(`Session ${this.id} was aborted`);
            break;
          }

          // Log message
          this.logWriter.appendLog(this.id, message);

          // Broadcast to WebSocket subscribers
          this.broadcastToSubscribers(message);

          // Capture SDK session ID for multi-turn
          if (message.type === "system" && message.subtype === "init") {
            this.sdkSessionId = message.session_id;
            console.log(`Captured SDK session ID: ${this.sdkSessionId}`);
          }

          // Check if conversation ended
          if (message.type === "result") {
            console.log("Result received, ready for next user message");
          }
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage === "Query aborted" || this.abortController?.signal.aborted) {
          console.log(`Session ${this.id} was stopped by user`);
          this.broadcast({
            type: "stopped",
            sessionId: this.id,
            message: "Session stopped by user",
          });
        } else {
          console.error(`Error in session ${this.id}:`, error);
          this.broadcastError("Query failed: " + errorMessage);
        }
      } finally {
        this.queryPromise = null;
        this.abortController = null;
      }
    })();

    await this.queryPromise;
  }

  /**
   * Stop the current query
   */
  stop(): boolean {
    if (this.abortController && this.queryPromise) {
      console.log(`Stopping session ${this.id}`);
      this.abortController.abort();
      return true;
    }
    return false;
  }

  /**
   * Subscribe a WebSocket client to this session
   */
  subscribe(client: WSClient): void {
    this.subscribers.add(client);
    client.data.sessionId = this.id;

    // Send session info to new subscriber
    client.send(
      JSON.stringify({
        type: "session_info",
        sessionId: this.id,
        messageCount: this.messageCount,
        isActive: this.queryPromise !== null,
      })
    );
  }

  /**
   * Unsubscribe a WebSocket client
   */
  unsubscribe(client: WSClient): void {
    this.subscribers.delete(client);
  }

  /**
   * Broadcast a message to all subscribers
   */
  private broadcastToSubscribers(message: SDKMessage): void {
    let wsMessage: unknown = null;

    if (message.type === "assistant") {
      const content = message.message.content;
      if (typeof content === "string") {
        wsMessage = {
          type: "assistant_message",
          content: content,
          sessionId: this.id,
        };
      } else if (Array.isArray(content)) {
        // Handle content blocks
        for (const block of content) {
          if (block.type === "text") {
            wsMessage = {
              type: "assistant_message",
              content: block.text,
              sessionId: this.id,
            };
          } else if (block.type === "tool_use") {
            wsMessage = {
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              sessionId: this.id,
            };
          } else if (block.type === "tool_result") {
            wsMessage = {
              type: "tool_result",
              toolUseId: block.tool_use_id,
              content: block.content,
              isError: block.is_error,
              sessionId: this.id,
            };
          }
          if (wsMessage) {
            this.broadcast(wsMessage);
          }
        }
        return; // Already broadcasted block by block
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        wsMessage = {
          type: "result",
          success: true,
          result: message.result,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
          sessionId: this.id,
        };
      } else {
        wsMessage = {
          type: "result",
          success: false,
          error: message.subtype,
          sessionId: this.id,
        };
      }
    } else if (message.type === "system") {
      wsMessage = {
        type: "system",
        subtype: message.subtype,
        sessionId: this.id,
        data: message,
      };
    } else if (message.type === "user") {
      wsMessage = {
        type: "user_message",
        content: message.message.content,
        sessionId: this.id,
      };
    }

    if (wsMessage) {
      this.broadcast(wsMessage);
    }
  }

  private broadcast(message: unknown): void {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string): void {
    this.broadcast({
      type: "error",
      error: error,
      sessionId: this.id,
    });
  }

  /**
   * Check if session has any subscribers
   */
  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  /**
   * Get session info
   */
  getInfo(): {
    id: string;
    messageCount: number;
    isActive: boolean;
    createdAt: string;
    sdkSessionId: string | null;
  } {
    return {
      id: this.id,
      messageCount: this.messageCount,
      isActive: this.queryPromise !== null,
      createdAt: this.createdAt.toISOString(),
      sdkSessionId: this.sdkSessionId,
    };
  }

  /**
   * Clean up session
   */
  async cleanup(): Promise<void> {
    this.subscribers.clear();
    this.logWriter.closeSession(this.id);
  }

  /**
   * End current conversation (for starting fresh)
   */
  endConversation(): void {
    this.sdkSessionId = null;
    this.queryPromise = null;
  }
}
