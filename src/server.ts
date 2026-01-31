import { WorkspaceManager } from "./workspace/workspace-manager";
import { SessionManager } from "./agent/session-manager";
import { Scheduler } from "./scheduler/scheduler";
import type { WSClient, IncomingMessage } from "./types";
import * as path from "path";
import { fileURLToPath } from "url";

// Get package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

// Port from environment variable or default
const PORT = parseInt(process.env.VALLEY_AGENT_PORT || "8453", 10);

// Initialize workspace and session manager
const workspaceManager = WorkspaceManager.getInstance();
const sessionManager = new SessionManager();
const scheduler = new Scheduler(sessionManager);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function startServer() {
  // Initialize workspace
  await workspaceManager.initialize();

  // Initialize scheduler
  const savedTasks = await workspaceManager.loadScheduledTasks();
  await scheduler.initialize(savedTasks);

  // Set up persistence callback for scheduler
  scheduler.setOnTasksChanged(async () => {
    await workspaceManager.saveScheduledTasks(scheduler.getAllTasks());
  });

  const server = Bun.serve({
    port: PORT,
    idleTimeout: 120,

    websocket: {
      open(ws: WSClient) {
        console.log("WebSocket client connected");
      },

      message(ws: WSClient, rawMessage: string) {
        try {
          const message = JSON.parse(rawMessage) as IncomingMessage;

          switch (message.type) {
            case "subscribe": {
              const session = sessionManager.subscribeClient(message.sessionId, ws);
              if (!session) {
                ws.send(
                  JSON.stringify({
                    type: "error",
                    error: `Session ${message.sessionId} not found`,
                  })
                );
              }
              break;
            }

            case "unsubscribe": {
              sessionManager.unsubscribeClient(ws);
              break;
            }

            case "subscribe_scheduler": {
              scheduler.subscribe(ws);
              ws.send(
                JSON.stringify({
                  type: "scheduler_subscribed",
                  tasks: scheduler.listTasks(),
                })
              );
              break;
            }

            case "unsubscribe_scheduler": {
              scheduler.unsubscribe(ws);
              break;
            }

            case "stop_session": {
              const stopped = sessionManager.stopSession(message.sessionId);
              ws.send(
                JSON.stringify({
                  type: "session_stopped",
                  sessionId: message.sessionId,
                  success: stopped,
                })
              );
              break;
            }

            case "chat": {
              handleChatMessage(ws, message);
              break;
            }

            default:
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: `Unknown message type`,
                })
              );
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Invalid message format",
            })
          );
        }
      },

      close(ws: WSClient) {
        console.log("WebSocket client disconnected");
        sessionManager.unsubscribeClient(ws);
        scheduler.unsubscribe(ws);
      },
    },

    async fetch(req: Request, server) {
      const url = new URL(req.url);

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, { data: { sessionId: "" } });
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        return;
      }

      // Serve Web UI
      if (url.pathname === "/") {
        return serveStaticFile("client/index.html", "text/html");
      }

      if (url.pathname === "/app.js") {
        return serveStaticFile("client/app.js", "application/javascript");
      }

      // API: Start new query
      if (url.pathname === "/api/query" && req.method === "POST") {
        return handleNewQuery(req);
      }

      // API: Send message to existing session
      if (url.pathname.match(/^\/api\/query\/[^/]+\/message$/) && req.method === "POST") {
        const sessionId = url.pathname.split("/")[3];
        return handleSessionMessage(req, sessionId);
      }

      // API: List sessions
      if (url.pathname === "/api/sessions" && req.method === "GET") {
        return handleListSessions();
      }

      // API: Get session logs
      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/logs$/) && req.method === "GET") {
        const sessionId = url.pathname.split("/")[3];
        return handleGetSessionLogs(sessionId);
      }

      // API: Stop a session
      if (url.pathname.match(/^\/api\/sessions\/[^/]+\/stop$/) && req.method === "POST") {
        const sessionId = url.pathname.split("/")[3];
        return handleStopSession(sessionId);
      }

      // ==================== Settings API ====================

      // API: Get CLAUDE.md
      if (url.pathname === "/api/settings/claude-md" && req.method === "GET") {
        return handleGetClaudeMd();
      }

      // API: Update CLAUDE.md
      if (url.pathname === "/api/settings/claude-md" && req.method === "PUT") {
        return handleSetClaudeMd(req);
      }

      // API: List skills
      if (url.pathname === "/api/settings/skills" && req.method === "GET") {
        return handleListSkills();
      }

      // API: Get a skill
      if (url.pathname.match(/^\/api\/settings\/skills\/[^/]+$/) && req.method === "GET") {
        const skillName = decodeURIComponent(url.pathname.split("/")[4]);
        return handleGetSkill(skillName);
      }

      // API: Create/Update a skill
      if (url.pathname.match(/^\/api\/settings\/skills\/[^/]+$/) && req.method === "PUT") {
        const skillName = decodeURIComponent(url.pathname.split("/")[4]);
        return handleSaveSkill(req, skillName);
      }

      // API: Delete a skill
      if (url.pathname.match(/^\/api\/settings\/skills\/[^/]+$/) && req.method === "DELETE") {
        const skillName = decodeURIComponent(url.pathname.split("/")[4]);
        return handleDeleteSkill(skillName);
      }

      // ==================== Scheduler API ====================

      // API: List scheduled tasks
      if (url.pathname === "/api/scheduler/tasks" && req.method === "GET") {
        return handleListScheduledTasks();
      }

      // API: Create scheduled task
      if (url.pathname === "/api/scheduler/tasks" && req.method === "POST") {
        return handleCreateScheduledTask(req);
      }

      // API: Get scheduled task
      if (url.pathname.match(/^\/api\/scheduler\/tasks\/[^/]+$/) && req.method === "GET") {
        const taskId = url.pathname.split("/")[4];
        return handleGetScheduledTask(taskId);
      }

      // API: Update scheduled task
      if (url.pathname.match(/^\/api\/scheduler\/tasks\/[^/]+$/) && req.method === "PUT") {
        const taskId = url.pathname.split("/")[4];
        return handleUpdateScheduledTask(req, taskId);
      }

      // API: Delete scheduled task
      if (url.pathname.match(/^\/api\/scheduler\/tasks\/[^/]+$/) && req.method === "DELETE") {
        const taskId = url.pathname.split("/")[4];
        return handleDeleteScheduledTask(taskId);
      }

      // API: Run scheduled task immediately
      if (url.pathname.match(/^\/api\/scheduler\/tasks\/[^/]+\/run$/) && req.method === "POST") {
        const taskId = url.pathname.split("/")[4];
        return handleRunScheduledTask(taskId);
      }

      // API: Get task runs
      if (url.pathname === "/api/scheduler/runs" && req.method === "GET") {
        const taskId = url.searchParams.get("taskId") || undefined;
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        return handleGetTaskRuns(taskId, limit);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Valley Agent server running at http://localhost:${server.port}`);
  console.log(`WebSocket endpoint available at ws://localhost:${server.port}/ws`);
  console.log(`Workspace directory: ${workspaceManager.getWorkspaceDir()}`);

  return server;
}

