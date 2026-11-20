# Changelog

## 0.1.0 — 2026-11-20

First release.

- Host: registers an `express-format` system-prompt section with reply-formatting rules (conclusion first, sections, tables, lists, `expresscard` blocks).
- Client: renders `expresscard` fences as cards in `conversation.chat.markdown.fence`, with kinds `conclusion`, `steps`, `metrics`, and `note`.
- Streaming and unparseable fences fall back to the plain code block, with a notice when parsing fails; every card can toggle back to its source.
- `columns` on a card splits lists and lays metrics side by side; a `cards` array with `columns` lays several cards out as a grid. All multi-column layouts collapse to one column below 720px.
- URLs in card text are links: a plain click opens the right-handbar browser, a modified click opens the system browser, and other schemes are copied to the clipboard.
- Zero runtime dependencies; configuration is `enabled` and `instruction` on the plugin row.
