---
title: Writing Feedback Studio
type: feat
status: completed
date: 2026-04-04
---

# Writing Feedback Studio

## Overview

Build a writing feedback tool where users paste text, select a reviewer persona, and get AI-generated feedback styled as that reviewer. This is the base starter repo for a 30-minute agentic engineering workshop — participants will add features on top of it.

## Proposed Solution

A single-page Next.js 16 app with:
- Client-side UI for text input, reviewer selection, and feedback display
- A `/reviewers` directory with markdown "brain docs" describing each reviewer's style
- A route handler (`/api/feedback`) that reads the selected reviewer's brain doc, constructs a prompt, and streams the LLM response from OpenRouter
- Streaming feedback displayed in real-time on the client

## Technical Approach

### Stack
- **Next.js 16.2.2** (App Router, already set up)
- **React 19** with `'use client'` for the interactive page
- **Tailwind v4** (inline theme in `globals.css`, already configured)
- **OpenRouter API** via direct `fetch` with SSE streaming (no extra SDK needed)
- **pnpm** (existing package manager)

### Architecture

```
src/
  app/
    page.tsx            — Main UI (Client Component)
    layout.tsx          — Root layout (update metadata)
    globals.css         — Tailwind theme + app styles
    api/
      feedback/
        route.ts        — POST route handler: reads brain doc, calls OpenRouter, streams response
reviewers/
  example-reviewer.md   — Example brain doc with clear format/structure
.env.local              — OPENROUTER_API_KEY (add to existing file)
```

### Key Design Decisions

1. **Single page, no routing** — Workshop participants need to grok the codebase in <5 minutes. One page with everything visible.

2. **Direct fetch to OpenRouter** — No AI SDK dependency. Raw `fetch` + SSE parsing keeps the code transparent and educational. Participants can read every line.

3. **Streaming via ReadableStream** — Route handler returns a `Response` with a `ReadableStream`. Client consumes with `response.body.getReader()`. Progressive UI updates as tokens arrive.

4. **Reviewer brain docs as plain markdown files** — Stored in `/reviewers/` at project root (not in `src/`). Read with `fs.readFile` in the route handler. Simple, no database.

5. **No markdown rendering library** — Display feedback as plain text. Keeps dependencies minimal and avoids complexity that isn't central to the workshop.

6. **Reviewer list from filesystem** — The route handler (or a separate GET endpoint) reads `/reviewers/*.md` to build the reviewer list. Adding a reviewer = adding a file. No config needed.

## Implementation Plan

### Phase 1: Reviewer Brain Docs

**Files:**
- `reviewers/example-reviewer.md`

Create the `/reviewers` directory with one example brain doc. The file should have a clear structure that makes it obvious how to write new ones:

```markdown
# Example Reviewer

## Role & Background
Senior editor with 10 years of experience in technical writing.

## What They Care About
- Clarity above all else
- Active voice
- Concrete examples over abstract claims

## Pet Peeves
- Passive voice
- Unnecessary jargon
- Burying the lede

## Feedback Style
Direct but encouraging. Points out what works before diving into what doesn't.
Tends to rewrite problematic sentences rather than just flagging them.

## Common Phrases
- "What's the one thing you want the reader to walk away with?"
- "Can you say this in half the words?"
- "Show me, don't tell me."
```

### Phase 2: API Route Handler

**Files:**
- `src/app/api/feedback/route.ts`
- `src/app/api/reviewers/route.ts`

#### GET `/api/reviewers`
- Reads `reviewers/` directory
- Returns JSON array of `{ slug, name }` (name extracted from `# Title` in each `.md` file)

#### POST `/api/feedback`
- Accepts JSON body: `{ text: string, reviewer: string }`
- Reads `reviewers/{reviewer}.md` from filesystem
- Constructs prompt:
  ```
  You are roleplaying as a specific writing reviewer. Here is their profile:

  {brain_doc_content}

  Review the following text as this person would. Give specific, actionable
  feedback in their voice and style. Reference specific parts of the text.
  Be constructive but honest.

  ---

  {user_text}
  ```
- Calls OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) with:
  - Model: `anthropic/claude-sonnet-4` (sensible default, fast + good at roleplay)
  - `stream: true`
  - Auth via `process.env.OPENROUTER_API_KEY`
- Returns streaming `Response` using `ReadableStream` that forwards SSE chunks as plain text

#### Important Next.js 16 notes:
- Route handlers use standard Web `Request`/`Response` APIs
- `cookies()`, `headers()` are async in v16 (must be awaited)
- No caching on POST routes by default (correct for our use case)

### Phase 3: Client UI

**Files:**
- `src/app/page.tsx` (replace default content)
- `src/app/globals.css` (update theme)
- `src/app/layout.tsx` (update metadata)

#### UI Components (all in `page.tsx` — single file for readability)

1. **Reviewer Selector** — Cards showing available reviewers. Fetches from `/api/reviewers` on mount. Selected reviewer highlighted.

2. **Text Input** — Large `<textarea>` with placeholder text. Generous sizing (min 12 rows).

3. **Get Feedback Button** — POSTs to `/api/feedback`. Disabled while loading. Shows spinner/loading state.

4. **Feedback Display** — Shows streamed response in a styled panel below. Text appears progressively as tokens arrive. Empty state with helper text before first submission.

#### Layout:
```
┌─────────────────────────────────────┐
│  Writing Feedback Studio            │
├─────────────────────────────────────┤
│  Select a reviewer:                 │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Rev1 │ │ Rev2 │ │ Rev3 │        │
│  └──────┘ └──────┘ └──────┘        │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │  Paste your writing here...     ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                    [Get Feedback]    │
├─────────────────────────────────────┤
│  Feedback:                          │
│  ┌─────────────────────────────────┐│
│  │  Streamed response appears here ││
│  │  ...                            ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

#### Styling:
- Clean, minimal design using Tailwind
- Light/dark mode support (already in globals.css)
- Monospace font for the feedback area (Geist Mono already loaded)
- Muted color palette — the content should be the focus, not the chrome

### Phase 4: Environment & Config

**Files:**
- `.env.local` (append `OPENROUTER_API_KEY`)
- `.env.example` (new — shows required vars without values)
- Update `layout.tsx` metadata

#### `.env.example`
```
OPENROUTER_API_KEY=your-api-key-here
```

## Acceptance Criteria

- [x] Pasting text into the textarea and clicking "Get Feedback" returns streaming LLM feedback
- [x] Feedback is written in the voice/style described in the selected reviewer's brain doc
- [x] Reviewer selector shows all `.md` files from `/reviewers/` directory
- [x] Adding a new `.md` file to `/reviewers/` makes it appear in the UI (no code changes needed)
- [x] App works with just `OPENROUTER_API_KEY` set — no other config required
- [x] Codebase is readable in under 5 minutes — minimal files, no unnecessary abstractions
- [x] `example-reviewer.md` clearly demonstrates the brain doc format

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `reviewers/example-reviewer.md` | Create | Example brain doc template |
| `src/app/api/feedback/route.ts` | Create | POST endpoint — streams LLM feedback |
| `src/app/api/reviewers/route.ts` | Create | GET endpoint — lists available reviewers |
| `src/app/page.tsx` | Replace | Main UI with text input, reviewer selector, feedback display |
| `src/app/layout.tsx` | Edit | Update metadata title/description |
| `src/app/globals.css` | Edit | Adjust theme for feedback studio |
| `.env.example` | Create | Document required env vars |

## What's NOT Included (Workshop Features)

These are intentionally omitted — participants will build them:
- Auto-apply suggestions
- Company voice / document type support
- Yolo mode (autonomous feedback loop)
