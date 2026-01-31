# Valley Agent

AI Agent Server with Web UI, Scheduler, and Claude Code Integration.

## Prerequisites

- [Bun](https://bun.sh) runtime (required)
- Node.js 18+ (for npx)
- Anthropic API key (set as `ANTHROPIC_API_KEY` environment variable)

## Installation

### Using npx (recommended)

```bash
npx valley-agent
```

### Global Installation

```bash
npm install -g valley-agent
valley-agent
```

## Usage

```bash
# Start with default port (3000)
npx valley-agent

# Start with custom port
npx valley-agent --port 8080

# Show help
npx valley-agent --help
```

## Features

### Web UI

Access the web interface at `http://localhost:8453`:

- **Chat**: Interactive chat with AI agent
- **Sessions**: Manage multiple conversation sessions
- **Settings**: Configure CLAUDE.md and skills
- **Scheduler**: Create and manage scheduled tasks

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions/:id/stop` | Stop running session |
| GET | `/api/scheduler/tasks` | List scheduled tasks |
| POST | `/api/scheduler/tasks` | Create task |

## Workspace

All data is stored in `~/.valley/`:

```
~/.valley/
├── CLAUDE.md          # Agent instructions
├── scheduler.json     # Scheduled tasks
└── .claude/
    └── skills/        # Custom skills
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `VALLEY_AGENT_PORT` | Server port | 3000 |

## License

MIT
