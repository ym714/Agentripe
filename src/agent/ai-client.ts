import { query } from "@anthropic-ai/claude-agent-sdk";
import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { execSync } from "child_process";
import type { SDKMessage, SDKUserMessage } from "../types";

// Find Claude CLI path
function findClaudeCli(): string | undefined {
  try {
    // Try to find claude in PATH
    const claudePath = execSync("which claude", { encoding: "utf-8" }).trim();
    if (claudePath && fs.existsSync(claudePath)) {
      return claudePath;
    }
  } catch {
    // Ignore errors
  }

  // Common installation paths
  const commonPaths = [
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(os.homedir(), ".local/bin/claude"),
    path.join(os.homedir(), ".claude/local/claude"),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

export interface AIQueryOptions {
  maxTurns?: number;
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
  resume?: string;
  settingSources?: ("local" | "project")[];
  hooks?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  pathToClaudeCodeExecutable?: string;
}

const VALLEY_DIR = path.join(os.homedir(), ".valley");

/**
 * Check if a path is within the VALLEY_DIR
 */
function isPathAllowed(filePath: string): boolean {
  if (!filePath) return false;

  // Resolve the path to handle relative paths and symlinks
  let resolvedPath: string;
  try {
    // If the path exists, use realpath to resolve symlinks
    if (fs.existsSync(filePath)) {
      resolvedPath = fs.realpathSync(filePath);
    } else {
      // For non-existent paths, resolve relative to VALLEY_DIR
      resolvedPath = path.resolve(VALLEY_DIR, filePath);
    }
  } catch {
    // If we can't resolve, try simple path resolution
    resolvedPath = path.resolve(VALLEY_DIR, filePath);
  }

  // Normalize both paths for comparison
  const normalizedValleyDir = path.normalize(VALLEY_DIR) + path.sep;
  const normalizedPath = path.normalize(resolvedPath);

  return normalizedPath.startsWith(normalizedValleyDir) || normalizedPath === path.normalize(VALLEY_DIR);
}

/**
 * Create hooks to restrict file access to VALLEY_DIR only
 */
function createSandboxHooks() {
  return {
    PreToolUse: [
      // Hook for file operations (Read, Write, Edit, Glob, Grep)
      {
        matcher: "Read|Write|Edit|MultiEdit|Glob|Grep",
        hooks: [
          async (input: { tool_name: string; tool_input: Record<string, unknown> }): Promise<HookJSONOutput> => {
            const toolName = input.tool_name;
            const toolInput = input.tool_input;

            // Get the file path based on tool type
            let filePath = "";
            if (toolName === "Read" || toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") {
              filePath = (toolInput.file_path as string) || "";
            } else if (toolName === "Glob" || toolName === "Grep") {
              filePath = (toolInput.path as string) || VALLEY_DIR;
            }

            // Check if path is allowed
            if (!isPathAllowed(filePath)) {
              return {
                decision: "block",
                reason: `Access denied: ${toolName} can only access files within ${VALLEY_DIR}. Requested path: ${filePath}`,
              };
            }

            return { decision: "approve" };
          },
        ],
      },
      // Hook for Bash commands
      {
        matcher: "Bash",
        hooks: [
          async (input: { tool_name: string; tool_input: Record<string, unknown> }): Promise<HookJSONOutput> => {
            const command = (input.tool_input.command as string) || "";

            // List of potentially dangerous patterns that could access outside VALLEY_DIR
            const dangerousPatterns = [
              /\bcd\s+[^~]/, // cd to non-home directory (but allow cd ~/.valley)
              /\bcd\s+~(?!\/\.valley)/, // cd to home but not .valley
              /\bcd\s+\/(?!Users|home)/, // cd to absolute path
              /\brm\s+-rf?\s+\//, // rm on root paths
              /\bsudo\b/, // sudo commands
              /\bchmod\b/, // chmod commands
              /\bchown\b/, // chown commands
              /\bmkdir\s+-p?\s+\//, // mkdir on root paths
              />\s*\/(?!Users)/, // redirect to root paths
              /\bcat\s+\/(?!Users)/, // cat from root paths
              /\bcp\s+.*\s+\/(?!Users)/, // cp to root paths
              /\bmv\s+.*\s+\/(?!Users)/, // mv to root paths
            ];

            // Check for dangerous patterns
            for (const pattern of dangerousPatterns) {
              if (pattern.test(command)) {
                // Allow if the command explicitly references VALLEY_DIR
                if (command.includes(".valley") || command.includes(VALLEY_DIR)) {
                  continue;
                }
                return {
                  decision: "block",
                  reason: `Access denied: Bash commands are restricted to ${VALLEY_DIR}. The command appears to access paths outside the allowed directory.`,
                };
              }
            }

            // Check for absolute paths in the command that are outside VALLEY_DIR
            const absolutePathMatch = command.match(/(?:^|\s)(\/[^\s]+)/g);
            if (absolutePathMatch) {
              for (const match of absolutePathMatch) {
                const absPath = match.trim();
                // Allow paths that are within VALLEY_DIR or common safe paths
                if (
                  !absPath.startsWith(VALLEY_DIR) &&
                  !absPath.startsWith("/usr/bin") &&
                  !absPath.startsWith("/bin") &&
                  !absPath.startsWith("/tmp") &&
                  !absPath.startsWith("/dev/null")
                ) {
                  return {
                    decision: "block",
                    reason: `Access denied: Bash commands cannot access ${absPath}. Only paths within ${VALLEY_DIR} are allowed.`,
                  };
                }
              }
            }

            return { decision: "approve" };
          },
        ],
      },
    ],
  };
}

export class AIClient {
  private defaultOptions: AIQueryOptions;

  constructor(options?: Partial<AIQueryOptions>) {
    // Find Claude CLI path
    const claudeCliPath = findClaudeCli();
    if (!claudeCliPath) {
      console.warn("Warning: Claude CLI not found. AI queries may fail.");
    } else {
      console.log(`Using Claude CLI at: ${claudeCliPath}`);
    }

    this.defaultOptions = {
      maxTurns: 100,
      cwd: VALLEY_DIR,
      model: "sonnet",
      pathToClaudeCodeExecutable: claudeCliPath,
      allowedTools: [
        "Task",
        "Bash",
        "Glob",
        "Grep",
        "Read",
        "Edit",
        "Write",
        "WebFetch",
        "WebSearch",
      ],
      settingSources: ["project"],
      hooks: createSandboxHooks(),
      appendSystemPrompt: `
IMPORTANT: You are running in a sandboxed environment.
- Your workspace is: ${VALLEY_DIR}
- You can ONLY access files within this directory
- Any attempt to read, write, or execute commands outside this directory will be blocked
- All file paths should be relative to ${VALLEY_DIR} or absolute paths within it
`,
      ...options,
    };
  }

  async *queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<AIQueryOptions>
  ): AsyncIterable<SDKMessage> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const abortSignal = options?.abortSignal;

    for await (const message of query({
      prompt,
      options: mergedOptions,
    })) {
      // Check if aborted
      if (abortSignal?.aborted) {
        throw new Error("Query aborted");
      }
      yield message;
    }
  }

  async querySingle(
    prompt: string,
    options?: Partial<AIQueryOptions>
  ): Promise<{
    messages: SDKMessage[];
    cost: number;
    duration: number;
    sessionId: string | null;
  }> {
    const messages: SDKMessage[] = [];
    let totalCost = 0;
    let duration = 0;
    let sessionId: string | null = null;

    for await (const message of this.queryStream(prompt, options)) {
      messages.push(message);

      // Capture session ID from init message
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      }

      if (message.type === "result" && message.subtype === "success") {
        totalCost = message.total_cost_usd;
        duration = message.duration_ms;
      }
    }

    return { messages, cost: totalCost, duration, sessionId };
  }
}
