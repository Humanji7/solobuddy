# BIP Buddy Agent Rules

> These rules apply to AI agents when working in ANY project.
> Add this file path to agent memory or include bip-buddy in workspace context.

---

## 🔄 Auto-Collection Rule

**Trigger**: At the end of any dev session (when user says "готово", "/wrap", or conversation naturally ends)

**Action**: 
1. Identify postable moments from the session:
   - Features completed
   - Interesting bugs solved
   - Philosophical insights
   - Visual progress (GIF-worthy)
   - Breakthroughs or "aha" moments

2. Append to `/Users/admin/projects/bip-buddy/ideas/session-log.md`:
   ```markdown
   ### [DATE]
   
   **Session**: [project name] — [brief topic]
   
   - **[emoji] [moment title]** — [one-line description]
     - Format: [Thread/GIF/Demo/Post]
     - Hook: "[suggested hook in quotes]"
   ```

3. Do NOT interrupt the user during the session. Log silently.

---

## 📋 Format Guidelines

| Moment Type | Emoji | Best Format |
|-------------|-------|-------------|
| Philosophy/insight | 🏆 | Thread |
| Visual feature | 👁️ | GIF + caption |
| Audio/haptic | 🎵 | Video with sound |
| Tool/CLI | 📝 | Demo GIF |
| Meta/process | 🛤️ | Short post |
| Bug story | 🐛 | Process drop |
| Breakthrough | 💡 | Thread |

---

## 🚫 What NOT to Log

- Routine commits without insight
- Debugging that didn't teach anything
- Work that's too incomplete to share
- Internal tooling with no external interest
