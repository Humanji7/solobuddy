# GitHub Restructure Design

> Трансформация bip-buddy в "Dotfiles for AI-Augmented Creators"

**Дата:** 2026-01-15
**Статус:** Ready for implementation
**Версия:** 2.0 (с учётом стандартов документации)

---

## 1. Концепция

**Позиционирование:** "Dotfiles for AI-Augmented Creators"

**Философия:** Персональный workflow который можно форкнуть (holman/dotfiles pattern)

**Три способа использования:**
1. Fork & Customize — взять структуру, заменить voice
2. Cherry-pick — украсть конкретные skills
3. Follow along — читать session-log как Build-in-Public

---

## 2. Финальная структура (TO-BE)

```
solobuddy/
│
├── README.md                    # Gateway (50-80 строк)
├── CLAUDE.md                    # Agent entry point (остаётся в корне)
├── PROFILE.md                   # Voice definition (с YAML frontmatter)
├── SOUL.md                      # Protocol spec
├── LICENSE                      # MIT
│
├── .ai/                         # Unified AI configuration
│   ├── README.md                # Setup instructions (40-60 строк)
│   ├── config.example.json5     # Template с комментариями
│   ├── skills/
│   │   ├── solobuddy/
│   │   │   └── SKILL.md         # Core workflow (<200 строк)
│   │   ├── solobuddy-twitter/
│   │   │   └── SKILL.md         # Twitter extension
│   │   └── twitter-expert/
│   │       └── PROMPT.md        # Copywriting expertise (100-300 строк)
│   ├── scripts/
│   │   ├── twitter-analyze.sh
│   │   ├── twitter-monitor.sh
│   │   └── update-activity-snapshot.js
│   ├── agents/                  # (from .agent/)
│   │   ├── prompts/
│   │   └── workflows/
│   └── subagents/               # (from .subagents/)
│
├── ideas/                       # Build-in-public (остаётся в корне)
│   ├── backlog.md
│   ├── session-log.md
│   └── *.md
│
├── drafts/                      # Content drafts (остаётся в корне)
│
├── docs/
│   ├── SESSION_HANDOFF.md       # Current context (50-150 строк)
│   ├── STACK.md
│   ├── WORKFLOW.md              # (from root)
│   ├── BUILD_IN_PUBLIC.md       # (from root)
│   ├── TWITTER.md               # (from root)
│   ├── ROADMAP.md               # (from root)
│   ├── plans/                   # Design docs + ADRs
│   └── research/                # Twitter research
│
├── data/                        # Runtime (mostly gitignored)
│   ├── .gitkeep
│   ├── projects.example.json
│   ├── project-souls/
│   │   ├── .gitkeep
│   │   └── solobuddy.example.json
│   ├── twitter/
│   │   └── .gitkeep
│   └── style-examples/
│
├── legacy/                      # Deprecated (tracked, not ignored)
│   ├── README.md                # Archaeology guide (30-40 строк)
│   ├── hub/                     # Express server
│   └── handoffs/                # Old HANDOFF_*.md
│
└── hooks/
    └── post-commit
```

---

## 3. Маппинг файлов (AS-IS → TO-BE)

### Корневые файлы

| Файл | Действие | Новое место |
|------|----------|-------------|
| README.md | **REWRITE** | README.md |
| CLAUDE.md | **KEEP** | CLAUDE.md (корень) |
| PROFILE.md | **UPDATE** | PROFILE.md (добавить YAML) |
| SOUL.md | Keep | SOUL.md |
| LICENSE | Keep | LICENSE |
| WORKFLOW.md | Move | docs/WORKFLOW.md |
| BUILD_IN_PUBLIC.md | Move | docs/BUILD_IN_PUBLIC.md |
| TWITTER.md | Move | docs/TWITTER.md |
| ROADMAP.md | Move | docs/ROADMAP.md |
| PROJECT_INDEX.md | **DELETE** | — |
| HANDOFF.md | **MERGE** | docs/SESSION_HANDOFF.md |
| HANDOFF_*.md (x3) | Move | legacy/handoffs/ |
| system-prompt-v2.md | Move | legacy/ |
| TRASH-FILES.md | **DELETE** | — |

