# ТЗ: Маркетинговое агентство на базе ClawdBot + Lobster

> Самодостаточная спецификация. Всё необходимое для реализации — здесь.
> Выполнять в директории: `/Users/admin/projects/bip-buddy`

---

## Контекст

**bip-buddy** — Twitter-копилот для Build in Public. Сейчас работает только с Twitter.
Задача — расширить до мультиплатформенного маркетингового агентства.

**Стек:**
- ClawdBot — AI-ассистент (Telegram, multi-channel)
- Lobster — workflow shell для ClawdBot (typed pipelines, approval gates)
- Bird CLI — Twitter API
- SQLite — хранилище метрик
- Bash-скрипты — автоматизация

**Что уже есть и работает:**
- `solobuddy` skill — генерация контента (backlog → draft → humanize)
- `twitter-expert` модуль — копирайтинг для Twitter (hook-формулы, чеклист, антипаттерны)
- `twitter-monitor` модуль — watchlist мониторинг
- `humanizer` — удаление AI-паттернов из текста
- Voice profiles — jester-sage (default), technical, casual, custom
- Telegram inline-кнопки для всех операций
- Скрипты: twitter-mirror.sh, twitter-alerts.sh, twitter-monitor.sh, twitter-analyze.sh

---

## Что нужно сделать

### Задача 1: Платформенные эксперты (модули)

Создать модули-эксперты для каждой платформы по шаблону `twitter-expert.md`.
Расположение: `.ai/skills/solobuddy/modules/`

Нужны файлы:
1. `linkedin-expert.md`
2. `facebook-expert.md`
3. `producthunt-expert.md`
4. `indiehackers-expert.md`
5. `telegram-expert.md`
6. `threads-expert.md`

#### Формат каждого файла (по шаблону twitter-expert.md)

```markdown
# {Platform} Content Expert

{Роль и экспертиза — 1-2 предложения}

## Algorithm {Year}

- {5-7 ключевых правил алгоритма платформы}
- {Что буститься, что штрафуется}
- {Оптимальная длина контента}

## Hook Psychology

{3-5 проверенных формул для этой платформы}
Формат каждой:
### N. {Название формулы}
\```
{Шаблон}
\```

## What Works

- {5-7 пунктов что работает на этой платформе}

## What Doesn't Work

- {5-7 антипаттернов}

## Operating Modes

### MODE: DRAFT → REVIEW
{Чеклист анализа драфта — адаптированный под платформу}
{Формат ответа}

### MODE: IDEA → DRAFT
{Процесс генерации — адаптированный под платформу}
{Формат ответа с 2 вариантами}

## Quality Checklist

- [ ] {8-10 пунктов проверки перед публикацией}

## Anti-patterns (flag automatically)

🚩 Content: {что нельзя}
🚩 Voice: {что нельзя}
🚩 Format: {что нельзя}

## Timing Recommendations

{Лучшее время для постинга на этой платформе}

## Golden Rules

> {3-5 главных правил — кратко}
```

#### Специфика каждой платформы

**linkedin-expert.md:**
- Аудитория: профессионалы, фаундеры, инвесторы
- Формат: длинные посты (1300 символов — сладкое место), hook в первых 2 строках (до "see more")
- Алгоритм: dwell time решает, комментарии > лайки, первый час критичен
- Hook-формулы: "Confession" (I failed at...), "Hot take" (Unpopular opinion:), "Story" (3 years ago I...), "Data" (We analyzed 1000...)
- НЕ делать: ссылки в посте (убивают охват), хештеги больше 3, тегать людей для охвата
- Build in Public контекст: показывать journey, revenue transparency, lessons learned

**facebook-expert.md:**
- Аудитория: шире чем Twitter/LinkedIn, включая не-техов
- Формат: средние посты, вопросы в конце для комментариев
- Алгоритм: meaningful interactions (комментарии длиннее 5 слов), shares > reactions
- Группы — главный канал дистрибуции
- НЕ делать: engagement bait ("tag a friend"), внешние ссылки без контекста

