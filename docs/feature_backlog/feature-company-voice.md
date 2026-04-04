# Feature: Company Voice & Document Type Support

## Summary

Add two new layers of context to the feedback prompt: a global company writing style guide and a document type selector. The reviewer's feedback should be filtered through the lens of "what kind of writing is this" — an internal Slack message has different standards than a client proposal.

## Behavior

- Add a document type dropdown above the text area with options like: Email, Slack Message, Proposal, Blog Post, Documentation
- Add a `/styles` directory (or similar) containing a global company voice markdown file that describes the company's overall writing principles
- Reviewers can optionally have document-type-specific tips in their brain docs (e.g., Sam's email-specific feedback vs. his doc-specific feedback)
- The prompt now includes three context layers: the company style guide + the reviewer's brain doc + the document type — and the LLM weighs all three when generating feedback
