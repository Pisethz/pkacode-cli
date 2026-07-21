# PKA CODE — Free AI Coding Assistant (CLI + Web)

<p align="center">
  <strong>FREE multi-provider AI coding assistant — works in your terminal AND browser</strong>
</p>

<p align="center">
  <a href="https://github.com/Pisethz/pkacode-cli"><img src="https://img.shields.io/badge/GitHub-Pisethz%2Fpkacode--cli-blue?logo=github" alt="GitHub"></a>
  <a href="https://www.npmjs.com/package/pkacode-cli"><img src="https://img.shields.io/badge/npm-pkacode--cli-red?logo=npm" alt="npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blueviolet" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node">
  <img src="https://img.shields.io/badge/web-pkacodeweb-orange" alt="Web">
</p>

```bash
npm install -g pkacode-cli    # Install globally
pkacode                        # Start CLI interactive mode
pkacodeweb                      # Start Web Chat in your browser
```

```
█████▀█████ ████ ████ ████▀████      ████▀████ ▄███▀███▄ ████▀███▄ ████▀████
█████ █████ ████ ████ ████ ████      ████ ████ ████ ████ ████ ████ ████ ████
█████ █████ ████▄███▄ ████ ████      ████ ▀▀▀▀ ████ ████ ████ ████ ████ ▀▀▀▀
█████▄█████ ████ ████ ████ ████      ████      ████ ████ ████ ████ ████▀▀   
█████       ████ ████ ████▀████      ████▄████ ▀███▄███▀ ████▄███▀ ████▄████
```

**PKA CODE** is a **free, open-source** AI coding assistant that runs in your terminal **and browser**. It can read, write, and edit files, execute commands, search your codebase, and hold multi-turn conversations — all powered by your choice of **FREE AI providers** (Gemini, Groq, OpenRouter, DeepSeek).

> ⚡ No paid APIs required. No subscriptions. Just code with AI.

---

## System Requirements

### All Platforms

| Requirement | Version |
|-------------|---------|
| **Node.js** | ≥ 18.0.0 (LTS recommended) |
| **npm** | ≥ 8.0.0 (comes with Node.js) |
| **Terminal** | ANSI color support (all modern terminals) |

### Windows

| Requirement | Notes |
|-------------|-------|
| **OS** | Windows 10 or later |
| **Terminal** | Windows Terminal (recommended), VS Code terminal, PowerShell 5+, or Cmd |
| **Clipboard** | Built-in (`clip` command — included with Windows) |
| **Browser** | Chrome, Edge, or Firefox (for API key login) |
| **Shell** | `cmd.exe` (default) or PowerShell |
| **File search** | Built-in (`dir` + Node.js fallback) |
| **Config path** | `%APPDATA%\pka\config.json` |

