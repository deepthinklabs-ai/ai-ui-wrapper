# Claude Code Bridge - Setup & Testing Guide

This guide will help you connect your web GUI to the real Claude Code CLI using the local bridge service.

## Architecture Overview

```
┌─────────────────┐
│   Web Browser   │
│   (Terminal)    │
└────────┬────────┘
         │ HTTP/WebSocket
         │ (localhost:3001)
         │
┌────────▼─────────────┐
│  Bridge Server       │
│  (Node.js/Express)   │
│  Port: 3001          │
└────────┬─────────────┘
         │ spawn()
         │ stdin/stdout
         │
┌────────▼─────────────┐
│   Claude Code CLI    │
│  (Child Process)     │
└──────────────────────┘
```

## Prerequisites

1. **Claude Code installed** - You need the Claude Code CLI installed on your machine
2. **Node.js** - Version 18 or higher
3. **Modern browser** - Chrome or Edge (for File System Access API)

## Step-by-Step Setup

### 1. Configure the Bridge

Navigate to the bridge directory and create a `.env` file:

```bash
cd claude-code-bridge
cp .env.example .env
```

Edit `.env`:

```env
# Path to Claude Code executable
# If 'claude' is in your PATH, just use 'claude'
# Otherwise, provide the full path
CLAUDE_CODE_PATH=claude

# Optional: Working directory
CLAUDE_CODE_WORKDIR=C:\dev\ai-ui-wrapper\apps\web

# Server port
PORT=3001
```

### 2. Install Bridge Dependencies

```bash
cd claude-code-bridge
npm install
```

### 3. Start the Bridge Server

**In a new terminal window:**

```bash
cd claude-code-bridge
npm run dev
```

You should see:

```
🌉 Claude Code Bridge Server
==============================================
HTTP API: http://localhost:3001
WebSocket: ws://localhost:3001

Configuration:
  Command: claude
  Working Dir: C:\dev\ai-ui-wrapper\apps\web
==============================================
```

### 4. Start the Web Application

**In another terminal window:**

```bash
# Make sure you're in the web app directory
npm run dev
```

### 5. Connect from the Web GUI

1. Open http://localhost:3000 in your browser
2. Navigate to **Terminal Bot Command** page
3. Look for the **Bridge Mode Controls** panel
4. Toggle the switch to enable **Bridge Mode**
5. Click **"Connect to Bridge"**
6. You should see a green "Connected" indicator

## Testing the Connection

### Test 1: Basic Message

1. In the Terminal Bot interface, type: `Hello! Are you real Claude Code?`
2. Send the message
3. You should receive a response from the actual Claude Code CLI

### Test 2: File Operations

1. Connect a project directory using the "Connect Directory" button
2. Ask Claude Code to: `List the files in this project`
3. Claude Code should be able to see and read your project files

### Test 3: Code Writing

Ask Claude Code to create a simple file:

```
Create a new file called test.js with a simple hello world function
```

Claude Code should create the file in your project directory.

## Troubleshooting

### Issue: Bridge server won't start

**Symptoms:**
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
cd claude-code-bridge
npm install
```

---

### Issue: "Failed to connect to bridge"

**Symptoms:**
- Red "Disconnected" indicator
- Alert: "Bridge server is not running"

**Solution:**
1. Make sure the bridge is running: `cd claude-code-bridge && npm run dev`
2. Check that port 3001 is not being used by another process
3. Check the bridge terminal for errors

---

### Issue: "Command not found: claude"

**Symptoms:**
- Bridge starts but crashes immediately
- Bridge logs show: `spawn claude ENOENT`

**Solution:**
Set the full path to Claude Code in `.env`:
```env
CLAUDE_CODE_PATH=C:\Users\YourName\AppData\Local\Programs\claude-code\claude.exe
```

Or add Claude Code to your PATH.

---

### Issue: No response from Claude Code

**Symptoms:**
- Message sent but no response
- Loading indicator keeps spinning

**Solution:**
1. Check the bridge terminal for logs
2. Try sending a simpler message like "hello"
3. Claude Code might be waiting for input - check the bridge logs
4. Restart the bridge server

---

### Issue: WebSocket connection fails

**Symptoms:**
- Browser console shows WebSocket errors
- Can't connect to bridge

**Solution:**
1. Make sure bridge is running on port 3001
2. Check firewall settings
3. Try connecting to http://localhost:3001/health in your browser

---

### Issue: CORS errors

**Symptoms:**
- Browser console shows CORS errors
- Requests blocked by CORS policy

**Solution:**
The bridge has CORS enabled by default. If still seeing errors:
- Make sure bridge is running
- Clear browser cache
- Restart both servers

## Advanced Configuration

### Using a Different Port

Edit `claude-code-bridge/.env`:
```env
PORT=3002
```

And update the client in `src/lib/claudeCodeBridgeClient.ts`:
```typescript
this.baseUrl = config.baseUrl || 'http://localhost:3002';
this.wsUrl = config.wsUrl || 'ws://localhost:3002';
```

### Running in Production

```bash
cd claude-code-bridge
npm run build
npm start
```

### Multiple Users

Currently, the bridge supports one Claude Code instance at a time. For multiple users:

1. Run multiple bridge instances on different ports
2. Route users to different bridges
3. Or implement session management in the bridge

## Architecture Notes

### How It Works

1. **Web GUI** sends HTTP POST to `/message` endpoint
2. **Bridge Server** receives message and writes to Claude Code's stdin
3. **Claude Code** processes the message
4. **Bridge Server** captures stdout/stderr
5. **WebSocket** streams output back to the web GUI in real-time
6. **Web GUI** displays the response

### Why WebSocket?

- Real-time streaming of Claude Code output
- Low latency
- Bidirectional communication
- Connection state management

### Security Considerations

⚠️ **Important:** This bridge runs on localhost only. Do NOT expose it to the internet without:

1. Authentication (API keys, OAuth, etc.)
2. Rate limiting
3. Input sanitization
4. Process isolation
5. HTTPS/WSS

## Next Steps

1. ✅ Test basic messaging
2. ✅ Test file operations
3. ✅ Test code generation
4. 🔄 Add authentication
5. 🔄 Add session persistence
6. 🔄 Add multi-user support
7. 🔄 Add better error handling
8. 🔄 Add response streaming in UI

## Support

If you encounter issues:

1. Check the bridge terminal logs
2. Check the browser console
3. Check that Claude Code works independently: `claude --help`
4. Review the [Claude Code documentation](https://docs.anthropic.com/claude/docs/claude-code)

## File Locations

- Bridge server: `claude-code-bridge/`
- Bridge client: `src/lib/claudeCodeBridgeClient.ts`
- Bridge hook: `src/hooks/useClaudeCodeBridge.ts`
- Terminal UI: `src/components/terminal/TerminalPanel.tsx`
