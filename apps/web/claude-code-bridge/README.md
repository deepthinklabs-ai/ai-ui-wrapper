# Claude Code Bridge

A local bridge service that connects your web GUI with the real Claude Code CLI.

## How It Works

```
Web GUI → HTTP/WebSocket → Bridge Server → Claude Code Process (stdin/stdout)
```

The bridge:
1. Spawns Claude Code as a child process
2. Exposes HTTP API for sending messages
3. Uses WebSocket for real-time streaming responses
4. Captures stdout/stderr from Claude Code
5. Relays everything back to the web GUI

## Setup

### 1. Install Dependencies

```bash
cd claude-code-bridge
npm install
```

### 2. Configure Environment

Create a `.env` file:

```env
# Path to Claude Code executable
CLAUDE_CODE_PATH=claude

# Additional arguments (optional)
CLAUDE_CODE_ARGS=

# Working directory (optional, defaults to current directory)
CLAUDE_CODE_WORKDIR=/path/to/your/project

# Server port
PORT=3001
```

### 3. Run the Bridge

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## API Endpoints

### HTTP API

- `GET /health` - Health check
- `GET /session` - Get current session info
- `POST /start` - Start Claude Code process
- `POST /stop` - Stop Claude Code process
- `POST /message` - Send message to Claude Code
  ```json
  {
    "id": "msg-123",
    "content": "Your message here"
  }
  ```
- `GET /buffer` - Get current output buffer

### WebSocket

Connect to `ws://localhost:3001` for real-time updates:

**Events:**
- `session-info` - Initial session information
- `output` - Claude Code stdout output
- `error` - Claude Code stderr output
- `response-complete` - Message response completed
- `exit` - Claude Code process exited

## Usage with Web GUI

The web GUI will automatically connect to the bridge at `http://localhost:3001` when you:

1. Navigate to the Terminal Bot page
2. Enable "Connect to Local Claude Code" in settings
3. Send messages through the Terminal interface

## Testing

Test the bridge manually:

```bash
# Start the bridge
npm run dev

# In another terminal, test with curl:
curl -X POST http://localhost:3001/start

curl -X POST http://localhost:3001/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello Claude Code!"}'

curl http://localhost:3001/buffer
```

## Troubleshooting

**Issue:** Bridge can't find Claude Code
- **Solution:** Set `CLAUDE_CODE_PATH` to the full path to the claude executable

**Issue:** No output from Claude Code
- **Solution:** Claude Code might not be running interactively. Check the process logs.

**Issue:** WebSocket connection fails
- **Solution:** Make sure the bridge is running and accessible at localhost:3001

**Issue:** Timeout waiting for response
- **Solution:** Claude Code might be waiting for input or processing. Check the buffer endpoint.

## Architecture

```
┌─────────────┐
│  Web GUI    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP/WebSocket
       │
┌──────▼──────────────┐
│  Bridge Server      │
│  - Express HTTP     │
│  - WebSocket        │
│  - Process Manager  │
└──────┬──────────────┘
       │ spawn()
       │ stdin/stdout
       │
┌──────▼──────────────┐
│  Claude Code CLI    │
│  (Child Process)    │
└─────────────────────┘
```

## Next Steps

1. Update the web GUI's Terminal Bot to use this bridge
2. Add authentication/security if exposing beyond localhost
3. Add session persistence
4. Add multi-user support with separate Claude Code instances
