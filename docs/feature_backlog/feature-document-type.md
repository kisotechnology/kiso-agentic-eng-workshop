# Feature: Document Type Support

## Summary

Add a document type selector that gives the reviewer context about what kind of writing is being reviewed. An internal Slack message has different standards than a client proposal — the reviewer's feedback should be filtered through the lens of "what kind of writing is this."

## Behavior

- Add a document type dropdown above the text area with options like: Email, Slack Message, Proposal, Blog Post, Documentation
- Reviewers can optionally have document-type-specific tips in their brain docs (e.g., Sam's email-specific feedback vs. his doc-specific feedback)
- The prompt includes the reviewer's brain doc + the document type, and the LLM weighs both when generating feedback
