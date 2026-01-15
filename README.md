# SoloBuddy

> Dotfiles for AI-Augmented Creators

## Warning

Review the code before using. This is **my** workflow — fork and customize.

## Quick Start

```bash
git clone https://github.com/Humanji7/solobuddy.git
cd solobuddy

# Setup symlinks
cd .ai && ./setup.sh

# Or manual:
ln -sf $(pwd)/.ai/skills/solobuddy ~/.clawdbot/skills/solobuddy
```

## What's Inside

| Directory | Purpose |
|-----------|---------|
| `.ai/` | ClawdBot skills & scripts |
| `ideas/` | Content backlog |
| `drafts/` | Work in progress |
| `docs/` | Guides & research |
| `data/` | Runtime (gitignored) |

## Three Ways to Use

### 1. Fork & Customize
```bash
# Edit voice
vim PROFILE.md

# Edit config
cp .ai/config.example.json5 ~/.clawdbot/config.json
```

### 2. Cherry-pick
```bash
# Grab specific skill
cp -r .ai/skills/twitter-expert ~/.clawdbot/skills/
```

### 3. Follow Along
Read `ideas/session-log.md` for Build-in-Public insights.

## Philosophy

> Your project is a unique temple in the desert.
> Marketing isn't selling the temple.
> Marketing is building the road so others can find it.

See [docs/BUILD_IN_PUBLIC.md](docs/BUILD_IN_PUBLIC.md)

## Voice: Jester-Sage

| Aspect | Description |
|--------|-------------|
| Tone | Ironic, Raw, Philosophical |
| Style | Honest process, not polish |

See [PROFILE.md](PROFILE.md) for full definition.

## License

MIT — do whatever you want.

---

Built by [@Humanji7](https://github.com/Humanji7)
