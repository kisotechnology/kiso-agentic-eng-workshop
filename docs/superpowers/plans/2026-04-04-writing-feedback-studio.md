# Writing Feedback Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a writing feedback tool where users paste text, select a reviewer persona, and get structured feedback from an LLM roleplaying as that reviewer.

**Architecture:** Single Next.js page with two API routes. Reviewer personas are markdown files with frontmatter, read from filesystem at request time. LLM calls go through OpenRouter to Claude Opus 4.6. Feedback is streamed and parsed client-side.

**Tech Stack:** Next.js 16.2.2, React 19, Tailwind CSS 4, TypeScript, OpenRouter API (direct fetch)

**Important:** This is Next.js 16 — read docs in `node_modules/next/dist/docs/` before writing code. Key differences: `params` are Promises, route handlers use standard Web Request/Response APIs.

---

### Task 1: Reviewer Library (`src/lib/reviewers.ts`)

Reads markdown files from `reviewers/` directory, parses frontmatter, and returns reviewer metadata and content.

**Files:**
- Create: `src/lib/reviewers.ts`
- Create: `reviewers/example-reviewer.md`

- [ ] **Step 1: Create the example reviewer markdown file**

Create `reviewers/example-reviewer.md`:

```markdown
---
name: Example Reviewer
description: A meticulous editor who obsesses over clarity
avatar: ER
---

## Personality

You're direct and sometimes blunt. You believe every sentence should earn its place. You hate jargon, buzzwords, and passive voice. You always ask "who is this for?"

## What You Look For

- Clarity above all — if a sentence can be misread, it will be
- Conciseness — cut anything that doesn't add meaning
- Strong verbs, active voice
- Logical flow between paragraphs

## Pet Peeves

- "In order to" (just say "to")
- Starting sentences with "There is" or "There are"
- Burying the lead
- Weasel words: "somewhat", "relatively", "fairly"
- Sentences that start with "It is important to note that"
```

- [ ] **Step 2: Create the reviewers library**

Create `src/lib/reviewers.ts`:

```typescript
import { readdir, readFile } from "fs/promises";
import path from "path";

export type Reviewer = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
};

export type ReviewerWithContent = Reviewer & {
  content: string;
};

const REVIEWERS_DIR = path.join(process.cwd(), "reviewers");

function parseFrontmatter(raw: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { attributes: {}, body: raw };

  const attributes: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      attributes[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { attributes, body: match[2].trim() };
}

export async function listReviewers(): Promise<Reviewer[]> {
  const files = await readdir(REVIEWERS_DIR);
  const reviewers: Reviewer[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const raw = await readFile(path.join(REVIEWERS_DIR, file), "utf-8");
    const { attributes } = parseFrontmatter(raw);
    reviewers.push({
      slug: file.replace(/\.md$/, ""),
      name: attributes.name || file.replace(/\.md$/, ""),
      description: attributes.description || "",
      avatar: attributes.avatar || attributes.name?.slice(0, 2).toUpperCase() || "??",
    });
  }

  return reviewers;
}

export async function getReviewer(
  slug: string
): Promise<ReviewerWithContent | null> {
  const filePath = path.join(REVIEWERS_DIR, `${slug}.md`);
  try {
    const raw = await readFile(filePath, "utf-8");
    const { attributes, body } = parseFrontmatter(raw);
    return {
      slug,
      name: attributes.name || slug,
      description: attributes.description || "",
      avatar: attributes.avatar || attributes.name?.slice(0, 2).toUpperCase() || "??",
      content: body,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify the library compiles**

Run: `cd /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland && npx tsc --noEmit src/lib/reviewers.ts 2>&1 || echo "Check for errors above"`

Note: If tsc fails because of project config issues, just verify there are no red squiggles by running `npx next build` later. The types are straightforward.

- [ ] **Step 4: Commit**

```bash
git add reviewers/example-reviewer.md src/lib/reviewers.ts
git commit -m "feat: add reviewer library and example reviewer markdown"
```

---

### Task 2: GET `/api/reviewers` Route

Returns the list of available reviewers as JSON.

**Files:**
- Create: `src/app/api/reviewers/route.ts`

- [ ] **Step 1: Create the reviewers API route**

Create `src/app/api/reviewers/route.ts`:

```typescript
import { listReviewers } from "@/lib/reviewers";

export async function GET() {
  const reviewers = await listReviewers();
  return Response.json(reviewers);
}
```

- [ ] **Step 2: Test manually**

Run: `cd /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland && pnpm dev &`

Then: `curl -s http://localhost:3000/api/reviewers | head -20`

Expected: A JSON array with one object containing `slug: "example-reviewer"`, `name: "Example Reviewer"`, etc.

Kill the dev server after testing.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reviewers/route.ts
git commit -m "feat: add GET /api/reviewers route"
```

---

### Task 3: POST `/api/feedback` Route

Accepts writing text and reviewer slug, calls OpenRouter, streams the response.

**Files:**
- Create: `src/app/api/feedback/route.ts`

- [ ] **Step 1: Create the feedback API route**

Create `src/app/api/feedback/route.ts`:

```typescript
import { getReviewer } from "@/lib/reviewers";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Set OPENROUTER_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const { text, reviewer: reviewerSlug } = await request.json();

  if (!text || !reviewerSlug) {
    return Response.json(
      { error: "Missing text or reviewer" },
      { status: 400 }
    );
  }

  const reviewer = await getReviewer(reviewerSlug);
  if (!reviewer) {
    return Response.json({ error: "Reviewer not found" }, { status: 404 });
  }

  const systemPrompt = `You are ${reviewer.name}. You are reviewing someone's writing and giving feedback exactly the way you would in real life.

Here is your personality and review style:

${reviewer.content}

Review the writing below. Return a JSON array of feedback items. Each item has:
- "quote": the exact passage you're commenting on (copy it verbatim from the text)
- "comment": your feedback on that passage, written in your voice

Return ONLY the JSON array, no other text. Example format:
[{"quote": "exact text from their writing", "comment": "your feedback here"}]`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-opus-4-6",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      { error: `OpenRouter error: ${errorText}` },
      { status: response.status }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 2: Add `OPENROUTER_API_KEY` to `.env.local`**