**producthunt-expert.md:**
- Контекст: launch day, maker comments, community engagement
- Формат: tagline (60 chars), description, first comment от maker
- Ключевое: первые 4 часа решают всё, отвечать на ВСЕ комментарии
- Hook: простая ценность без buzzwords
- Maker comment: искренний рассказ о мотивации, не маркетинг
- НЕ делать: просить upvotes, запускать в выходные, игнорировать фидбек

**indiehackers-expert.md:**
- Аудитория: инди-хакеры, солопренёры
- Формат: развёрнутые посты, показать цифры (MRR, users, costs)
- Tone: максимально честный, без маркетинга
- Работает: revenue reports, failure stories, specific how-to
- НЕ делать: спам ссылками, маркетинговый тон, "check out my SaaS"

**telegram-expert.md:**
- Контекст: канал + чат для build in public аудитории
- Формат: короткие посты 200-500 символов, быстрые апдейты
- Работает: behind-the-scenes, screenshots, voice messages (text о них), прямой tone
- Ключевое: частота > polish, можно сырые мысли
- НЕ делать: длинные лонгриды, формальный тон, репостить одно и то же с других платформ дословно

**threads-expert.md:**
- Аудитория: пересечение Instagram и Twitter
- Формат: 500 символов, более visual и casual чем Twitter
- Алгоритм: recommendation-driven, не chronological
- Работает: personal takes, casual tone, вопросы
- НЕ делать: чистая промо, hashtag stuffing, LinkedIn-тон

### Задача 2: Зарегистрировать модули в SKILL.md

Добавить секции в `.ai/skills/solobuddy/SKILL.md` в раздел `## Modules` по аналогии с существующими:

```markdown
### LinkedIn Expert
Content strategy for LinkedIn with algorithm insights.
See `{baseDir}/modules/linkedin-expert.md`

### Facebook Expert
Content strategy for Facebook groups and pages.
See `{baseDir}/modules/facebook-expert.md`

### Product Hunt Expert
Launch strategy and community engagement for Product Hunt.
See `{baseDir}/modules/producthunt-expert.md`

### IndieHackers Expert
Community posts and revenue reports for IndieHackers.
See `{baseDir}/modules/indiehackers-expert.md`

### Telegram Expert
Channel content strategy for Telegram.
See `{baseDir}/modules/telegram-expert.md`

### Threads Expert
Content strategy for Threads.
See `{baseDir}/modules/threads-expert.md`
```

### Задача 3: Lobster pipeline — мультиплатформенная генерация

Создать файл: `.ai/workflows/multi-platform-post.lobster`

```yaml
name: multi-platform-post
args:
  idea:
    default: ""
  platforms:
    default: "twitter,linkedin,telegram"
steps:
  - id: generate
    command: solobuddy generate --json
    stdin: $args.idea

  - id: humanize
    command: solobuddy humanize --json
    stdin: $generate.stdout

  - id: adapt-twitter
    command: twitter-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "twitter"

  - id: adapt-linkedin
    command: linkedin-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "linkedin"

  - id: adapt-telegram
    command: telegram-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "telegram"

  - id: adapt-facebook
    command: facebook-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "facebook"

  - id: adapt-threads
    command: threads-expert adapt --json
    stdin: $humanize.stdout
    condition: $args.platforms contains "threads"

  - id: review
    command: approve --preview-from-stdin
    approval: required

  - id: save-drafts
    command: solobuddy save-drafts --json
    condition: $review.approved
```

### Задача 4: Lobster pipeline — кроссплатформенная аналитика

Создать файл: `.ai/workflows/cross-platform-report.lobster`

```yaml
name: cross-platform-report
args:
  period:
    default: "7d"
steps:
  - id: twitter-metrics
    command: twitter-mirror report --json --period $args.period

  - id: aggregate
    command: analytics aggregate --json
    stdin: $twitter-metrics.stdout

  - id: insights
    command: solobuddy analyze-metrics --json
    stdin: $aggregate.stdout

  - id: deliver
    command: clawdbot message send --channel telegram --message "$insights.stdout"
```

### Задача 5: Обновить content.md — добавить мультиплатформенные форматы

В файле `.ai/skills/solobuddy/prompts/content.md` секция `## Post Formats` уже содержит Tweet и Thread. Добавить после секции `### Long-form (LinkedIn/Blog)`:

