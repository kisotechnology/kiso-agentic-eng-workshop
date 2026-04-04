# Feature: Yolo Mode

## Summary

A toggle that kicks off an autonomous feedback loop. Instead of manually reviewing and applying suggestions one by one, the system gets feedback from the selected reviewer, applies all suggestions, then requests feedback again on the revised text — repeating until the reviewer has nothing left to suggest (or a max iteration cap is hit).

## Behavior

- Add a "Yolo Mode" toggle or button alongside the normal "Get Feedback" button
- When activated, the system enters a loop:
  1. Send text + reviewer brain doc to LLM, get feedback
  2. Send text + all suggestions back to LLM, get a revised version
  3. Replace the text with the revised version
  4. Repeat from step 1
- The loop stops when the LLM returns no suggestions, or after a max number of passes (e.g., 5)
- Show a live activity log so the user can watch each pass happen in real time (pass number, how many suggestions were found, what changed)
- When complete, the user sees the final polished text and a summary of total passes and changes made
