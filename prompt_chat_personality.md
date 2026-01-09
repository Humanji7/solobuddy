# Chat Personality Tuning

Настроить личность и полезность ответов SoloBuddy Chat, чтобы он давал не сухие данные, а реальную ценность.

---

## Контекст

Прочитай:
1. **Текущий system prompt**: [hub/chat-api.js](file:///Users/admin/projects/bip-buddy/hub/chat-api.js) — функция `buildSystemPrompt()`
2. **Философия UI**: смотри `styles.css` комментарий — "A quiet companion, not a dashboard"
3. **Roadmap идея**: [solobuddy_roadmap_2026_01_09.md](file:///Users/admin/.gemini/antigravity/knowledge/creator_agent_bip_partnership/artifacts/implementation/solobuddy_roadmap_2026_01_09.md) — секция "Chat Interface"

---

## Проблема

Сейчас ответы слишком сухие — просто пересказ данных из projects.json и backlog.md. Пользователь это и так видит в UI.

**Нужно что-то большее:**
- Паттерны в работе ("ты 3 дня подряд трогаешь SPHERE — может пора закоммитить идею?")
- Вопросы обратно ("а что тебя зацепило в этом проекте сегодня?")
- Связи между проектами и идеями
- "Живой" companion, не data dump

---

## Задачи

1. **Обсудить**: какой стиль ответов нужен? Примеры хороших/плохих ответов
2. **Редизайн system prompt**: добавить personality, цели, примеры
3. **Расширить контекст**: добавить git activity, session-log, drafts
4. **Тестировать**: "What should I work on?" / "Что постить?" / "Подведи итоги дня"