async function handleChatMessage(
  ws: WSClient,
  message: { content: string; sessionId?: string; newConversation?: boolean }
) {
  let session;

  if (message.sessionId) {
    session = sessionManager.getSession(message.sessionId);
    if (!session) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: `Session ${message.sessionId} not found`,
        })
      );
      return;
    }
  } else {
    // Create new session
    session = sessionManager.createSession();
  }

  // Subscribe client if not already
  session.subscribe(ws);

  // Handle new conversation flag
  if (message.newConversation) {
    session.endConversation();
  }

  // Process the message
  await session.addUserMessage(message.content);
}

async function handleNewQuery(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const session = sessionManager.createSession();

    // Start processing in background
    session.addUserMessage(prompt).catch((error) => {
      console.error(`Error processing query in session ${session.id}:`, error);
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        message: "Query started. Connect via WebSocket to receive updates.",
        wsUrl: `ws://localhost:${PORT}/ws`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleSessionMessage(req: Request, sessionId: string): Promise<Response> {
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const { content } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Start processing in background
    session.addUserMessage(content).catch((error) => {
      console.error(`Error processing message in session ${sessionId}:`, error);
    });

    return new Response(
      JSON.stringify({
        sessionId,
        message: "Message sent. Connect via WebSocket to receive updates.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

function handleListSessions(): Response {
  const sessions = sessionManager.listSessions();
  return new Response(JSON.stringify({ sessions }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleGetSessionLogs(sessionId: string): Promise<Response> {
  const logWriter = sessionManager.getLogWriter();
  const logs = await logWriter.readLogs(sessionId);

  return new Response(JSON.stringify({ logs }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function handleStopSession(sessionId: string): Response {
  const stopped = sessionManager.stopSession(sessionId);

  if (!stopped) {
    return new Response(
      JSON.stringify({ error: "Session not found or not running" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Session stopped" }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

// ==================== Settings Handlers ====================

async function handleGetClaudeMd(): Promise<Response> {
  const content = await workspaceManager.getClaudeMd();
  return new Response(JSON.stringify({ content }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleSetClaudeMd(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { content } = body;

    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await workspaceManager.setClaudeMd(content);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleListSkills(): Promise<Response> {
  const skills = await workspaceManager.listSkills();
  return new Response(JSON.stringify({ skills }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleGetSkill(name: string): Promise<Response> {
  const skill = await workspaceManager.getSkill(name);

  if (!skill) {
    return new Response(JSON.stringify({ error: "Skill not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ skill }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleSaveSkill(req: Request, name: string): Promise<Response> {
  try {
    const body = await req.json();
    const { content } = body;

    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "content must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const skill = await workspaceManager.saveSkill(name, content);

    return new Response(JSON.stringify({ skill }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleDeleteSkill(name: string): Promise<Response> {
  const deleted = await workspaceManager.deleteSkill(name);

  if (!deleted) {
    return new Response(JSON.stringify({ error: "Skill not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function serveStaticFile(filePath: string, contentType: string): Promise<Response> {
  try {
    // Resolve path relative to package root
    const fullPath = path.resolve(PACKAGE_ROOT, filePath);
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    }
  } catch {
    // File not found
  }
  return new Response("Not Found", { status: 404 });
}

// ==================== Scheduler Handlers ====================

function handleListScheduledTasks(): Response {
  const tasks = scheduler.listTasks();
  return new Response(JSON.stringify({ tasks }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleCreateScheduledTask(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, prompt, intervalMs, enabled } = body;

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!intervalMs || typeof intervalMs !== "number" || intervalMs < 1000) {
      return new Response(
        JSON.stringify({ error: "intervalMs must be a number >= 1000 (1 second)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const task = await scheduler.createTask({
      name,
      prompt,
      intervalMs,
      enabled: enabled !== false,
    });

    return new Response(JSON.stringify({ task }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

function handleGetScheduledTask(taskId: string): Response {
  const task = scheduler.getTask(taskId);

  if (!task) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ task }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleUpdateScheduledTask(req: Request, taskId: string): Promise<Response> {
  try {
    const body = await req.json();
    const { name, prompt, intervalMs, enabled, resetSession } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (prompt !== undefined) updates.prompt = prompt;
    if (intervalMs !== undefined) {
      if (typeof intervalMs !== "number" || intervalMs < 1000) {
        return new Response(
          JSON.stringify({ error: "intervalMs must be a number >= 1000 (1 second)" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
      updates.intervalMs = intervalMs;
    }
    if (enabled !== undefined) updates.enabled = enabled;

    // Reset session to start a new conversation
    if (resetSession === true) {
      updates.sessionId = null;
    }

    const task = await scheduler.updateTask(taskId, updates);

    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ task }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleDeleteScheduledTask(taskId: string): Promise<Response> {
  const deleted = await scheduler.deleteTask(taskId);

  if (!deleted) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleRunScheduledTask(taskId: string): Promise<Response> {
  const run = await scheduler.runTaskNow(taskId);

  if (!run) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ run }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function handleGetTaskRuns(taskId?: string, limit = 50): Response {
  const runs = scheduler.getTaskRuns(taskId, limit);
  return new Response(JSON.stringify({ runs }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
