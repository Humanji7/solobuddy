# Session Handoff — 2026-01-15

> GitHub Restructure: подготовка и выполнение миграции

---

## Для следующего агента: ЗАДАЧА

### Контекст

Разработан план реструктуризации репозитория bip-buddy → "Dotfiles for AI-Augmented Creators".

**План:** `docs/plans/2026-01-15-github-restructure-design.md` (v2.0, ~1000 строк)

**Концепция:** Объединить AI-конфиги в `.ai/`, оставить ideas/drafts в корне, hub/ → legacy/

### Что нужно сделать

#### Phase 0: Подготовка (СНАЧАЛА ЭТО)

```bash
cd /Users/admin/projects/bip-buddy

# 1. Закоммитить план миграции
git add docs/plans/2026-01-15-github-restructure-design.md
git commit -m "docs: add GitHub restructure design v2.0"

# 2. Создать backup ветку
git checkout -b backup/pre-restructure
git push origin backup/pre-restructure
git checkout main

# 3. Скопировать twitter-monitor.sh (его нет в репо!)
cp ~/.clawdbot/scripts/twitter-monitor.sh scripts/
```

#### Phase 1-8: Выполнение миграции

**Полный план с командами:** `docs/plans/2026-01-15-github-restructure-design.md` (секция 5)

**Краткое содержание фаз:**

| Phase | Действие |
|-------|----------|
| 1 | ✅ Backup (выполнено в Phase 0) |
| 2 | Создать структуру: `.ai/`, `legacy/` |
| 3 | Переместить файлы (bash команды в плане) |
| 4 | Скопировать skills из `~/.clawdbot/skills/` |
| 5 | Создать новые файлы из шаблонов (секция 4 плана) |
| 6 | Обновить .gitignore |
| 7 | Настроить симлинки `~/.clawdbot/` → `.ai/` |
| 8 | Финализация: tree, коммит, push |

### Шаблоны файлов (готовы в плане, секция 4)

| Файл | Строк | Секция |
|------|-------|--------|
| README.md (главный) | ~75 | 4.1 |
| PROFILE.md (с YAML) | ~80 | 4.2 |
| .ai/README.md | ~85 | 4.3 |
| .ai/config.example.json5 | ~65 | 4.4 |
| .ai/setup.sh | ~45 | 4.5 |
| .ai/skills/solobuddy/SKILL.md | ~100 | 4.6 |
| .ai/skills/twitter-expert/PROMPT.md | ~135 | 4.7 |
| legacy/README.md | ~55 | 4.8 |
| data/project-souls/solobuddy.example.json | ~25 | 4.9 |

### Финальная структура (TO-BE)

```
solobuddy/
├── README.md, CLAUDE.md, PROFILE.md, SOUL.md, LICENSE
├── .ai/
│   ├── skills/ (solobuddy, solobuddy-twitter, twitter-expert)
│   ├── scripts/ (twitter-analyze.sh, twitter-monitor.sh, update-activity-snapshot.js)
│   ├── agents/, subagents/
│   └── config.example.json5, setup.sh
├── ideas/, drafts/          # Остаются в корне
├── docs/                    # Консолидированная документация
├── data/                    # Runtime (gitignored)
├── legacy/hub/, legacy/handoffs/
└── hooks/
```

### Источники для копирования skills

```bash
# Актуальные skills живут здесь:
~/.clawdbot/skills/solobuddy/SKILL.md        # 5.8KB
~/.clawdbot/skills/solobuddy/prompts/        # Подпапка
~/.clawdbot/skills/solobuddy/references/     # Подпапка
~/.clawdbot/skills/solobuddy-twitter/SKILL.md # 4KB
```

### После миграции

1. Обновить симлинки: `~/.clawdbot/skills/*` → `.ai/skills/*`
2. Проверить: `ls -la ~/.clawdbot/skills/`
3. Тест skills: `clawdbot skills list` (если есть такая команда)
4. LaunchAgents используют `~/.clawdbot/scripts/` — не сломаются
5. GitHub: description = "Dotfiles for AI-Augmented Creators", topics = clawdbot, claude-code, build-in-public

### Критические файлы

| Файл | Назначение |
|------|------------|
| `docs/plans/2026-01-15-github-restructure-design.md` | **ГЛАВНЫЙ ПЛАН** — все команды и шаблоны |
| `PROFILE.md` | Текущий voice — добавить YAML frontmatter |
| `~/.clawdbot/skills/solobuddy/SKILL.md` | Актуальный skill для копирования |
| `~/.clawdbot/scripts/twitter-monitor.sh` | Скрипт для копирования в репо |

---

## Предыдущая сессия: Twitter Expert Skill ✅

Deep research + финальный промпт для AI-помощника по Twitter контенту.

**Research (40+ источников):**
- Алгоритм 2025: 1 RT = 20 likes, первые 2ч критичны
- Hook формулы: Curiosity Gap, Contrarian, Transformation, Specific Numbers, Tension

**Файлы:**
- `docs/research/twitter-best-practices-2025.md` — полный отчёт
- `docs/research/METRICS_CHEAT_SHEET.md` — cheat sheet
- `skills/twitter-expert/PROMPT.md` — финальный промпт

---

## Backlog

См. `ideas/backlog.md`

---

## Команды

```bash
# План миграции
cat docs/plans/2026-01-15-github-restructure-design.md

# Текущая структура
tree -L 2 -a -I 'node_modules|.git'

# ClawdBot skills
ls -la ~/.clawdbot/skills/

# LaunchAgents
ls ~/Library/LaunchAgents/*.plist | xargs grep -l clawdbot
```
