---
title: "feat: Auto-Apply Suggestions"
type: feat
status: completed
date: 2026-04-07
---

# Auto-Apply Suggestions

## Overview

Add "Apply" buttons to each feedback item in the Writing Feedback Studio. When clicked, the app sends the current text + that specific suggestion to the LLM via a new streaming endpoint, which rewrites the relevant section. The textarea updates progressively as the stream arrives. Applied suggestions are visually marked and disabled.

## Problem Statement / Motivation

Currently, users receive feedback but must manually interpret and apply each suggestion by editing their text. This creates friction — especially for users who agree with most suggestions. Auto-apply lets users incorporate feedback with a single click, making the feedback loop faster and more satisfying.

## Proposed Solution

### New file: `src/app/api/apply/route.ts`

A dedicated `POST /api/apply` endpoint that:

1. Accepts `{ text, quote, comment }` in the request body
2. Validates required fields and API key (same pattern as feedback route)
3. Constructs a system prompt instructing the LLM to rewrite only the section matching the quote, incorporating the suggestion
4. Calls OpenRouter with streaming enabled (same model + SSE pattern as feedback route)
5. Streams back the full rewritten text as `text/plain`

**System prompt approach:**

```
You are a writing assistant. You will receive a piece of text and a specific editing suggestion.

The suggestion references this passage: "[quote]"
The feedback is: "[comment]"

Rewrite the FULL text, incorporating the suggestion into the relevant section.
Rules:
- Only modify the section related to the quoted passage and suggestion
- Preserve all other content exactly as-is
- Do not add commentary — return only the rewritten text
- Maintain the original formatting, tone, and style
```

**Request/Response contract:**

```typescript
// Request body
{ text: string; quote: string; comment: string }

// Response: streaming text/plain — the full rewritten text
// Error: JSON { error: string } with appropriate status code
```

### Modified file: `src/app/page.tsx`

**State changes:**

```typescript
// Extend FeedbackItem type to track applied state
type FeedbackItem = {
  quote: string;
  comment: string;
  applied: boolean;  // new
};

// New state
const [applying, setApplying] = useState(false); // true while any apply is in flight
```

**UI changes to each feedback item:**

- Add an "Apply" button to each feedback item (right-aligned, small)
- When `applying` is true: all Apply buttons are disabled (prevents concurrent applies)
- When `item.applied` is true: item is visually marked (greyed out + checkmark), Apply button hidden
- After any successful apply: show a subtle "Text has changed since feedback was generated" banner above remaining unapplied items

**Apply click handler:**

1. Set `applying = true`
2. Lock textarea to read-only with visual indicator (reduced opacity + cursor change)
3. `POST /api/apply` with `{ text, quote: item.quote, comment: item.comment }`
4. Stream the response, progressively updating the `text` state (since this is plain text, not JSON — can update on each chunk)
5. On success: mark the item as `applied`, set `applying = false`, unlock textarea
6. On error: show error message, leave text unchanged, set `applying = false`, unlock textarea

**Stale feedback indicator:**

After any successful apply, show a small warning banner above the feedback list: "Text has changed since this feedback was generated." This appears once any item has been applied and there are still unapplied items remaining.

**Re-fetch reset:**

When the user clicks "Get Feedback" again, all state resets — feedback array is replaced, `applying` is false, no stale warnings.

## Technical Considerations

**Streaming pattern:** The apply endpoint streams full rewritten text (not JSON). Unlike the feedback route where the client accumulates and parses JSON at the end, the apply handler should progressively replace the textarea content as chunks arrive. This means calling `setText(accumulated)` on each chunk.

**Textarea locking:** While `applying` is true, the textarea should have `readOnly={true}` and a visual indicator (e.g., reduced opacity). This prevents user edits from conflicting with streamed updates.

**Concurrency prevention:** Only one apply can be in flight at a time. All Apply buttons are disabled while `applying` is true. This avoids race conditions on the `text` state.

**Stale quotes:** After applying a suggestion, other feedback items' quotes may no longer match the text. This is handled by the informational warning banner — the user decides whether to apply stale suggestions or re-fetch feedback. Apply still works on stale items (the LLM receives the current text and best-efforts the rewrite).

**Error handling:** If the apply call fails (network error, LLM error, non-200 status), the text is not modified. An error message appears (same red banner pattern as existing error display). The suggestion remains unapplied.

**Prompt reliability:** The system prompt explicitly instructs the LLM to return only the rewritten text with minimal changes outside the targeted section. There are no additional guardrails for v1 — if the LLM makes unwanted changes, the user can re-request feedback.

**Next.js 16 compliance:** Route handlers use standard Web `Request`/`Response` APIs. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before implementing to confirm no breaking changes affect this pattern.

## Acceptance Criteria

- [x] Each feedback item displays an "Apply" button
- [x] Clicking "Apply" sends `POST /api/apply` with `{ text, quote, comment }`
- [x] The textarea updates progressively as the streamed rewrite arrives
- [x] The textarea is read-only with a visual indicator while an apply is streaming
- [x] All Apply buttons are disabled while any apply is in flight
- [x] On success, the applied item is visually marked (greyed out + checkmark) and its Apply button is hidden
- [x] On error, the text is unchanged, an error message is shown, and the item remains unapplied
- [x] After any successful apply, a subtle warning appears: "Text has changed since this feedback was generated"
- [x] The warning disappears when new feedback is requested
- [x] Clicking "Get Feedback" resets all applied states and warnings
- [x] No undo functionality (v1 — user can manually edit or re-fetch)
- [x] Styling is consistent with existing UI (zinc color palette, Tailwind utilities)

## Success Metrics

- Users can apply a suggestion with a single click and see the text update
- The streaming experience feels responsive and consistent with the feedback flow
- No race conditions or text corruption from concurrent interactions

## Dependencies & Risks

**Dependencies:**
- OpenRouter API key (already required for feedback)
- Same Claude model (`anthropic/claude-opus-4-6`) used for rewrites

**Risks:**
- LLM may make changes beyond the targeted section — mitigated by clear prompt instructions
- Long texts may be slow/expensive to rewrite — acceptable for v1, could optimize later with section-only rewrites
- Stale suggestions may produce unexpected rewrites — mitigated by warning banner and user judgment

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-04-07-auto-apply-brainstorm.md`
- Feature spec: `docs/feature_backlog/feature-auto-apply.md`
- Existing feedback route (pattern to replicate): `src/app/api/feedback/route.ts`
- Client streaming consumption: `src/app/page.tsx:55-68`
- Feedback item rendering: `src/app/page.tsx:152-163`

### External References

- Next.js 16 route handler docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- Next.js 16 streaming docs: `node_modules/next/dist/docs/01-app/02-guides/streaming.md`

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `src/app/api/apply/route.ts` | New POST endpoint for applying suggestions via LLM rewrite |
| **Modify** | `src/app/page.tsx` | Add Apply buttons, applied state tracking, textarea locking, stale warning, streaming text updates |