The `.env.local` file is symlinked. Check if the key already exists:

Run: `grep OPENROUTER_API_KEY /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland/.env.local`

If not present, add it:

```bash
echo 'OPENROUTER_API_KEY=your-key-here' >> /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland/.env.local
```

Note: The user will need to replace `your-key-here` with their actual OpenRouter API key.

- [ ] **Step 3: Test manually**

Start dev server and test:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"text": "In order to achieve our goals, we need to leverage our synergies.", "reviewer": "example-reviewer"}'
```

Expected: Streamed text that, when complete, is a valid JSON array of `{ quote, comment }` objects.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add POST /api/feedback route with OpenRouter streaming"
```

---

### Task 4: Main Page UI (`src/app/page.tsx`)

The single-page UI with text area, reviewer selector, feedback button, and feedback display.

**Files:**
- Modify: `src/app/page.tsx` (replace entirely)
- Modify: `src/app/layout.tsx` (update metadata)

- [ ] **Step 1: Update layout metadata**

Edit `src/app/layout.tsx` — change the metadata:

```typescript
export const metadata: Metadata = {
  title: "Writing Feedback Studio",
  description: "Get feedback on your writing from AI-powered reviewer personas",
};
```

- [ ] **Step 2: Create the main page**

Replace `src/app/page.tsx` entirely:

```tsx
"use client";

import { useState, useEffect } from "react";

type Reviewer = {
  slug: string;
  name: string;
  description: string;
  avatar: string;
};

type FeedbackItem = {
  quote: string;
  comment: string;
};

export default function Home() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<string>("");
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reviewers")
      .then((res) => res.json())
      .then((data: Reviewer[]) => {
        setReviewers(data);
        if (data.length === 1) setSelectedReviewer(data[0].slug);
      });
  }, []);

  async function handleSubmit() {
    if (!text.trim() || !selectedReviewer) return;

    setLoading(true);
    setError("");
    setFeedback([]);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, reviewer: selectedReviewer }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      const parsed: FeedbackItem[] = JSON.parse(accumulated);
      setFeedback(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans">
      <main className="w-full max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold text-zinc-900">
          Writing Feedback Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste your writing, pick a reviewer, get feedback.
        </p>

        {/* Reviewer selector */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Reviewer
          </label>
          <div className="flex flex-wrap gap-3">
            {reviewers.map((r) => (
              <button
                key={r.slug}
                onClick={() => setSelectedReviewer(r.slug)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedReviewer === r.slug
                    ? "border-zinc-900 bg-white"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {r.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900">
                    {r.name}
                  </div>
                  <div className="text-xs text-zinc-500">{r.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Text area */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-zinc-600 mb-2">
            Your writing
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here..."
            rows={8}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim() || !selectedReviewer}
          className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Reviewing..." : "Get Feedback"}
        </button>

        {/* Error display */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Feedback display */}
        {feedback.length > 0 && (
          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">
              Feedback
            </h2>
            <div className="flex flex-col gap-4">
              {feedback.map((item, i) => (
                <div key={i} className="border-l-2 border-zinc-900 pl-4">
                  <div className="rounded bg-zinc-100 px-3 py-2 text-sm italic text-zinc-500">
                    &ldquo;{item.quote}&rdquo;
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                    {item.comment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

Run: `cd /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland && pnpm dev`

Open `http://localhost:3000` in a browser. You should see:
- "Writing Feedback Studio" header
- Reviewer card(s)
- A text area
- A "Get Feedback" button (disabled until text is entered and reviewer selected)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add main page UI with reviewer selector and feedback display"
```

---

### Task 5: End-to-End Smoke Test

Verify the full flow works: select reviewer, paste text, get feedback.

**Files:** None (manual testing)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/willvoutier/conductor/workspaces/kiso-agentic-eng-workshop/auckland && pnpm dev`

- [ ] **Step 2: Verify the full flow**

1. Open `http://localhost:3000`
2. Confirm the "Example Reviewer" card is visible and pre-selected
3. Paste this text into the text area:

```
In order to achieve our goals, we need to leverage our synergies to drive meaningful outcomes. There are several factors that contribute to our success. It is important to note that the team has been working hard to deliver on our commitments.
```

4. Click "Get Feedback"
5. Confirm: the button changes to "Reviewing...", then after a few seconds, feedback items appear below with quoted passages and comments

- [ ] **Step 3: Verify error handling**

Test with a missing API key by temporarily removing `OPENROUTER_API_KEY` from `.env.local`. Restart the dev server. Submit text. Confirm the error message "Set OPENROUTER_API_KEY in .env.local" appears in the feedback area. Restore the key after testing.

- [ ] **Step 4: Clean up default files**

Remove the default Next.js assets that are no longer used:

```bash
rm public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove default Next.js assets, complete initial setup"
```

---

### Task 6: README Update

Update the README so workshop participants can get started quickly.

**Files:**
- Modify: `README.md` (replace entirely)

- [ ] **Step 1: Replace README.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with setup and architecture overview"
```
