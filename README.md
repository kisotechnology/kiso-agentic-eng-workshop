# Writing Feedback Studio

Paste your writing, select a reviewer, get feedback as if that person reviewed it.

## Setup

```bash
pnpm install
```

Add your OpenRouter API key to `.env.local`:

```
OPENROUTER_API_KEY=your-key-here
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding Reviewers

Drop a markdown file in the `reviewers/` directory. Format:

```markdown
---
name: Your Reviewer
description: Short tagline
avatar: YR
---

Write the reviewer's personality, what they look for,
their pet peeves, and how they give feedback.
```

The app picks up new files automatically — no config needed.

## Architecture

```
src/app/page.tsx           → Main UI (client component)
src/app/api/reviewers/     → GET: lists available reviewers
src/app/api/feedback/      → POST: sends text to LLM, streams feedback
src/lib/reviewers.ts       → Reads reviewer markdown files
reviewers/                 → Reviewer brain docs (markdown + frontmatter)
```
