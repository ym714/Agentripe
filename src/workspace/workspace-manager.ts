import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ScheduledTask } from "../types";

const VALLEY_DIR = path.join(os.homedir(), ".valley");
const CLAUDE_DIR = path.join(VALLEY_DIR, ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const LOGS_DIR = path.join(VALLEY_DIR, "logs");
const SESSIONS_DIR = path.join(LOGS_DIR, "sessions");
const SCHEDULER_FILE = path.join(VALLEY_DIR, "scheduler.json");

export interface SkillInfo {
  name: string;
  filename: string;
  content: string;
  createdAt: string;
  modifiedAt: string;
}

const DEFAULT_CLAUDE_MD = `# Valley Agent Workspace

This is the Valley Agent workspace. Claude Code will use this directory as the working directory.

## Guidelines

- You are an AI assistant helping with various tasks
- Use the tools available to you to accomplish the user's goals
- Be concise and helpful in your responses

## Custom Instructions

Add your custom instructions here to customize how the agent behaves.
`;

const DEFAULT_SETTINGS = {
  permissions: {
    allow: ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "WebFetch", "WebSearch", "Task"],
    deny: []
  }
};

export class WorkspaceManager {
  private static instance: WorkspaceManager;

  private constructor() {}

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * Initialize the ~/.valley/ workspace
   */
  async initialize(): Promise<void> {
    // Create main directories
    await this.ensureDir(VALLEY_DIR);
    await this.ensureDir(CLAUDE_DIR);
    await this.ensureDir(LOGS_DIR);
    await this.ensureDir(SESSIONS_DIR);
    await this.ensureDir(path.join(CLAUDE_DIR, "skills"));

    // Create default CLAUDE.md if it doesn't exist
    const claudeMdPath = path.join(VALLEY_DIR, "CLAUDE.md");
    if (!fs.existsSync(claudeMdPath)) {
      await Bun.write(claudeMdPath, DEFAULT_CLAUDE_MD);
      console.log(`Created default CLAUDE.md at ${claudeMdPath}`);
    }

    // Create default settings.json if it doesn't exist
    const settingsPath = path.join(CLAUDE_DIR, "settings.json");
    if (!fs.existsSync(settingsPath)) {
      await Bun.write(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      console.log(`Created default settings.json at ${settingsPath}`);
    }

    console.log(`Workspace initialized at ${VALLEY_DIR}`);
  }

  /**
   * Get the valley workspace directory
   */
  getWorkspaceDir(): string {
    return VALLEY_DIR;
  }

  /**
   * Get the sessions log directory
   */
  getSessionsDir(): string {
    return SESSIONS_DIR;
  }

  /**
   * List all session log files
   */
  async listSessionLogs(): Promise<string[]> {
    try {
      const files = fs.readdirSync(SESSIONS_DIR);
      return files
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => f.replace(".jsonl", ""))
        .sort((a, b) => b.localeCompare(a)); // Newest first
    } catch {
      return [];
    }
  }

  // ==================== CLAUDE.md Management ====================

  /**
   * Get the CLAUDE.md content
   */
  async getClaudeMd(): Promise<string> {
    const claudeMdPath = path.join(VALLEY_DIR, "CLAUDE.md");
    try {
      return await Bun.file(claudeMdPath).text();
    } catch {
      return DEFAULT_CLAUDE_MD;
    }
  }

  /**
   * Update the CLAUDE.md content
   */
  async setClaudeMd(content: string): Promise<void> {
    const claudeMdPath = path.join(VALLEY_DIR, "CLAUDE.md");
    await Bun.write(claudeMdPath, content);
  }

  // ==================== Skills Management ====================

  /**
   * List all skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    try {
      const files = fs.readdirSync(SKILLS_DIR);
      const skills: SkillInfo[] = [];

      for (const filename of files) {
        if (filename.endsWith(".md")) {
          const filePath = path.join(SKILLS_DIR, filename);
          const stat = fs.statSync(filePath);
          const content = await Bun.file(filePath).text();

          skills.push({
            name: filename.replace(".md", ""),
            filename,
            content,
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }

      return skills.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  /**
   * Get a single skill by name
   */
  async getSkill(name: string): Promise<SkillInfo | null> {
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    const filePath = path.join(SKILLS_DIR, filename);

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stat = fs.statSync(filePath);
      const content = await Bun.file(filePath).text();

      return {
        name: filename.replace(".md", ""),
        filename,
        content,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Create or update a skill
   */
  async saveSkill(name: string, content: string): Promise<SkillInfo> {
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    const filePath = path.join(SKILLS_DIR, filename);

    await this.ensureDir(SKILLS_DIR);
    await Bun.write(filePath, content);

    const stat = fs.statSync(filePath);

    return {
      name: filename.replace(".md", ""),
      filename,
      content,
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    };
  }

  /**
   * Delete a skill
   */
  async deleteSkill(name: string): Promise<boolean> {
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    const filePath = path.join(SKILLS_DIR, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ==================== Scheduler Management ====================

  /**
   * Load scheduled tasks from file
   */
  async loadScheduledTasks(): Promise<ScheduledTask[]> {
    try {
      if (!fs.existsSync(SCHEDULER_FILE)) {
        return [];
      }
      const content = await Bun.file(SCHEDULER_FILE).text();
      const data = JSON.parse(content);
      return data.tasks || [];
    } catch (error) {
      console.error("Error loading scheduled tasks:", error);
      return [];
    }
  }

  /**
   * Save scheduled tasks to file
   */
  async saveScheduledTasks(tasks: ScheduledTask[]): Promise<void> {
    const data = {
      version: 1,
      tasks,
      updatedAt: new Date().toISOString(),
    };
    await Bun.write(SCHEDULER_FILE, JSON.stringify(data, null, 2));
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