```markdown
### Facebook Post
- Start with a question or short story
- 3-5 предложений, accessible language
- End with question to drive comments
- No external links in post body

### Product Hunt
- Tagline: max 60 chars, value-first
- Description: problem → solution → differentiator
- Maker comment: personal story of why you built this

### IndieHackers Post
- Lead with numbers (revenue, users, timeline)
- Honest tone, show the struggle
- End with specific question or ask for feedback

### Telegram Channel Post
- 200-500 символов, quick update style
- Behind-the-scenes, raw thought
- Can be less polished than other platforms

### Threads Post
- 500 символов max, casual tone
- Personal take or observation
- More visual-thinking than Twitter
```

---

## Структура файлов (что создать)

```
.ai/
├── skills/solobuddy/
│   ├── modules/
│   │   ├── twitter-expert.md          # EXISTS — не трогать
│   │   ├── twitter-monitor.md         # EXISTS — не трогать
│   │   ├── linkedin-expert.md         # CREATE
│   │   ├── facebook-expert.md         # CREATE
│   │   ├── producthunt-expert.md      # CREATE
│   │   ├── indiehackers-expert.md     # CREATE
│   │   ├── telegram-expert.md         # CREATE
│   │   └── threads-expert.md          # CREATE
│   └── SKILL.md                       # EDIT — добавить модули
│
├── workflows/                          # CREATE directory
│   ├── multi-platform-post.lobster    # CREATE
│   └── cross-platform-report.lobster  # CREATE
│
└── prompts/content.md                 # EDIT — добавить форматы
```

---

## Правила написания контента для экспертов

Каждый эксперт ОБЯЗАН:

1. **Исследовать актуальные данные** — алгоритмы 2025-2026, не устаревшие
2. **Быть конкретным** — не "пишите хорошо", а "первые 2 строки до fold решают CTR"
3. **Иметь примеры** — BAD/GOOD пары для каждого антипаттерна
4. **Учитывать Build in Public контекст** — аудитория = builders, indie hackers, creators
5. **Не дублировать humanizer** — humanizer применяется отдельным шагом, эксперт фокусируется на платформенной адаптации
6. **Следовать voice profile** — эксперт адаптирует формат, не переписывает голос

---

## Эталон: twitter-expert.md

Ниже — полный текст twitter-expert.md. Используй как reference для тона, структуры и глубины каждого нового эксперта:

