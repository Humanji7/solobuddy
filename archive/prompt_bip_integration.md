# 🚀 Prompt: Implement BIP Buddy Deep Integration

## Context
BIP Buddy Creator Hub уже создан в `~/projects/bip-buddy/`.
План интеграции задизайнен: `~/.gemini/antigravity/brain/65ee3895-b1d2-496e-9ff8-c53b989391d5/implementation_plan.md`

## Task
Реализуй 4 уровня интеграции согласно плану:

### Level 1: Субагент
Создай `~/.subagents/manifest.json` с `bip` entry.

### Level 2: Git Hook
1. Создай `~/projects/bip-buddy/hooks/post-commit`
2. Создай `~/projects/bip-buddy/ideas/commits-digest.md`
3. Покажи команду для установки hook в проекты

### Level 3: Workflow
Создай `~/.agent/workflows/bip.md` для structured scan.

### Level 4: Knowledge Item
Создай KI `bip_buddy_system` в knowledge базе.

## Verification
1. Проверь что `/bip` триггерит субагента
2. Проверь что workflow `/bip` читается
3. Проверь что KI появляется в summaries

## Notes
- Смотри `AGENT_RULES.md` для правил сбора контента
- Смотри `WORKFLOW.md` для режима Silent Mode
- Voice: Jester-Sage (ironic, raw, philosophical)
