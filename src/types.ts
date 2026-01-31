import type { ServerWebSocket } from "bun";
import type { SDKUserMessage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// WebSocket client type
export type WSClient = ServerWebSocket<{ sessionId: string }>;

// Message types for WebSocket communication
export interface ChatMessage {
  type: "chat";
  content: string;
  sessionId?: string;
  newConversation?: boolean;
}

export interface SubscribeMessage {
  type: "subscribe";
  sessionId: string;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  sessionId: string;
}

export interface SubscribeSchedulerMessage {
  type: "subscribe_scheduler";
}

export interface UnsubscribeSchedulerMessage {
  type: "unsubscribe_scheduler";
}

export interface StopSessionMessage {
  type: "stop_session";
  sessionId: string;
}

export type IncomingMessage =
  | ChatMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | SubscribeSchedulerMessage
  | UnsubscribeSchedulerMessage
  | StopSessionMessage;

// Outgoing WebSocket message types
export interface AssistantMessageOut {
  type: "assistant_message";
  content: string;
  sessionId: string;
}

export interface ToolUseOut {
  type: "tool_use";
  toolName: string;
  toolId: string;
  toolInput: unknown;
  sessionId: string;
}

export interface ToolResultOut {
  type: "tool_result";
  toolUseId: string;
  content: unknown;
  isError: boolean;
  sessionId: string;
}

export interface ResultOut {
  type: "result";
  success: boolean;
  result?: string;
  error?: string;
  cost?: number;
  duration?: number;
  sessionId: string;
}

export interface SystemOut {
  type: "system";
  subtype: string;
  sessionId: string;
  data: unknown;
}

export interface ErrorOut {
  type: "error";
  error: string;
  sessionId: string;
}

export interface SessionInfoOut {
  type: "session_info";
  sessionId: string;
  messageCount: number;
  isActive: boolean;
}

export type OutgoingMessage =
  | AssistantMessageOut
  | ToolUseOut
  | ToolResultOut
  | ResultOut
  | SystemOut
  | ErrorOut
  | SessionInfoOut;

// Re-export SDK types for convenience
export type { SDKUserMessage, SDKMessage };

// ==================== Scheduler Types ====================

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  intervalMs: number; // Interval in milliseconds
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  sessionId: string | null; // Persistent session ID for multi-turn conversations
}

export interface ScheduledTaskRun {
  taskId: string;
  sessionId: string;
  startedAt: string;
  completedAt: string | null;
  success: boolean;
  error?: string;
}
