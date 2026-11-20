# dsh-express-cards

English | [中文](README.zh.md)

A DeepSeek Harness plugin that makes agent replies scannable: it adds a reply-formatting section to the system prompt, and renders `expresscard` code fences as styled cards.

## What it does

Two layers, and only the first one touches the model:

| Layer | Effect |
|---|---|
| Host (prompt) | Registers a `express-format` system-prompt section asking for conclusion-first answers, sections, Markdown tables for comparisons, ordered lists for steps, bullet lists for parallel points, and `expresscard` blocks for highlighted summaries |
| Client (render) | Registers an `expresscard` layer in `conversation.chat.markdown.fence` and draws those blocks as cards |

Streaming fences and unparseable JSON fall back to the ordinary code block, so content is never lost.

## Install

```sh
dsh plugin --profile <profile> add github:EnderXiao/dsh-express-cards
```

Or, in DSH Desktop, install the local directory through **Settings → Plugins → Add plugin**.

Restart DSH after installing; the client half is a browser module and needs a fresh page load.

## The card protocol

A fence whose language is `expresscard` whose body is JSON:

````markdown
```expresscard
{"title":"Tests pass","kind":"conclusion","body":"1327 passed, 0 failed."}
```
````

| Field | Meaning |
|---|---|
| `title` | Required. Card heading. A card without it is invalid and falls back. |
| `kind` | `conclusion` · `steps` · `metrics` · `note` (default `note`) |
| `body` | Plain text; line breaks are preserved |
| `items` | String array, rendered as an ordered list (`steps`) |
| `metrics` | `[{"label":"…","value":"…"}]`, rendered as label/value rows (`metrics`) |
| `columns` | `2` or `3`: splits `items` into columns and lays `metrics` out side by side inside the card |

A card needs at least one of `body`, `items`, or `metrics`. URLs in any text field become links: a plain click opens the right-handbar browser, Cmd/Ctrl-click opens the system browser.

### Card groups

Wrap several cards to lay them out as a grid — column-count is on the group, not on each card:

```json
{"columns": 2, "cards": [
  {"title": "Frontend", "kind": "metrics", "metrics": [{"label": "Port", "value": "10086"}]},
  {"title": "Backend", "kind": "metrics", "metrics": [{"label": "Port", "value": "3000"}]}
]}
```

A card without `columns` defaults to `min(card count, 2)`. Below a 720px container width every multi-column layout falls back to a single column.

## Configuration

The plugin declares no Config schema (it has no runtime dependencies), so **Settings → Plugins** offers only an on/off switch for the whole row. Edit the row in the profile's `cordis.patch.yml`:

```yaml
- id: express-cards
  name: dsh-express-cards
  config:
    enabled: true          # false = no prompt section (card rendering still works)
    instruction: '…'       # replaces the built-in formatting rules entirely
```

Turning the row off stops both halves.

## Platforms

The plugin has no platform-specific code: no filesystem access, no child processes, no native modules, and no `os`/`cpu` restriction in the manifest. The Host half is plain ESM with zero dependencies; the Client half uses only Web APIs (`navigator.clipboard`, `document.createElement`, `window.open`).

| Surface | Status |
|---|---|
| DSH Desktop (macOS) | Developed and verified here |
| DSH Desktop (Windows / Linux) | Expected to work — same client bundle, no platform branches — but **not verified on real hardware** |
| `dsh web` in a browser | Same code; `color-mix` needs Chromium 111+ / Safari 16.2+, below that the card keeps a readable fallback color |

Report a platform problem in [issues](https://github.com/EnderXiao/dsh-express-cards/issues) with the DSH version and what the card looks like.

## Notes and limits

- The prompt is guidance, not a guarantee: models follow it unevenly, especially late in a long conversation or after compaction.
- Cards render in the DSH Web UI (including DSH Desktop, which embeds it). Copied elsewhere, an `expresscard` block is just a code block.
- Cards are for summaries. Multi-field comparisons belong in Markdown tables; the built-in rules tell the model not to duplicate table content in a card.
- A plain click needs the right-handbar browser service. When it is unavailable, `https:` links fall back to the system browser and other schemes are copied to the clipboard.
- No extra model requests, no network calls, nothing read from or sent to anywhere.

## License

MIT
