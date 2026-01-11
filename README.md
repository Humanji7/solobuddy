# 🧬 SoloBuddy

> AI-powered Build-in-Public companion for solo creators

## What is this?

SoloBuddy is a **local dashboard + AI buddy** that helps you stay consistent with your projects.

**Not another productivity app.** This is a sharp partner that:
- Watches your repos and pokes you when you abandon them
- Suggests posts based on real git activity
- Gives your projects a voice (SOUL Protocol)
- Never says "great job!" for trivial commits

## Features

| Feature | Description |
|---------|-------------|
| 🔍 **Git Watcher** | Proactive buddy messages based on repo activity |
| 🧬 **Project Voice** | Each project speaks with its own personality |
| 📝 **Draft Generator** | Turn commits into shareable content |
| 🔗 **GitHub OAuth** | Auto-discover your repositories |
| ⚡ **Intent-Based AI** | Understands what you actually need |

## Quick Start

```bash
# Clone
git clone https://github.com/Humanji7/solobuddy.git
cd solobuddy

# Setup
cp hub/.env.example hub/.env
# Add your API keys to hub/.env

cp data/projects.example.json data/projects.json
# Add your projects to data/projects.json

# Run
cd hub && npm install && npm start
```

Open http://localhost:3000

## Configuration

### Environment Variables

```bash
# hub/.env
GITHUB_CLIENT_ID=your_github_oauth_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
SESSION_SECRET=your_session_secret
ANTHROPIC_API_KEY=your_claude_api_key
```

### Projects File

```json
// data/projects.json
{
    "projects": [
        {
            "name": "my-project",
            "path": "/path/to/project",
            "github": "https://github.com/you/project"
        }
    ]
}
```

## SOUL Protocol

Give your project a voice. Create `SOUL.md` in your project root:

```markdown
# SOUL — My Project

## Identity
**Name**: ProjectName
**Archetype**: creator | explorer | rebel | sage
**Pronoun**: I | we | it

## Purpose
One sentence — why I exist.

## Tone
**Primary**: friendly | sharp | mystical | playful
**Secondary**: with humor | but honest | softly

## Key Phrases
- "Characteristic phrase 1"
- "Characteristic phrase 2"
```

See [SOUL.md](SOUL.md) for full specification.

## Philosophy

> 🏛️ Your project is a unique temple in the desert.  
> Marketing isn't selling the temple.  
> Marketing is building the road so others can find it.

**Consistency > Intensity.** Small updates build the road.

## For AI Agents

→ Start with [CLAUDE.md](CLAUDE.md)

## Structure

```
solobuddy/
├── hub/                # Web interface (Node.js + Express)
├── data/               # Projects and souls storage
├── docs/               # Documentation
├── ideas/              # Content backlog
├── drafts/             # Work in progress
└── SOUL.md             # Protocol specification
```

## License

MIT — do whatever you want.

## Author

Built by [@Humanji7](https://github.com/Humanji7) as a Build-in-Public experiment.
