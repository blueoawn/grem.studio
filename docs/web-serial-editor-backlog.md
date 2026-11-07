# Web serial rich editor: backend backlog, first batch

**Goal:** Let publishers author mixed text, images, video, and sized interactive minigames, including rotated text lines, without losing existing serial posts. These are delegation-ready issues. Each numbered item is a separate coding-agent assignment; the headings are parent issues. This batch specifies backend contracts and behavior, leaving editor presentation to a later batch.

**GitHub issue tree:** [A #4](https://github.com/blueoawn/grem.studio/issues/4) ([A1 #7](https://github.com/blueoawn/grem.studio/issues/7)–[A4 #10](https://github.com/blueoawn/grem.studio/issues/10)); [B #3](https://github.com/blueoawn/grem.studio/issues/3) ([B1 #11](https://github.com/blueoawn/grem.studio/issues/11)–[B4 #14](https://github.com/blueoawn/grem.studio/issues/14)); [C #5](https://github.com/blueoawn/grem.studio/issues/5) ([C1 #15](https://github.com/blueoawn/grem.studio/issues/15)–[C4 #18](https://github.com/blueoawn/grem.studio/issues/18)); [D #6](https://github.com/blueoawn/grem.studio/issues/6) ([D1 #19](https://github.com/blueoawn/grem.studio/issues/19)–[D3 #21](https://github.com/blueoawn/grem.studio/issues/21)). Each child issue follows the repository's [coding-agent issue template](https://github.com/blueoawn/grem.studio/blob/main/.github/ISSUE_TEMPLATE/agent-task.md).

## Existing system and rollout constraint

- The backend is the Rust SpacetimeDB `site-feed` module in `site-feed/server/spacetimedb/src/serial.rs`. `serial_posts` is public, and each post has a `body: String` limited to 10,000 bytes by the current validator. `create_serial_post` and `edit_serial_post` accept plain text. An author or admin can change a post; only admins can reorder posts.
- The publisher and reader app is the separate `blueoawn/grem-web-serial` repository, mounted at `web-serial/` as a submodule. It currently submits a textarea and renders `body` as paragraphs. The submodule is not checked out in this workspace.
- Use additive schema and staged reader/writer rollout. The pinned SpacetimeDB 1.12 documentation describes new tables and dual writes as the incremental migration path. Do not require `--delete-data`: that would erase the shared site feed and account tables. Preserve the old plain-text reducers until all clients have migrated.

**Common acceptance gate for every backend issue:** enforce authorization and validation on the server, document the wire contract, add meaningful tests for valid and hostile inputs, and keep existing plain-text posts readable. Do not accept arbitrary publisher-supplied HTML, CSS, JavaScript, or iframe attributes as persisted content.

## Parent issue A — Versioned rich documents and safe migration (P0)

Create a stable content format that can represent the release features and evolve into more experimental serial storytelling.

1. **A1 — Define `SerialDocumentV1` and canonical validation** (`site-feed`; no dependency). Define ordered blocks and stable node IDs for paragraphs with inline marks, rotated text lines, images, videos, sized game embeds, and optional scene/panel groupings. Use typed fields rather than arbitrary style strings: e.g. bounded rotation degrees, alignment, aspect ratio, width/height bounds, asset IDs, captions, alt text, and approved embed IDs. Define versioning, maximum nesting/node counts, normalized text, deterministic serialization, and an `unsupported-node` read behavior. Acceptance: valid documents round-trip without changing node IDs; malformed, oversized, script-bearing, and out-of-range payloads fail with specific errors.

2. **A2 — Add rich-document persistence beside `serial_posts`** (`site-feed`; depends on A1). Add versioned published document records keyed by post slug and private draft records, rather than changing or replacing the existing public `body` field. Preserve `slug`, author, title, published date, and reading order as stable identifiers/metadata. Define read precedence: rich document when present, otherwise a lossless legacy-text adapter. Acceptance: all preexisting posts still read; a new publication produces the rich record and a useful plain-text projection for old clients; no draft bytes appear in public subscriptions.

3. **A3 — Add versioned save/publish reducers with conflict detection** (`site-feed`; depends on A1–A2). Expose create draft, save draft, publish, update published post, and discard draft operations. Require author-or-admin permissions for every mutation. Use a monotonically increasing revision and expected-revision input so concurrent saves cannot silently overwrite one another. Keep legacy reducers operational during rollout. Acceptance: rejected validation or revision conflicts leave all related rows unchanged; published content changes atomically; old clients can still read the text projection.

4. **A4 — Build a migration and rollback rehearsal** (`site-feed` plus deployment docs; depends on A2–A3). Seed a test database with legacy chapters and accounts, publish the additive module, regenerate bindings, and exercise legacy and rich posts together. Document order of backend, reader, and publisher deployment and a rollback that retains rich records. Acceptance: no data wipe, account loss, broken old reader, or public draft exposure in the rehearsal.

## Parent issue B — Media ingestion and reusable asset library (P0)

Provide a secure upload path for drag-and-drop files and durable delivery for published chapters. Binary files should live in dedicated media storage; SpacetimeDB records ownership, status, and references.

5. **B1 — Authenticate publisher uploads** (`media service and site-feed`; depends on A2). Add an HTTP upload service or gateway whose identity check is tied to the current `accounts`/`sessions` authorization model. The server must derive the acting username from a verified session, never from a request body. Specify short-lived upload intent, expiry, per-publisher quotas, byte limits, and a resumable or retry-safe upload protocol. Acceptance: unauthenticated, expired, revoked, and cross-publisher requests cannot reserve, upload, finalize, or delete assets.

6. **B2 — Implement image/video intake and processing** (`media service`; depends on B1). Stream uploads to temporary storage, sniff actual content type, enforce supported formats and size/duration limits, reject unsafe files, and record content hash. Generate image dimensions, thumbnails, video poster, duration, and browser-deliverable variants; retain an original only when policy permits. Mark an asset usable only after processing succeeds. Acceptance: partial uploads expire; duplicate retries are idempotent; a failed processor never exposes a broken published URL.

7. **B3 — Serve stable media URLs and a publisher asset library** (`media service and site-feed`; depends on B2). Store durable asset metadata and ownership; provide authenticated list/search for the publisher and stable public read URLs for published references. Implement cache policy, video byte-range delivery, and an explicit lifecycle for unused or deleted media. A publisher may reuse an owned asset in several chapters; admins may manage all assets. Acceptance: two chapters can share one asset without duplicate bytes; deleting one reference does not break the other; unpublished assets are not publicly discoverable.

8. **B4 — Validate document-to-asset references at publish time** (`site-feed`; depends on A3 and B3). Every image/video node must reference a ready asset owned by the author or approved by an admin. Store accessible metadata (alt text for meaningful images, captions/transcript reference for video) with the document or asset contract. Track references transactionally so deletion and cleanup remain safe. Acceptance: foreign, pending, deleted, and nonexistent asset IDs cannot be published; replacing a document updates references consistently.

## Parent issue C — Minigame embeds and expressive text contracts (P0)

Support interactive chapters while keeping publisher content constrained and portable.

9. **C1 — Create an approved minigame embed registry** (`site-feed` and deployment config; depends on A1). Model each game with an ID, approved HTTPS origin/path policy, ownership, status, and a narrowly specified sandbox/feature policy. Publishers reference a registry ID and allowlisted parameters instead of saving raw iframe HTML or arbitrary URLs. Include admin review/revocation and a process for locally hosted minigames. Acceptance: unapproved origins, URL redirects outside policy, unknown parameters, and revoked games cannot be published; revocation has a defined reader fallback.

10. **C2 — Persist and validate per-instance iframe sizing** (`site-feed`; depends on C1). Each embed node carries width and height or aspect-ratio preferences in bounded, device-independent units, plus minimum/maximum constraints and accessible title/fallback text. Validate against the registry's limits and define behavior for legacy/unsupported clients. Acceptance: dimensions survive save and publish exactly within allowed bounds; zero, extreme, negative, or nonfinite values fail validation. The backlog does not prescribe editor controls or public visual layout.

11. **C3 — Add first-class rotated text lines** (`site-feed`; depends on A1). Represent line text and allowed inline marks with a signed rotation angle, alignment/anchor, optional motion-safe alternative, and plain-text reading order. Keep these values structured and bounded; never store arbitrary CSS transforms. Acceptance: angles round-trip; text search/extraction reads the line in story order; invalid transforms or nested executable content are rejected.

12. **C4 — Define a safe interactive-story extension** (`site-feed`; depends on A1 and C1). Add typed, validated chapter choices and image hotspots that target an existing chapter slug or a named anchor. Specify broken-target behavior and a read-only fallback for clients that do not support the node yet. This creates room for branching stories and explorable art without arbitrary scripting in chapter content. Acceptance: target references are checked on publish, deletion of a target is handled predictably, and the plain-text projection retains choice labels.

## Parent issue D — Publishing reliability, preview, and audit (P1)

Make rich editing recoverable and observable before the visual editor is built.

13. **D1 — Add revision snapshots and restore** (`site-feed`; depends on A3). Record who changed a draft or published chapter, when, its revision, and a recoverable snapshot. Set retention and storage limits. Restore creates a new revision; it does not rewrite history. Acceptance: author/admin permissions apply to history; a bad edit can be restored without changing the chapter URL or ordering.

14. **D2 — Add private preview reads** (`site-feed`; depends on A3 and B4). Allow an author or admin to read a complete draft with its media and embed descriptors before publication. If shareable preview links are desired, use expiring, revocable capabilities scoped to one revision. Acceptance: a normal public subscription cannot read drafts or unapproved media; preview data reflects exactly the revision requested.

15. **D3 — Add content integrity and operational checks** (`site-feed`, media service, deployment; depends on B4, C1, D1). Provide checks for orphaned assets, missing media variants, broken game targets, invalid document versions, and oversized documents. Add metrics/logs for failed uploads, processing, validation, publishing, and embed revocation without logging full drafts or credentials. Acceptance: a dry-run report identifies broken references; repair/cleanup actions are explicit and safe to rerun.

## Dependency order and delegation

Start **A1** and the design portion of **B1** together. After A1, agents can work on **A2**, **C1**, and **C3** in parallel. After B1, **B2** can proceed independently of the editor. The publication seam is **A3 + B3 + B4 + C2**; **A4** rehearses it before the publisher app changes. **D1–D3** and **C4** can follow without blocking basic rich publishing.

Later frontend issues should consume these contracts: drag-and-drop/upload feedback, structured text editing, media placement, iframe resize controls, preview, and public rendering with accessible fallbacks. Keep those as a separate batch so the backend issues remain independently assignable.

## Delegating through GitHub Actions

The [Qwen editor issue workflow](https://github.com/blueoawn/grem.studio/blob/main/.github/workflows/qwen-editor-issue.yml) runs only through a manual Actions dispatch. Supply the number of one open child issue (A1–D3); the workflow checks that the issue was opened by the repository owner and has an editor-backend child title. It gives Qwen the issue body and repository files, then commits the resulting changes on an isolated `codex/` branch and opens a draft pull request for review. Parent issues are not accepted as dispatch targets.

Before the first run, add `QWEN_API_KEY` as a repository Actions secret and ensure the repository permits Actions to create pull requests. The workflow fails with a clear error if the key is absent. It does not run when an issue is opened or assigned; assignment to another coding agent remains independent of Qwen dispatch. Review the generated PR and its test report before merging.

## Reference

- [SpacetimeDB 1.12 incremental migrations](https://spacetimedb.com/docs/1.12.0/databases/incremental-migrations/) describes additive tables and compatibility reads/writes for existing data.

