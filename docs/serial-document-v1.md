# SerialDocumentV1 — versioned, server-validated rich document format

`SerialDocumentV1` is the content model for **web-serial chapters**. It represents
paragraphs with inline marks, rotated text lines, image/video asset references, sized
minigame embeds, and optional scene/panel groupings using **typed, bounded fields** — not
arbitrary HTML/CSS/JS strings.

Implemented in [`serial_document.rs`](../site-feed/server/spacetimedb/src/serial_document.rs)
(issue #7). This is a shared contract: it is pure data plus validation, adds **no tables,
reducers, or rendering**, and does **not** change the existing plain-text `serial_posts`
contract. Future publisher (write) and reader (read) clients, and the public renderer
(C-series), consume it.

---

## 1. Wire format

A `SerialDocumentV1` is a JSON object:

```json
{
  "version": 1,
  "nodes": [ /* ordered DocumentNode values, in reading order */ ]
}
```

- `version` — the only value this server currently accepts is `1`. Any other value is
  rejected with `UnsupportedVersion`.
- `nodes` — a non-empty, ordered list of nodes. Top-level order is the reading order.

Each node is an **internally tagged** object: its `"type"` field selects the variant. The
tag values are camelCase: `paragraph`, `rotatedText`, `image`, `video`, `gameEmbed`,
`panel`. Every node carries a stable `id`.

---

## 2. Node types

| `type` | Shape | Purpose |
|---|---|---|
| `paragraph` | `{ id, runs }` | A paragraph of inline text. |
| `rotatedText` | `{ id, runs, rotation, alignment?, alt? }` | A line of text at a bounded rotation. |
| `image` | `{ id, asset_id, alt, caption?, width?, height? }` | Reference to a published image asset. |
| `video` | `{ id, asset_id, poster_asset_id?, caption?, width?, height? }` | Reference to a published video asset. |
| `gameEmbed` | `{ id, embed_id, width, height, title, params[] }` | Sized reference to an approved minigame. Dimensions are required. |
| `panel` | `{ id, label?, children[] }` | Optional scene/panel grouping of nodes. |

### Inline runs (`runs`)

`paragraph` and `rotatedText` are built from a non-empty list of inline runs:

```json
{
  "text": "The ",
  "bold": false,
  "italic": false,
  "underline": false,
  "strikethrough": false,
  "code": false,
  "link": { "url": "https://example.com", "text": null }
}
```

- `text` — non-empty after trimming.
- `bold/italic/underline/strikethrough/code` — boolean marks, default `false` (omittable).
- `link` — optional. `url` must be `http(s)`; `text` is optional custom link text
  (defaults to the run's own text).

### Field semantics worth noting

- **`id`** — stable, **unique across the entire document including nested panels**, and
  never altered by validation. Charset `a-z A-Z 0-9 - _`.
- **`asset_id`** (image/video) — a reference to a *published media asset*, never a raw
  URL in this issue (A1). The upload service that owns assets is out of scope.
- **`embed_id`** (gameEmbed) — an approved registry id resolved to an origin/path policy
  elsewhere. Never a raw `iframe`/URL.
- **`alt`** (rotatedText) — an optional explanation appended to the visible text
  in the fallback when it adds information.
- **`alt`** (image) — alt text; an **empty string** is valid and means "decorative".
- **`params`** (gameEmbed) — an allowlisted key/value list.
- **`children`** (panel) — non-empty nested node list (contributes a nested reading order).
- **`alignment`** (rotatedText) — `left` (default), `center`, or `right`.

---

## 3. Bounds

All limits are enforced by validation and are the contract clients must respect.

| Constant | Value | Meaning |
|---|---|---|
| `SUPPORTED_VERSION` | `1` | The only accepted `version`. |
| `MAX_TOP_LEVEL_NODES` | `200` | Max top-level `nodes`. |
| `MAX_TOTAL_NODES` | `500` | Max nodes counting nested panel children. |
| `MAX_PANEL_DEPTH` | `8` | Max panel nesting depth (top-level panel = depth 1). |
| `MAX_RUNS_PER_BLOCK` | `200` | Max inline runs per paragraph / rotated text. |
| `MAX_BLOCK_TEXT_BYTES` | `10_000` | Max UTF-8 bytes of text in one block. |
| `MAX_TOTAL_TEXT_BYTES` | `200_000` | Max UTF-8 bytes of text in the whole document. |
| `MAX_DOCUMENT_BYTES` | `1_000_000` | Max UTF-8 bytes of the serialized document. |
| `MAX_NODE_ID_BYTES` | `128` | Max length of a node id. |
| `MAX_ASSET_ID_BYTES` | `128` | Max length of an asset id. |
| `MAX_EMBED_ID_BYTES` | `128` | Max length of a game-embed registry id. |
| `MAX_EMBED_PARAM_KEY_BYTES` | `64` | Max length of an embed parameter key. |
| `MAX_EMBED_PARAM_VALUE_BYTES` | `256` | Max length of an embed parameter value. |
| `MAX_EMBED_PARAMS` | `16` | Max parameters per game embed. |
| `MAX_URL_BYTES` | `500` | Max length of a URL. |
| `MAX_TEXT_FIELD_BYTES` | `500` | Max length of short text fields (alt, caption, label, title, link text). |
| `MAX_ROTATION_DEGREES` | `180` | `rotation` must be within `[-180, 180]`. |
| `MIN_DIMENSION_UNITS` | `1` | Minimum display dimension. |
| `MAX_DIMENSION_UNITS` | `4096` | Maximum display dimension. |

Dimensions (`width`, `height`) are **device-independent units** in `1..=4096`.

---

## 4. Validation & normalization rules

`SerialDocumentV1::from_json(input)` trims text fields, rejects unsafe content, and
enforces every bound. A passing document is **normalized** (safe to persist and to
re-serialize deterministically):

1. **Version** — must equal `1`, else `UnsupportedVersion`.
2. **JSON shape** — must parse as a `SerialDocumentV1` object, else `InvalidJson`.
3. **Size** — raw input and the re-serialized normalized form must be ≤ `MAX_DOCUMENT_BYTES`.
4. **Nodes** — non-empty, ≤ `MAX_TOP_LEVEL_NODES` top-level, ≤ `MAX_TOTAL_NODES` total.
5. **Node ids** — trimmed; non-empty; ≤ `MAX_NODE_ID_BYTES`; charset `a-z A-Z 0-9 - _`;
   **unique across the whole document** (a duplicate, even nested, is `DuplicateNodeId`).
6. **Panels** — `children` non-empty (`EmptyPanel`); nesting depth ≤ `MAX_PANEL_DEPTH`.
7. **Text blocks** (`paragraph` / `rotatedText`) — `runs` non-empty (`EmptyBlock`),
   ≤ `MAX_RUNS_PER_BLOCK`; each run's `text` non-empty after trimming; block text
   ≤ `MAX_BLOCK_TEXT_BYTES`; whole-document text ≤ `MAX_TOTAL_TEXT_BYTES`.
8. **Short text fields** (alt, caption, label, title, link text, embed param value) —
   trimmed; ≤ `MAX_TEXT_FIELD_BYTES`; control characters rejected
   (`InvalidTextField` / `ControlCharacter`).
9. **URLs** (inline links) — must start with `http://` or `https://`, ≤ `MAX_URL_BYTES`,
   no control characters (`InvalidUrl`). A rejected `rotatedText` link target containing
   an executable token is reported as `ExecutableContent`.
10. **Identifiers** — `asset_id`, `embed_id`, embed param key follow the id charset/length
    rules (`InvalidIdentifier`).
11. **Rotation** — within `[-180, 180]` (`OutOfRange`). `rotatedText` rejects unknown
    fields such as `transform` (`InvalidJson`).
12. **Dimensions** — `1..=4096` (`OutOfRange`).
13. **Embed params** — ≤ `MAX_EMBED_PARAMS`; each key is a valid identifier, value non-empty.

### Defensive content screen

There is **no field for raw HTML, CSS, or JavaScript**. As a final screen, free-text
fields are rejected if they contain (case-insensitively) any token in `DENY_TOKENS`:

```
javascript:   vbscript:   data:text/html
<script       <iframe     <object
<embed
```

A match is `ExecutableContent`. This is defense-in-depth: the format has no execution
surface, so a script-bearing payload should fail loudly rather than be persisted as
inert text.

---

## 5. Deterministic serialization

`to_json()` serializes the **normalized** document with fixed field order (the order of
the struct definitions), so the same logical document always produces the same bytes.
Round-trip is stable: `from_json(to_json(doc)) == doc`.

- Optional fields with no value serialize as `null`. Blank optional strings such as
  a caption, rotated text alt, or panel label normalize to `null`. A blank required
  image alt normalizes to `""`. Inline run boolean marks are always serialized, and
  canonical `rotatedText` JSON includes the alignment even when it defaults to `left`.

---

## 6. Plain-text extraction

`plain_text()` returns a single normalized string in **reading order**:

- Each node contributes one segment (paragraph text, rotated-text text, image `alt` +
  `caption`, video `caption`, embed `title`, panel `label` + nested children).
- A rotated text's `alt` is appended as `(alt)` only when it differs from the visible text.
- Whitespace inside each segment is collapsed to single spaces; empty segments are dropped;
  segments are joined with `\n` and the result is trimmed.

The projection retains all meaningful text and accessibility labels and is stable across
serialization — suitable for search, previews, and accessibility fallbacks.

---

## 7. Example payloads

### Minimal

```json
{
  "version": 1,
  "nodes": [
    { "type": "paragraph", "id": "p1",
      "runs": [{ "text": "It was a bright cold day in April." }] }
  ]
}
```

### Full (every node type, nested panel, inline marks and link)

```json
{
  "version": 1,
  "nodes": [
    {
      "type": "paragraph", "id": "p1",
      "runs": [
        { "text": "The " },
        { "text": "door", "bold": true },
        { "text": " swung open",
          "link": { "url": "https://example.com/door" } }
      ]
    },
    {
      "type": "rotatedText", "id": "r1",
      "runs": [{ "text": "TURN BACK NOW" }],
      "rotation": 270, "alignment": "center",
      "alt": "turn back now"
    },
    {
      "type": "image", "id": "img1",
      "asset_id": "asset_img_001",
      "alt": "A dark corridor",
      "caption": "Fig 1. The corridor.",
      "width": 640, "height": 480
    },
    {
      "type": "video", "id": "vid1",
      "asset_id": "asset_vid_001",
      "caption": "Narration: the corridor in motion.",
      "width": 640, "height": 360
    },
    {
      "type": "gameEmbed", "id": "g1",
      "embed_id": "minigame-escape-room",
      "width": 480, "height": 320,
      "title": "Escape the room",
      "params": [{ "key": "level", "value": "3" }]
    },
    {
      "type": "panel", "id": "panel1", "label": "Scene 1",
      "children": [
        { "type": "paragraph", "id": "p2", "runs": [{ "text": "Inside, it was quiet." }] },
        { "type": "panel", "id": "panel2", "children": [
            { "type": "paragraph", "id": "p3", "runs": [{ "text": "A clock ticked." }] }
        ] }
      ]
    }
  ]
}
```

> Note: in the full example the rotated-text `alt` (`"turn back now"`) is the lower-cased
> visible text, so `plain_text()` does not append it (it differs only in case from the
> normalized comparison — see the unit test `rotated_text_alt_is_appended_when_different`
> for the appended case).

The `plain_text()` of the full example above is:

```
The door swung open
TURN BACK NOW
A dark corridor Fig 1. The corridor.
Narration: the corridor in motion.
Escape the room
Scene 1
Inside, it was quiet.
A clock ticked.
```

---

## 8. Fallback behavior for unsupported clients

Clients without rotation support, or with rotation disabled for accessibility, render
the `rotatedText` line as unrotated plain text in document reading order. Use the same
projection as `plain_text()`: the run text followed by ` (alt)` when the trimmed alt is
non-empty and differs from the visible line (ignoring ASCII case). For example, run text
`B` and alt `bee` yield `B (bee)`. Rotation and alignment do not change the fallback
text or the line's place in the chapter.

Clients that do not support `gameEmbed` nodes should render a placeholder using the
`title` field as fallback text. The `title` field is required and must contain meaningful
text that describes the minigame (e.g., "Escape the room"). The minigame registry
resolution (origin/path policy) is handled elsewhere and is not part of this contract.

## 9. Error type

`DocumentError` is a closed enum with a stable `Display` per variant, covering:
`InvalidJson`, `UnsupportedVersion`, `EmptyDocument`, `TooManyNodes`, `PanelTooDeep`,
`EmptyPanel`, `DuplicateNodeId`, `InvalidIdentifier`, `InvalidTextField`,
`ExecutableContent`, `EmptyBlock`, `TooManyRuns`, `BlockTextTooLong`, `TotalTextTooLong`,
`DocumentTooLarge`, `InvalidUrl`, `OutOfRange`, `TooManyEmbedParams`. It implements
`std::error::Error`.

---

## 10. Scope / non-goals (issue #7)

In scope: the versioned struct, validation, normalization, deterministic serialization,
plain-text extraction, typed errors, unit tests, and this contract doc.

**Out of scope** (other issues): editor UI, the media **upload service** (asset ids are
opaque here), the public **renderer**, the minigame registry/allowlist, and any
spacetimedb tables or reducers. Existing plain-text `serial_posts` and reducers are
untouched.
