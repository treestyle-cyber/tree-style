# TreeStyle

- `/` — public waitlist page. Paste the Mailchimp form action URL into `MAILCHIMP_ACTION` near the bottom of `index.html`.
- `/try` — private test page (password = `TEST_PASSWORD` in Vercel).
- `api/evaluate.js` — Claude evaluation (uses `ANTHROPIC_API_KEY`; optional `CLAUDE_MODEL`).
- `api/render.js` — realistic preview with Gemini (uses `GEMINI_API_KEY`; optional `GEMINI_IMAGE_MODEL`).
- `lib/guide.js` — the designer's rules and scoring weights.

Start with `CLAUDE.md`: the project brief, how we work, branches and publishing, and the decisions log.
