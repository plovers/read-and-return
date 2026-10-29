# Changelog

## 0.1.6

- Use Obsidian's native Setting heading API in the settings tab to comply with community review requirements.

## 0.1.5 — Initial public release

First public release of **Read and Return** (`read-and-return`).

- Jump to the top or bottom of a note while remembering your reading position, then return with one action.
- Set one temporary return point per note and navigate bounded back/forward position history.
- Use mobile floating controls, the desktop ribbon menu, or command-palette actions with optional custom hotkeys.
- Adjust floating controls independently for desktop and mobile, including side and bottom spacing.
- Restore positions using text, nearby context, headings, line positions, and scroll ratio fallbacks.
- Keep navigation state in memory without modifying Markdown; save only appearance preferences in plugin data.
- Update session records when notes or folders are renamed or moved, and clear records when notes are deleted.
- Follow Obsidian's interface language: Simplified Chinese labels for Simplified Chinese, English for other languages.
- Include English and Simplified Chinese documentation and an MIT license.

Validation: production build, TypeScript checks, and 30 automated tests passed, including an 84,003-line Markdown fixture. Real-app acceptance testing for desktop Reading View, Live Preview/Source Mode, and mobile/iOS Reading View/editor remains pending. Automated tests do not establish visual accuracy on real devices.