> ✅ **No additional dependencies required.** Everything works out of the box on Windows 10+.
> 💡 For the best experience, install [Windows Terminal](https://apps.microsoft.com/detail/9n0dx20hk701) from the Microsoft Store.

### Linux

| Requirement | Notes |
|-------------|-------|
| **OS** | Any modern distribution (Ubuntu 20.04+, Fedora 38+, Arch, etc.) |
| **Terminal** | GNOME Terminal, Konsole, Kitty, Alacritty, or any modern terminal emulator |
| **Clipboard** | Install one of: `xclip`, `xsel`, or `wl-clipboard` |
| **Browser** | Chrome, Chromium, or Firefox (for API key login) |
| **Shell** | `/bin/sh` (default) |
| **File search** | `find` (built-in) + Node.js fallback |
| **Config path** | `~/.config/pka/config.json` |

```bash
# Clipboard tool (required for auto-detecting API keys)
# X11 (most distributions):
sudo apt install xclip                  # Debian / Ubuntu / Mint
sudo dnf install xclip                  # Fedora
sudo pacman -S xclip                    # Arch / Manjaro

# Wayland:
sudo apt install wl-clipboard           # Debian / Ubuntu / Mint
sudo dnf install wl-clipboard           # Fedora
sudo pacman -S wl-clipboard             # Arch / Manjaro
```

> ⚠️ **Without a clipboard tool**, you'll see repeated `xsel: not found` messages during login. You can still paste your API key manually when prompted.

### macOS

| Requirement | Notes |
|-------------|-------|
| **OS** | macOS 12 (Monterey) or later (Intel & Apple Silicon) |
| **Terminal** | Terminal.app, iTerm2, Warp, or VS Code terminal |
| **Clipboard** | Built-in (`pbcopy` / `pbpaste` — included with macOS) |
| **Browser** | Safari, Chrome, or Firefox (for API key login) |
| **Shell** | `/bin/sh` or `/bin/zsh` (default) |
| **File search** | `find` (built-in) + Node.js fallback |
| **Config path** | `~/.config/pka/config.json` |

> ✅ **No additional dependencies required.** Everything works out of the box on macOS.

---

## Cross-Platform Compatibility

PKA CODE runs on **all major operating systems**:

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows 10+** | ✅ Supported | Windows Terminal, VS Code terminal, PowerShell, Cmd |
| **Linux** | ✅ Supported | All distributions with Node.js ≥ 18 |
| **macOS** | ✅ Supported | Intel and Apple Silicon |

### Platform-Specific Features

| Feature | Windows | Linux | macOS |
|---------|---------|-------|-------|
| **Config directory** | `%APPDATA%\pka` | `~/.config/pka` | `~/.config/pka` |
| **Browser open** | `start` | `xdg-open` | `open` |
| **Clipboard read** | PowerShell | `xclip` / `xsel` / `wl-paste` | `pbpaste` |
| **Shell runner** | `cmd.exe` | `/bin/sh` | `/bin/sh` |
| **ANSI colors** | ✅ Full (chalk) | ✅ Full | ✅ Full |
| **File search** | `dir` + Node.js fallback | `find` + Node.js fallback | `find` + Node.js fallback |

> **💡 Linux clipboard auto-detect:** To use clipboard-based key login on Linux, install one of:
> ```bash
> sudo apt install xclip          # X11 (Debian/Ubuntu)
> sudo apt install wl-clipboard   # Wayland (Debian/Ubuntu)
> sudo dnf install xclip          # X11 (Fedora)
> sudo pacman -S xclip            # X11 (Arch)
> ```
> If none are installed, you'll see repeated `xsel: not found` messages — just paste the key manually when prompted instead.

---

## Features

- **🌐 2 Interfaces** — Terminal CLI (`pkacode`) and Web Chat (`pkacodeweb`)
- **🤖 4 FREE AI Providers** — DeepSeek · Gemini · Groq · OpenRouter (free models only)
- **🎨 Theme System** — Switch between Dark (`🌙`) and Light (`☀️`) themes
  - Dark mode: white AI response bg with black text
  - Light mode: dark gray AI response bg with white text
  - Full-width background spans the entire terminal row
  - 6-character left margin for visual clarity
- **💬 Interactive Chat** — Context-aware conversations with streaming responses
- **📁 File Operations** — Read, write, edit, and delete files in your project
- **⚡ Command Execution** — Run terminal commands and see results
- **🔍 Code Search** — Find files by glob patterns
- **📝 Session Management** — Save, resume, and manage chat sessions
- **🔑 Interactive Permissions** — Control AI safety modes
- **💡 Autocomplete Popup** — Type `/` to see available commands
- **🔄 Multi-turn Conversations** — Maintains context across exchanges
- **📝 Single-prompt Mode** — Ask one-off questions with `-p`
- **🔑 Token Tracking** — See usage stats per session with `/tokens`
- **📋 Multi-line Input** — `/multiline` for long prompts

---

## Quick Start

### Terminal CLI

```bash
# 1. Install globally
npm install -g pkacode-cli

# 2. Start interactive mode
pkacode

# 3. Or ask a single question
pkacode -p "read package.json and explain it"
```

### Web Chat (pkacodeweb)

```bash
# 1. Install (if not done already)
npm install -g pkacode-cli

# 2. Launch the Web Chat server
pkacodeweb
```

Your browser opens at **http://localhost:3721/chat** — start chatting with DeepSeek V4 Flash instantly, no API key needed.

---

## Web Chat — `pkacodeweb`

The `pkacodeweb` command launches a **browser-based AI chat** interface. One command, instant access.

```bash
# Start the Web Chat server (browser opens automatically)
pkacodeweb

# Server starts on port 3721
# Open: http://localhost:3721/chat
```

### How It Works

| Step | Action |
|------|--------|
| 1 | Run `pkacodeweb` in your terminal |
| 2 | Express.js server starts on **port 3721** |
| 3 | Browser opens to **http://localhost:3721/chat** |
| 4 | Chat instantly with **DeepSeek V4 Flash** — no API key needed |
| 5 | Or add your own API key in Settings for unlimited access |

### Instant Mode (No API Key)

- Chat instantly with up to **20 messages per hour**
- Uses the server's built-in API key (OpenRouter → DeepSeek V4 Flash)
- No signup, no credit card required
- Perfect for quick questions and exploration

### Unlimited Mode (Your API Key)

- Add your own **OpenRouter**, **Gemini**, or **Groq** API key in Settings
- No rate limits — use as much as you want
- Keys stored securely in your browser's localStorage
- Switch between providers on-the-fly from the dropdown

### Web Chat Features

- **Real-time Streaming** — SSE word-by-word responses
- **Provider Switching** — Gemini, Groq, OpenRouter, DeepSeek
- **Model Selection** — Pick any model from the dropdown
- **Session Saving** — Conversations auto-save to the sidebar
- **Settings Panel** — API keys, system prompt, temperature, max tokens
- **Mobile-Responsive** — Touch support, bottom nav, slide-out sidebar
- **Dark/Light Theme** — Matches your system preference

### Manual Server Start

If you have the source code (from `server/` folder):

```bash
cd server
npm install
node index.js
```

Then open **http://localhost:3721/chat** in your browser.

### Phone / Tablet Access

The server broadcasts on your local network:
```
http://<your-ip>:3721/chat
```
Both devices must be on the same WiFi.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/config` | GET/POST | Read/update configuration |
| `/api/providers` | GET | List AI providers and models |
| `/api/chat` | POST | Streaming chat (SSE) |
| `/api/sessions` | GET/POST | List/save sessions |
| `/api/sessions/:id` | GET/DELETE | Load/delete a session |

### Vercel Deployment

The `api/` folder contains serverless functions for Vercel:
```bash
vercel
```

---

### Theme Switching

```bash
# Toggle between dark and light theme
pkacode theme
pkacode theme dark
pkacode theme light

# Or inside chat:
/theme
/theme dark
/theme light
```

### Choose Your FREE Provider

| Provider | Free Tier | Get API Key |
|----------|-----------|-------------|
| **Gemini** | ✅ Free (60 req/min) | [Google AI Studio](https://aistudio.google.com/apikey) |
| **Groq** | ✅ Free tier (30 req/min) | [Groq Console](https://console.groq.com/keys) |
| **OpenRouter** | ✅ 20+ free models | [OpenRouter](https://openrouter.ai/keys) |

```bash
# Set your API key (choose one provider)
pkacode auth login gemini
pkacode auth login groq
pkacode auth login openrouter

# Switch providers anytime
pkacode provider set gemini
pkacode provider set groq
pkacode provider set openrouter
```

### Available Free Models

<details>
<summary><b>Gemini</b> (5 free models)</summary>

| Model | Description |
|-------|-------------|
| `gemini-2.0-flash` | Best free default — vision |
| `gemini-2.5-flash` | Newer, smarter, 1M context |
| `gemini-2.5-flash-lite` | Lowest latency, highest quota |
| `gemini-3.1-flash-lite` | Newest, most cost-efficient |
| `gemini-2.0-flash-lite` | Lightweight, fast responses |

</details>

<details>
<summary><b>Groq</b> (6 free models)</summary>

| Model | Description |
|-------|-------------|
| `llama-3.3-70b-versatile` | Strong general purpose |
| `llama-3.1-70b-versatile` | Older but capable |
| `llama-3.1-8b-instant` | Fastest, lightweight |
| `mixtral-8x7b-32768` | MoE — strong reasoning |
| `gemma2-9b-it` | Google — balanced & fast |
| `qwen/qwen3-32b` | Coding & math focused |

</details>

<details>
<summary><b>OpenRouter</b> (10 free models with `:free` suffix)</summary>

| Model | Description |
|-------|-------------|
| `openrouter/free` | Auto router — picks the best free model |
| `google/gemini-2.0-flash-exp:free` | Fast, vision-capable |
| `google/gemini-2.5-flash-exp:free` | Newer, smarter Gemini |
| `meta-llama/llama-3.3-70b-instruct:free` | Strong general purpose |
| `meta-llama/llama-3.1-8b-instruct:free` | Fast & lightweight |
| `mistralai/mistral-nemo:free` | Balanced performer |
| `qwen/qwen-2.5-coder-32b-instruct:free` | Best for coding |
| `deepseek/deepseek-chat:free` | Strong reasoning |
| `microsoft/phi-3-medium:free` | Compact & capable |
| `cohere/command-r:free` | Retrieval-focused |

</details>

> OpenRouter also auto-discovers new `:free` models via its API — the live list may have more than what's shown here.

---

## Interactive Mode

Run `pkacode` to start. The startup panel shows:

```
┏━ PKA CODE v1.2.2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                          ┃
┃  [BrainDmg 3D ASCII Logo]                                ┃
┃                                                          ┃
┃  GETTING STARTED              WHAT'S NEW                 ┃
┃  ───────────────              ───────────────            ┃
┃  Just describe what you want:  /theme — Switch theme     ┃
┃  "Build a todo app..."        /session — View session    ┃
┃  "Explain this function"      /new — Create new session  ┃
┃  "Run npm test"               /resume — Interactive pick ┃
┃                                                          ┃
┃  /session  Show session info   QUICK ACTIONS             ┃
┃  /new      Start fresh session /new    fresh session     ┃
┃  /resume   Pick a session      /resume pick saved session┃
┃  /permissions Change mode      /permissions change mode  ┃
┃  /help     Show all commands   /info   session overview  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌── gemini-2.0-flash ──────────────────────────────────────┐
│  > Ask PKA to build, edit, or run something…             │
└──────────────────────────────────────────────────────────┘
```

The input box at the bottom is **always visible** with a bordered frame showing the current model name. Type `/` to see the autocomplete popup with available commands.

---

## In-Chat Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `/theme` | — | Switch color theme (dark/light) |
| `/session` | `/info` | Show current session ID, model, turns, tokens |
| `/new` | — | Start a fresh session (saves current) |
| `/resume` | — | Interactive picker to continue a saved session |
| `/sessions` | — | List all saved sessions |
| `/permissions` | `/perm` | View & change permission mode interactively |
| `/exit` | `/quit` | Exit the assistant |
| `/clear` | — | Clear conversation history |
| `/help` | — | Show help |
| `/commands` | — | Show all PKA CLI commands |
| `/model` | — | Show or switch active model |
| `/models` | — | List available models for active provider |
| `/provider` | — | Show or switch AI provider |
| `/auth` | — | Login/logout from providers |
| `/tokens` | — | Show token usage this session |
| `/config` | — | Show current configuration |
| `/reset` | — | Reset configuration to defaults |
| `/sandbox` | — | Toggle sandbox preference |
| `/multiline` | — | Enter multi-line input mode |

### Running CLI Commands In-Chat

Prefix any CLI command with `/pka`:

```
/pka auth login gemini
/pka models list --provider groq
/pka provider set openrouter
/pka model set gemini-2.0-flash
/pka sessions list
/pka permissions reset
/pka theme dark
```

---

## Permission Modes

Control what the AI can do automatically:

| Mode | Behavior |
|------|----------|
| **default** | Read-only auto, edits & bash ask you |
| **auto-edit** | Read/write/edit auto, bash asks you |
| **plan** | Read-only only — no edits, no bash |
| **yolo** | Everything automatic — no prompts |

```bash
# Via CLI flag (per session)
pkacode --permission-mode auto-edit

# Via config (persistent)
pkacode config set permissionMode auto-edit

# Interactive mode selector (in chat)
/permissions

# View rules file (Unix)
cat ~/.config/pka/permissions.json

# View rules file (Windows)
type %APPDATA%\pka\permissions.json
```

---

## CLI Options

```bash
pkacode                              # Interactive chat mode
pkacode "your prompt"                # Single-prompt mode
pkacode -p "prompt"                  # Headless print mode
pkacodeweb                            # Start Web Chat server (opens browser)
pkacode --help                       # Show help
pkacode --version                    # Show version
pkacode theme [dark|light]           # Switch color theme
pkacode auth login <provider>        # Set API key
pkacode provider set <name>          # Switch provider
pkacode model set <name>             # Switch model
pkacode models list                  # List all models
pkacode config                       # Show config
pkacode config set permissionMode    # Set permission mode
pkacode permissions                  # Show permission rules
pkacode permissions reset            # Reset to defaults
pkacode sessions list                # List saved sessions
pkacode resume [session]             # Resume a session
```

---

## Configuration

Config is stored at:
- **Windows**: `%APPDATA%\pka\config.json`
- **Linux / macOS**: `~/.config/pka/config.json`

```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash",
  "apiKeys": {
    "gemini": "AIzaSy...",
    "groq": "gsk_...",
    "openrouter": "sk-or-..."
  },
  "permissionMode": "default",
  "enabledTools": ["bash", "fs"],
  "sandbox": false,
  "maxTokens": 4096,
  "temperature": 0.3,
  "stream": true
}
```

---

## Development

```bash
# Clone
git clone https://github.com/Pisethz/pkacode-cli.git
cd pkacode-cli

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link globally for testing
npm link
pkacode    # Now runs your local build