### Директории

| Директория | Действие | Новое место |
|------------|----------|-------------|
| .agent/ | Move | .ai/agents/ |
| .subagents/ | Move | .ai/subagents/ |
| scripts/ | Move | .ai/scripts/ |
| skills/ | Move | .ai/skills/ |
| hub/ | Move | legacy/hub/ |
| ideas/ | **KEEP** | ideas/ (корень) |
| drafts/ | **KEEP** | drafts/ (корень) |
| docs/ | Restructure | docs/ |
| data/ | Restructure | data/ |
| TRASH/ | **DELETE** | — |

---

## 4. Шаблоны новых файлов

### 4.1 README.md (главный)

```markdown
# SoloBuddy

> Dotfiles for AI-Augmented Creators

## Warning

⚠️ Review the code before using. This is **my** workflow — fork and customize.

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
| Tone | Ironic • Raw • Philosophical |
| Style | Honest process, not polish |

See [PROFILE.md](PROFILE.md) for full definition.

## License

MIT — do whatever you want.

---

Built by [@Humanji7](https://github.com/Humanji7)
```

---

### 4.2 PROFILE.md (обновлённый с YAML)

```yaml
---
persona:
  name: Jester-Sage
  id: solobuddy-creator
  inspired_by: Timothy Leary

voice:
  tone: [ironic, raw, philosophical]
  style: honest-process
  humor: self-deprecating

boundaries:
  avoid: [corporate-speak, excessive-emojis, fake-vulnerability]
  never: ["Excited to announce", "Game-changer", "🚀🎉"]
---

# Creator Profile

## Identity

**Human**: Multi-disciplinary builder (Code, Sound, Movement)
**Creative Force**: Materializing digital experiences with AI amplification

## Skills & Tools

- **Code**: Full-stack development, Three.js, procedural systems
- **Sound**: Audio synthesis, soundscapes
- **Movement**: Physical/digital interaction design
- **AI Leverage**: Claude Code, Gemini, agentic workflows

## Voice: The Jester-Sage

Inspired by **Timothy Leary** ("Turn on, tune in, drop out"):

| Aspect | Description |
|--------|-------------|
| **Tone** | Ironic • Raw • Philosophical |
| **Style** | Honest process sharing, not polished PR |
| **Humor** | Self-deprecating, observational |
| **Depth** | Technical precision meets existential musing |

### Voice Examples

❌ **Avoid**: "Excited to announce our new feature! 🚀🎉"
✅ **Use**: "Spent 3 hours debugging a particle shader. The bug was a typo. The typo was mine."

❌ **Avoid**: Corporate speak, excessive emojis
✅ **Use**: Vulnerability, "look what I found", raw process

### Boundaries

**Never say:**
- "Game-changer"
- "Excited to share"
- "Crushing it"

**Always:**
- Show the mess
- Specific numbers (97, not 100)
- Real failures, not humble brags

## Audience

- **Primary**: "Strange people" — kindred spirits who resonate with the journey
- **Secondary**: AGI agent clones learning from creative-technical synthesis
- **Not**: Everyone (and that's okay)
```

---

### 4.3 .ai/README.md

```markdown
# AI Configuration

Skills и скрипты для ClawdBot / Claude Code.

## Setup

### Quick (recommended)

```bash
./setup.sh
```

### Manual: Symlinks

```bash
# Skills
ln -sf $(pwd)/skills/solobuddy ~/.clawdbot/skills/solobuddy
ln -sf $(pwd)/skills/solobuddy-twitter ~/.clawdbot/skills/solobuddy-twitter
ln -sf $(pwd)/skills/twitter-expert ~/.clawdbot/skills/twitter-expert

