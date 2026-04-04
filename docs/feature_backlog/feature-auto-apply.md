# Feature: Auto-Apply Suggestions

## Summary

Each piece of feedback returned by the reviewer should have an "Apply" button next to it. When clicked, the app sends the original text and the specific suggestion back to the LLM, which rewrites the relevant section to incorporate the feedback. The text area updates in place with the revised version.

## Behavior

- Each feedback item in the results panel gets a clickable "Apply" button
- Clicking it sends an LLM call with the original text + that specific suggestion, asking it to rewrite the relevant portion
- The text area updates in place with the new version
- The applied suggestion should be visually marked as applied (greyed out, checkmark, etc.)
- The user can apply suggestions selectively and in any order