# Dev mode with hot reload
npm run dev
```

---

## Project Structure

```
src/
├── index.ts              # Entry point
├── cli/
│   ├── program.ts        # Commander CLI setup
│   └── help.ts           # Help text
├── chat/
│   ├── interactive.ts    # Interactive chat loop + slash commands
│   ├── conversation.ts   # Conversation manager
│   └── options.ts        # Session options types
├── commands/
│   ├── auth.ts           # Auth commands
│   ├── catalog.ts        # Command catalog
│   ├── chat.ts           # Chat dispatch
│   ├── config.ts         # Config commands
│   ├── dispatch.ts       # /pka command dispatcher
│   ├── models.ts         # Model management
│   ├── permissions.ts    # Permissions command + interactive picker
│   ├── sandbox.ts        # Sandbox toggle
│   ├── sessions.ts       # Session management
│   └── theme.ts          # Theme command handler
├── permissions/
│   ├── engine.ts         # Permission checking engine
│   ├── modes.ts          # Permission modes & tool categories
│   └── rules.ts          # Allow/ask/deny rules
├── sessions/
│   └── store.ts          # Session storage (JSON files)
├── ui/
│   ├── prompt.ts         # Startup panel, input box, autocomplete
│   ├── select.ts         # Interactive select list picker
│   ├── markdown.ts       # Markdown rendering
│   ├── spinner.ts        # Loading spinners
│   ├── status-bar.ts     # AI status display
│   ├── diff.ts           # File diff display
│   ├── usage-limit.ts    # Usage limit warnings
│   └── theme.ts          # Theme state & ANSI helpers
├── ai/
│   ├── provider.ts       # AI provider interface
│   ├── gemini.ts         # Gemini provider
│   ├── groq.ts           # Groq provider
│   └── openrouter.ts     # OpenRouter provider
├── tools/
│   ├── registry.ts       # Tool registry
│   ├── read-file.ts
│   ├── write-file.ts
│   ├── edit-file.ts
│   ├── delete-file.ts
│   ├── exec-command.ts
│   ├── glob-search.ts
│   ├── list-files.ts
│   └── ask-user.ts
├── config/
│   ├── store.ts          # Config file management
│   └── types.ts          # Config types
└── auth/
    ├── credentials.ts    # Key storage
    ├── wizard.ts         # Login wizard
    └── oauth/            # OAuth helpers
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   CLI Entry (index.ts)                │
├──────────────────────────────────────────────────────┤
│                    Commander (program.ts)             │
├──────────────────────────────────────────────────────┤
│         Interactive Chat (interactive.ts)             │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │Commands  │  │Session   │  │AI Provider          │ │
│  │dispatch  │  │manager   │  │(Gemini/Groq/OR)     │ │
│  └──────────┘  └──────────┘  └─────────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │Tools     │  │Permission│  │UI (prompt, select,  │ │
│  │registry  │  │engine    │  │markdown, spinner)   │ │
│  └──────────┘  └──────────┘  └─────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## License

MIT © [CHAN PISETH](https://github.com/Pisethz)