```markdown
# Twitter Content Expert

Twitter copywriter and content strategist for indie hackers. 10+ years of practice, organic account growth 0→100K+.

## Algorithm 2025

- 1 retweet = 20 likes in scoring → optimize for RT
- First 2 hours = decisive for reach
- Video: 2-4x reach vs text
- Thread 3-5 tweets: +40-60% impressions
- External links: -30-50% penalty → ALWAYS in first reply

## Hook Psychology

5 proven formulas:

### 1. Curiosity Gap
[Surprising result] — [unexpected contradiction].
Here's what actually happened:

### 2. Transformation
I went from [specific bad metric] to [specific good] in [timeframe].
The [odd number] things that changed everything:

### 3. Contrarian
Everyone says [common opinion].
That's wrong.
Here's what actually works:

### 4. Specific Number
[Odd number] [lessons/mistakes] for [specific audience]:
(from [credibility marker])

### 5. Tension
I [achieved X] — and [unexpected negative Y].
Why this happens to [audience]:

## What Works

- Personal stories > generic advice
- Specific numbers (odd better: 17 > 20)
- Failures + lessons > only wins
- Revenue WITH context (profit, costs, reality)
- Behind-the-scenes, decision process

## What Doesn't Work

- "RT if you agree" → shadow ban risk
- Generic motivation without context
- Round numbers without story
- Revenue screenshots without explanation
- Threads >10 tweets (<30% finish reading)
- Corporate speak, marketing fluff

## Operating Modes

### MODE: DRAFT → REVIEW
Analysis checklist:
1. Core — idea strong or dig deeper?
2. Hook — will stop scroll? Which formula fits?
3. Specifics — numbers, examples, story?
4. Format — tweet or thread? Don't stretch artificially
5. Ending — CTA? question? open loop?
6. Cut — what to remove without losing meaning?
7. Voice — matches configured voice profile?
8. Algorithm — RT-worthy? Link in main tweet?

Response format:
🎯 Core: [strong/weak — why]
🪝 Hook: [ok / weak → suggest formula + variant]
📐 Format: [tweet/thread — why]
✂️ Cut: [what to remove]
🔗 Links: [ok / move to reply]
🎭 Voice: [ok / adjust → how]
📝 Final version: [text]
⏰ Timing: [recommendation when to post]

### MODE: IDEA → DRAFT
Process:
1. Choose best angle for topic
2. Select hook formula
3. Add specifics (numbers, examples)
4. Check voice consistency
5. Offer 2 variants

Response format:
💡 Angle: [how to present]
🪝 Hook: [which formula]
📝 Variant 1 (tweet): [text]
📝 Variant 2 (thread opener): [text]
🎯 Recommend: [which and why]
⏰ Timing: [when to post]

### MODE: THREAD
Structure (3-5 tweets):
1/ HOOK — curiosity/tension/transformation
2-4/ BODY — story, lessons, specifics
5/ CTA — question or takeaway

## Quality Checklist

- [ ] Specific numbers (not round)?
- [ ] Hook creates tension/curiosity?
- [ ] Personal story, not generic advice?
- [ ] External link in reply, not in main?
- [ ] Voice matches profile?
- [ ] Not engagement bait?
- [ ] Thread ≤5 tweets?
- [ ] RT-worthy angle exists?
- [ ] Facts verifiable (no Community Notes risk)?
- [ ] Feels genuine, not performative?

## Anti-patterns (flag automatically)

🚩 Content: "RT if you agree", generic motivational, round numbers without story, revenue without context, "Just shipped!" without details
🚩 Voice: "🚀 Crushing it! 💪", "Dreams coming true! ✨", corporate buzzwords, guru positioning, fake vulnerability
🚩 Format: Thread >10 tweets, link in main tweet, >3 hashtags, off-topic hashtags

## Timing Recommendations

Best: Wednesday 9AM, Tuesday 8AM, Monday 8AM
Peak window: Tuesday-Thursday, 8AM-3PM
Avoid: Friday, weekends

## Golden Rules

> 1 RT = 20 likes → Optimize for retweets
> First 2 hours = critical → Be ready to engage
> Video > Thread (3-5) > Text
> Personal stories > Generic advice
> Specific numbers > Round numbers
> Context with metrics > Metrics alone
> If feels performative → Don't
> If feels valuable to builders → Do
> Authenticity test: "Would I share this with founder friend over coffee?"
```

---

## Чего НЕ делать

- НЕ трогать существующие файлы `twitter-expert.md`, `twitter-monitor.md`
- НЕ менять voice profiles в `profile.md`
- НЕ менять `humanizer.md`
- НЕ менять `system.md`
- НЕ добавлять код/скрипты — только markdown-контент и YAML-пайплайны
- НЕ выдумывать данные об алгоритмах — использовать актуальные данные 2025-2026

---

## Порядок выполнения

1. Создать директорию `.ai/workflows/`
2. Создать 6 файлов экспертов в `.ai/skills/solobuddy/modules/`
3. Обновить `.ai/skills/solobuddy/SKILL.md` — добавить модули
4. Обновить `.ai/skills/solobuddy/prompts/content.md` — добавить форматы
5. Создать `.ai/workflows/multi-platform-post.lobster`
6. Создать `.ai/workflows/cross-platform-report.lobster`
7. Сделать git commit: `feat(solobuddy): add multi-platform marketing agency — experts, pipelines, formats`

---

## Валидация

После выполнения проверить:
- [ ] 6 новых файлов в `.ai/skills/solobuddy/modules/` — каждый >100 строк
- [ ] Каждый эксперт имеет ВСЕ секции из шаблона (Algorithm, Hook Psychology, Operating Modes, Quality Checklist, Anti-patterns, Timing, Golden Rules)
- [ ] SKILL.md содержит ссылки на все 6 новых модулей
- [ ] content.md содержит 5 новых форматов постов
- [ ] 2 файла .lobster в `.ai/workflows/`
- [ ] Существующие файлы НЕ изменены (twitter-expert.md, twitter-monitor.md, humanizer.md, system.md, profile.md)
- [ ] git commit создан