# Scripts (optional)
ln -sf $(pwd)/scripts ~/.clawdbot/scripts
```

### Manual: Copy

```bash
cp -r skills/* ~/.clawdbot/skills/
cp -r scripts/* ~/.clawdbot/scripts/
```

## Structure

```
.ai/
├── skills/
│   ├── solobuddy/           # Core workflow
│   ├── solobuddy-twitter/   # Twitter automation
│   └── twitter-expert/      # Copywriting expertise
├── scripts/
│   ├── twitter-analyze.sh   # L1/L2 quality gates
│   ├── twitter-monitor.sh   # Fetch from watchlist
│   └── update-activity-snapshot.js
├── agents/                  # Claude Code sub-agents
├── subagents/               # Legacy subagents
└── config.example.json5     # Configuration template
```

## Skills

| Skill | Triggers | Purpose |
|-------|----------|---------|
| `solobuddy` | идеи, черновики, активность | Core workflow |
| `solobuddy-twitter` | twitter, мониторинг | Engagement automation |
| `twitter-expert` | твит, тред, хук | Copywriting expertise |

## Testing

```bash
# Verify skills loaded
clawdbot skills list

# Test Twitter pipeline (dry run)
./scripts/twitter-analyze.sh --dry-run

# Check activity snapshot
cat $(pwd)/../data/activity-snapshot.json | jq '.projects[0]'
```

## Troubleshooting

**Skills not loading:**
```bash
# Check symlinks
ls -la ~/.clawdbot/skills/

# Verify SKILL.md exists
cat ~/.clawdbot/skills/solobuddy/SKILL.md
```

**Scripts permission denied:**
```bash
chmod +x scripts/*.sh
```
```

---

### 4.4 .ai/config.example.json5

```json5
{
  // ============================================
  // SoloBuddy Configuration
  // Copy to ~/.clawdbot/config.json and edit
  // ============================================

  // Base path to solobuddy repo
  "dataPath": "/path/to/solobuddy",

  // ============================================
  // Twitter Automation
  // ============================================
  "twitter": {
    // Accounts to monitor for engagement opportunities
    "watchlist": [
      "levelsio",    // Pieter Levels - indie hacker
      "marclou",     // Marc Lou - 12 startups
      "naval",       // Naval Ravikant - philosophy
      "shl",         // Sahil Lavingia - Gumroad
      "adamwathan"   // Adam Wathan - Tailwind
    ],

    // Check interval: 15m, 30m, 1h
    "checkInterval": "30m",

    // Max tweets per user per check
    "maxTweetsPerUser": 5,

    // Only tweets younger than this (hours)
    "maxAgeHours": 6,

    // Quality gates thresholds (L1 pre-filter)
    "gates": {
      "minLikes": 100,       // Minimum engagement
      "maxAgeSeconds": 7200, // 2 hours freshness
      "maxReplies": 20       // Conversation saturation
    }
  },

  // ============================================
  // Notifications
  // ============================================
  "telegram": {
    // Get token from @BotFather
    // SENSITIVE: Never commit real value
    "botToken": "YOUR_BOT_TOKEN_HERE",

    // Your chat ID (get from @userinfobot)
    "chatId": "YOUR_CHAT_ID_HERE"
  },

  // ============================================
  // Activity Monitoring
  // ============================================
  "activity": {
    // Projects to track (paths)
    "projectPaths": [
      "/path/to/project1",
      "/path/to/project2"
    ],

    // Update interval for snapshot
    "updateInterval": "1h"
  }
}
```

---

### 4.5 .ai/setup.sh

```bash
#!/bin/bash
# SoloBuddy AI setup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_DIR="$HOME/.clawdbot"

echo "Setting up SoloBuddy AI configuration..."

# Create ClawdBot directories if needed
mkdir -p "$CLAWDBOT_DIR/skills"
mkdir -p "$CLAWDBOT_DIR/scripts"

# Symlink skills
for skill in solobuddy solobuddy-twitter twitter-expert; do
  if [ -d "$SCRIPT_DIR/skills/$skill" ]; then
    ln -sf "$SCRIPT_DIR/skills/$skill" "$CLAWDBOT_DIR/skills/$skill"
    echo "✓ Linked skill: $skill"
  fi
done

# Symlink scripts
for script in "$SCRIPT_DIR/scripts"/*; do
  if [ -f "$script" ]; then
    ln -sf "$script" "$CLAWDBOT_DIR/scripts/$(basename "$script")"
    echo "✓ Linked script: $(basename "$script")"
  fi
done

# Config template
if [ ! -f "$CLAWDBOT_DIR/config.json" ]; then
  echo ""
  echo "Config template available at:"
  echo "  $SCRIPT_DIR/config.example.json5"
  echo ""
  echo "Copy and edit:"
  echo "  cp $SCRIPT_DIR/config.example.json5 $CLAWDBOT_DIR/config.json"
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "Verify with: clawdbot skills list"
```

---

### 4.6 .ai/skills/solobuddy/SKILL.md

```yaml
---
name: solobuddy
description: Build-in-Public workflow. Triggers: идеи, черновики, активность, генерация, пост
model: inherit
allowed-tools: Read,Write,Bash,Glob
---

# SoloBuddy

Content generation и workflow management для Build-in-Public.

## Режимы

| Команда | Действие |
|---------|----------|
| `идеи` | Показать ideas/backlog.md |
| `добавь идею <текст>` | Добавить в backlog |
| `удали идею <номер>` | Удалить из backlog |
| `активность` | Показать статус проектов |
| `черновики` | Список drafts/ |
| `сгенери пост из идеи <номер>` | Генерация контента |

## Workflow

```
User request → Parse intent → Load context → Generate → Present options
```

## Paths

```
{baseDir}/ideas/backlog.md           # Ideas queue
{baseDir}/ideas/session-log.md       # Daily log
{baseDir}/drafts/                    # WIP content
{baseDir}/PROFILE.md                 # Voice definition
{baseDir}/data/activity-snapshot.json  # Project stats (hourly)
```

## Voice

**Обязательно используй {baseDir}/PROFILE.md**

Ключевые правила:
- Jester-Sage tone (ironic, raw, philosophical)
- Без корпоративного speak
- Без избыточных эмодзи
- Specific numbers (97, не 100)
- Show the mess

## Activity Phases

При показе активности используй фазы:

| Phase | Condition | Emoji |
|-------|-----------|-------|
| `active` | Commits today | 🔥 |
| `momentum` | Yesterday active, today quiet | 💨 |
| `cooling` | 2-3 days silent | 🌡️ |
| `silent` | 3-7 days | 😶 |
| `dormant` | 7+ days | 💤 |

## Output Format

### Генерация контента

Возвращай 2 варианта:

**Вариант 1: Tweet**
```
[Hook — 1 строка]

[Body — 2-3 строки]

[CTA или reflection]
```

**Вариант 2: Thread opener**
```
[Hook — tension/curiosity]

🧵 Thread:
```

### После генерации

Предложи действия:
- 💾 Сохранить в drafts/
- 🔄 Переделать
- ✏️ Редактировать

## Error Handling

| Ситуация | Действие |
|----------|----------|
| Файл не найден | Создать с шаблоном |
| Пустой backlog | Предложить добавить идеи |
| Нет activity-snapshot | Запустить update script |
```

---

### 4.7 .ai/skills/twitter-expert/PROMPT.md

```yaml
---
name: twitter-expert
description: Twitter copywriting expertise. Triggers: твит, тред, хук, twitter
model: inherit
---

# Twitter Expert

Экспертиза по Twitter копирайтингу (алгоритм 2025).

## Метрики алгоритма

| Метрика | Влияние |
|---------|---------|
| 1 RT | = 20 likes для reach |
| Первые 2ч | Критичны для алгоритма |
| Video | 2-4x reach vs text |
| Thread 3-5 | +40-60% impressions |
| Внешняя ссылка | **-30-50% penalty** |

**Правило:** Внешние ссылки ВСЕГДА в первый reply, не в main tweet.

## Hook Формулы

### 1. Curiosity Gap
```
[Удивительный результат] + [Противоречие]

"I mass-deleted 80% of features. Revenue went up."
"Spent 3 hours debugging. The bug was a typo."
```

### 2. Transformation
```
From [bad state] to [good state] in [time/effort]

"From 0 to $10K MRR in 90 days without ads"
"From burnout to shipping daily in 2 weeks"
```

### 3. Contrarian
```
Everyone says [common belief]. That's wrong.

"Everyone says post daily. That's wrong."
"Everyone optimizes for followers. I optimize for replies."
```

### 4. Specific Number
```
[Odd number] [lessons/things/mistakes] from [experience]

"7 lessons from mass-deleting 80% of my code"
"3 mistakes that cost me 6 months"
```

### 5. Tension
```
[Achievement] + [Unexpected negative]

"Hit 10K users. Never felt more alone."
"Made $50K last month. Considering quitting."
```

## Thread Structure

```
Tweet 1: Hook (tension/curiosity)
Tweet 2: Context/Setup
Tweet 3-4: Main content (specifics)
Tweet 5: Lesson/Reflection + soft CTA
```

**Soft CTA examples:**
- "What's your experience with X?"
- "Reply with your version"
- "Bookmark this for later"

**Avoid:**
- "RT if you agree"
- "Like and follow for more"
- "Link in bio"

## Anti-patterns

❌ **Запрещено:**
```
"🚀 Excited to announce..."
"Game-changer!"
"Here's why 👇"
Round numbers ("100 users" → use "97 users")
Generic advice без personal story
Engagement bait
```

✅ **Вместо этого:**
```
Specific numbers
Personal failure/success story
Raw process, not polished result
Self-deprecating humor
Genuine curiosity
```

## Quality Checklist

Перед финализацией проверь:

- [ ] Specific numbers (не round)?
- [ ] Hook создаёт tension/curiosity?
- [ ] Personal story, не generic advice?
- [ ] Внешняя ссылка в reply, не в main?
- [ ] Jester-Sage voice (не corporate)?
- [ ] Нет engagement bait?
- [ ] RT-worthy angle есть?

## Режимы использования

### DRAFT → REVIEW
```
Input: Черновик твита
Output: Улучшенная версия + объяснение изменений
```

### IDEA → DRAFT
```
Input: Идея из backlog
Output: 2 варианта (tweet + thread opener)
```

### CRITIQUE
```
Input: Твит для анализа
Output: Что работает, что нет, как улучшить
```
```

---

### 4.8 legacy/README.md

```markdown
# Legacy

⚠️ Deprecated code. Kept for archaeology.

## Contents

| Directory | Was | Replaced by |
|-----------|-----|-------------|
| `hub/` | Express web server (localhost:3000) | ClawdBot skills |
| `handoffs/` | Old session handoffs | `docs/SESSION_HANDOFF.md` |

## Why Deprecated

### hub/ (January 2026)

**Problem:** Localhost dashboard отвлекал от контента. Поддержка собственной инфраструктуры вместо создания.

**Solution:** Миграция на ClawdBot skills:
- Telegram UI вместо web UI
- Skills вместо Express endpoints
- Cron scripts вместо watcher polling

**Design doc:** `docs/plans/2026-01-14-clawdbot-migration-design.md`

### handoffs/

Old HANDOFF_*.md files from different sessions. Replaced by single `docs/SESSION_HANDOFF.md` with rolling updates.

## Resurrection

Если нужно вернуть web UI:

```bash
cd legacy/hub
npm install

# Create .env
cp .env.example .env
# Add ANTHROPIC_API_KEY

npm start
# http://localhost:3000
```

## Files of Interest

| File | Purpose |
|------|---------|
| `hub/prompt-builder.js` | System prompts (870 LOC) |
| `hub/soul-manager.js` | SOUL.md integration |
| `hub/watcher.js` | Git activity tracking |
| `handoffs/HANDOFF_PROJECT_VOICE.md` | Voice development session (28KB) |
```

---

### 4.9 data/project-souls/solobuddy.example.json

```json
{
  "name": "SoloBuddy",
  "essence": "Build-in-Public companion that never says 'great job' for trivial commits",
  "voice": {
    "archetype": "sage",
    "tone": "sharp but supportive",
    "humor": "dry, observational"
  },
  "philosophy": {
    "core": "Consistency > Intensity",
    "metaphor": "Building the road to your temple",
    "enemy": "Fake productivity, polish without substance"
  },
  "phrases": [
    "Small updates build the road",
    "Show the mess",
    "Strange people find strange temples"
  ],
  "boundaries": {
    "never": ["Excessive praise", "Corporate speak", "Fake enthusiasm"],
    "always": ["Honesty about progress", "Specific feedback", "Strategic thinking"]
  }
}
```

---

## 5. План выполнения

### Phase 1: Backup

```bash
git checkout -b backup/pre-restructure
git push origin backup/pre-restructure
git checkout main
```

### Phase 2: Создание структуры

```bash
# Создать .ai/
mkdir -p .ai/skills .ai/scripts .ai/agents .ai/subagents

# Создать legacy/
mkdir -p legacy/handoffs
```

### Phase 3: Перемещение файлов

```bash
# AI configs → .ai/
mv scripts/twitter-analyze.sh .ai/scripts/
mv skills/twitter-expert .ai/skills/
mv hub/scripts/update-activity-snapshot.js .ai/scripts/
mv .agent/* .ai/agents/
mv .subagents/* .ai/subagents/
rmdir .agent .subagents 2>/dev/null || true
rmdir scripts skills 2>/dev/null || true

# Docs consolidation
mv WORKFLOW.md docs/
mv BUILD_IN_PUBLIC.md docs/
mv TWITTER.md docs/
mv ROADMAP.md docs/

# Legacy
mv hub legacy/
mv HANDOFF_INTENT_BASED_AI.md legacy/handoffs/
mv HANDOFF_PROJECT_VOICE.md legacy/handoffs/
mv HANDOFF_UI_POLISH.md legacy/handoffs/
mv system-prompt-v2.md legacy/

# Merge HANDOFF.md into SESSION_HANDOFF.md
cat HANDOFF.md >> docs/SESSION_HANDOFF.md
rm HANDOFF.md

# Cleanup
rm -rf TRASH TRASH-FILES.md PROJECT_INDEX.md
rm -f docs/COMMANDS.md docs/TESTS.md
```

### Phase 4: Копирование skills из ~/.clawdbot/

```bash
# Скопировать актуальные skills
cp -r ~/.clawdbot/skills/solobuddy .ai/skills/ 2>/dev/null || echo "solobuddy skill not found"
cp -r ~/.clawdbot/skills/solobuddy-twitter .ai/skills/ 2>/dev/null || echo "solobuddy-twitter skill not found"

# Если twitter-monitor.sh существует
cp ~/.clawdbot/scripts/twitter-monitor.sh .ai/scripts/ 2>/dev/null || echo "twitter-monitor.sh not found"
```

### Phase 5: Создание новых файлов

Создать файлы из шаблонов выше:

- [ ] README.md (перезаписать)
- [ ] PROFILE.md (обновить с YAML frontmatter)
- [ ] .ai/README.md
- [ ] .ai/config.example.json5
- [ ] .ai/setup.sh (chmod +x)
- [ ] .ai/skills/solobuddy/SKILL.md (если не скопирован)
- [ ] .ai/skills/twitter-expert/PROMPT.md (обновить формат)
- [ ] legacy/README.md
- [ ] data/project-souls/solobuddy.example.json

### Phase 6: Обновление .gitignore

```gitignore
# Dependencies
node_modules/

# Environment
.env
*.local

# OS
.DS_Store

# IDE
.idea/
.vscode/

# Logs
*.log

# Runtime data
data/activity-snapshot.json
data/activity-snapshot.log
data/projects.json
data/project-souls/*.json
!data/project-souls/*.example.json
data/twitter/
!data/twitter/.gitkeep

# Internal archive
archive/

# Playwright
.playwright-mcp/
```

### Phase 7: Настройка симлинков

```bash
# Обновить симлинки (репо = source of truth)
ln -sf ~/projects/solobuddy/.ai/skills/solobuddy ~/.clawdbot/skills/solobuddy
ln -sf ~/projects/solobuddy/.ai/skills/solobuddy-twitter ~/.clawdbot/skills/solobuddy-twitter
ln -sf ~/projects/solobuddy/.ai/skills/twitter-expert ~/.clawdbot/skills/twitter-expert
```

### Phase 8: Финализация

```bash
# Проверить структуру
tree -L 2 -a -I 'node_modules|.git'

# Коммит
git add -A
git commit -m "refactor: restructure as AI-augmented dotfiles

- Move AI configs to .ai/ directory
- Keep ideas/ and drafts/ in root (frequent access)
- Archive hub/ to legacy/ (tracked for archaeology)
- Update README with new structure
- Add YAML frontmatter to PROFILE.md
- Create setup.sh for easy installation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push
git push origin main
```

---

## 6. Обновление GitHub Settings

После push:

1. **Description:** "Dotfiles for AI-Augmented Creators — ClawdBot skills + Build-in-Public workflow"

2. **Topics:**
   - `clawdbot`
   - `claude-code`
   - `build-in-public`
   - `ai-workflow`
   - `dotfiles`

3. **About → Website:** (опционально) ссылка на Twitter

---

## 7. Checklist готовности

### Pre-flight
- [ ] Backup ветка создана и pushed
- [ ] Нет uncommitted changes

### Структура
- [ ] .ai/ создана с skills, scripts, agents
- [ ] legacy/ создана с hub/, handoffs/
- [ ] ideas/ и drafts/ остались в корне
- [ ] docs/ консолидирована

### Файлы
- [ ] README.md переписан
- [ ] PROFILE.md обновлён с YAML
- [ ] .ai/README.md создан
- [ ] .ai/config.example.json5 создан
- [ ] .ai/setup.sh создан и executable
- [ ] legacy/README.md создан
- [ ] .gitignore обновлён

### Симлинки
- [ ] ~/.clawdbot/skills/* → .ai/skills/*
- [ ] Проверено: `clawdbot skills list`

### Тесты
- [ ] Twitter pipeline работает
- [ ] Activity snapshot обновляется
- [ ] ClawdBot skills загружаются

### Git
- [ ] Коммит создан
- [ ] Push выполнен
- [ ] GitHub description обновлён

---

## 8. Риски и митигация

| Риск | Митигация |
|------|-----------|
| Сломаются симлинки | Phase 7 обновляет симлинки |
| LaunchAgents с неверными путями | Обновить plist после миграции |
| Потеря git history | Используем `git mv` где возможно |
| Skills не загружаются | Проверяем `clawdbot skills list` |

---

## 9. Post-migration

### LaunchAgents (если используются)

Обновить пути в:
- `~/Library/LaunchAgents/com.solobuddy.activity-snapshot.plist`
- `~/Library/LaunchAgents/com.clawdbot.twitter-monitor.plist`

### Ссылки в документах

Проверить и обновить внутренние ссылки в:
- docs/SESSION_HANDOFF.md
- docs/plans/*.md
- CLAUDE.md
