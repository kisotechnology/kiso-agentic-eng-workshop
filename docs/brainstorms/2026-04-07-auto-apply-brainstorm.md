---
date: 2026-04-07
topic: auto-apply-suggestions
---

# Auto-Apply Suggestions

## What We're Building

An "Apply" button on each feedback item that sends the original text + that specific suggestion to the LLM, which rewrites the relevant section and streams the updated text back into the textarea. Applied suggestions are visually marked. Users can undo an applied suggestion to restore the previous text. Remaining unapplied feedback items show a subtle warning that the text has changed since feedback was generated.

## Why This Approach

**Dedicated `/api/apply` endpoint** was chosen over extending the existing `/api/feedback` route because:

- Clean separation of concerns — feedback generation and suggestion application are distinct operations with different prompts
- Follows the existing one-route-per-action pattern in the codebase
- Apply prompt can be tuned independently without complicating the feedback logic
- Keeps each route focused and readable

The alternative (overloading `/api/feedback` with a mode parameter) was rejected because it would mix two responsibilities in one route and make prompt logic conditional.

## Key Decisions

- **Dedicated endpoint**: New `POST /api/apply` route handles applying suggestions
- **Streaming response**: Apply streams the rewritten text progressively (consistent with how feedback already streams)
- **Undo support**: Each applied suggestion gets an "Undo" button that restores the text to its pre-apply state
- **Stale feedback warning**: After applying a suggestion, remaining unapplied items show a subtle warning that the text has changed since feedback was generated
- **Selective application**: Users can apply suggestions in any order, skipping ones they don't want
- **Visual marking**: Applied suggestions are visually distinct (greyed out + checkmark + undo button)

## Open Questions

- None — all design questions resolved during brainstorming.

## Next Steps

-> `/workflows:plan` for implementation details
