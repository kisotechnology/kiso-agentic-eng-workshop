# Writing Feedback Studio — Design Spec

## Overview

A writing feedback tool for a 30-minute agentic engineering workshop. Users paste text, select a reviewer, and receive feedback as if that reviewer read their writing. The app sends the text plus the reviewer's "brain doc" (a personality-driven markdown file) to an LLM and returns structured feedback.

This is a starter repo. Workshop participants will extend it with features like auto-apply, company voice, and yolo mode using parallel worktrees.

## Architecture

Single API route approach. One Next.js page, two API routes, one shared lib module, and a `reviewers/` content directory at the project root.

### File Structure

```
src/
  app/
    page.tsx              # Main UI — text area, reviewer picker, feedback display
    layout.tsx            # Root layout (existing)
    globals.css           # Tailwind (existing)
    api/
      feedback/
        route.ts          # POST: reads reviewer doc, calls OpenRouter, streams response
      reviewers/
        route.ts          # GET: lists available reviewers from filesystem
  lib/
    reviewers.ts          # Reads /reviewers/*.md, parses frontmatter, returns metadata + content
reviewers/
  example-reviewer.md     # Placeholder brain doc with frontmatter
```

## Reviewer Markdown Format

Each file in `reviewers/` uses frontmatter for UI metadata and freeform markdown below for the brain doc content sent to the LLM.

```markdown
---
name: Example Reviewer
description: A meticulous editor who obsesses over clarity
avatar: ER
---

## Personality

You're direct and sometimes blunt. You believe every sentence should earn its place.
You hate jargon, buzzwords, and passive voice. You always ask "who is this for?"

## What You Look For

- Clarity above all — if a sentence can be misread, it will be
- Conciseness — cut anything that doesn't add meaning
- Strong verbs, active voice
- Logical flow between paragraphs

## Pet Peeves

- "In order to" (just say "to")
- Starting sentences with "There is" or "There are"
- Burying the lead
```

Frontmatter fields:
- `name` — Display name for the reviewer card
- `description` — Short tagline shown on the card
- `avatar` — 2-letter string for the avatar circle

Adding a reviewer = dropping a new `.md` file in `reviewers/`. No registry, no config.

## API Design

### `GET /api/reviewers`

Returns the list of available reviewers parsed from frontmatter.

```json
[
  {
    "slug": "example-reviewer",
    "name": "Example Reviewer",
    "description": "A meticulous editor who obsesses over clarity",
    "avatar": "ER"
  }
]
```

### `POST /api/feedback`

Accepts the user's writing and selected reviewer slug. Streams the LLM response.

**Request:**
```json
{
  "text": "the user's writing...",
  "reviewer": "example-reviewer"
}
```

**Response:** Streamed text. The LLM is prompted to return a JSON array of feedback items. The client accumulates the stream and parses the complete JSON when done.

```json
[
  {
    "quote": "In order to achieve our goals",
    "comment": "Just say 'to achieve our goals.' Three words doing nothing."
  },
  {
    "quote": "There are many factors that contribute",
    "comment": "What factors? Name them. This sentence is a placeholder pretending to be content."
  }
]
```

## LLM Integration

- **Provider:** OpenRouter
- **Model:** `anthropic/claude-opus-4-6`
- **API key:** `OPENROUTER_API_KEY` environment variable in `.env.local`
- **Prompt structure:**
  - System prompt: Sets up the reviewer persona using the full brain doc markdown content. Instructs the LLM to give feedback as this specific person would, returning a JSON array of `{ quote, comment }` objects.
  - User message: The text to review.

## UI Design

Single-page, single-column layout. Minimal Tailwind styling — gray/white, functional, easy to scan the code.

### Layout (top to bottom)

1. **Header** — App title and one-line description
2. **Reviewer selector** — Horizontal row of cards. Each card shows the avatar circle, name, and description. Selected card has a dark border. If only one reviewer exists, it's pre-selected.
3. **Text area** — Large textarea for pasting writing
4. **Get Feedback button** — Dark button, disabled while loading
5. **Feedback display** — Below a divider. Each feedback item shows:
   - A quoted passage (gray background, italic) with a dark left border
   - The reviewer's comment below the quote

### States

- **Empty:** Text area and reviewer selector visible, feedback area hidden
- **Loading:** Button shows loading state, feedback area shows a spinner or "Reviewing..." text
- **Results:** Feedback items displayed as a list
- **Error:** Error message shown in the feedback area

## Streaming & Error Handling

**Streaming:** The `/api/feedback` route streams the OpenRouter response using a `ReadableStream`. The client accumulates streamed text and parses the complete JSON array when the stream ends. Loading indicator shown while streaming.

**Errors:**
- Missing `OPENROUTER_API_KEY` → 500 with message "Set OPENROUTER_API_KEY in .env.local"
- Unknown reviewer slug → 404
- OpenRouter API error → pass through status and message
- Client-side: show error message in the feedback area

No retry logic, rate limiting, or auth.

## Out of Scope

These are workshop features participants will build:
- Auto-apply suggestions
- Company voice / document type support
- Yolo mode (autonomous feedback loop)

## Tech Stack

- Next.js 16.2.2 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript
- OpenRouter API (direct fetch, no SDK)
