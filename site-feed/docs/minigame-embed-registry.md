# Minigame embed registry

## Registry and publication

A chapter's `gameEmbed` stores its node ID, registry `embed_id`, title, dimensions, and
parameter pairs. The server checks every embed, including those inside panels, when a
rich document is published, updated, or restored to publication. Each ID must be
approved and every parameter key and value must appear in its allowlist. Repeated keys
fail validation. The same transaction writes the publication and revision. Drafts
can retain references while a game is under review or after revocation.

Only a logged-in admin can register, approve, or revoke a game and query
`minigames_for_review`. Registration takes an existing account username as the owner.
The username records ownership for review. Account removal leaves the game under admin control.
IDs, parameter keys, and values use ASCII letters, digits, hyphens, and underscores.
The document limits apply to IDs, keys, and values. Each game can list up to 16 keys and
16 literal values per key. All parameters are optional and case-sensitive.

1. Deploy the reviewed static files at
   `/srv/grem-minigames/games/<embed_id>/index.html` with permitted assets in the same
   directory tree. Serve each release under its own ID.
2. As an admin, call `register_local_minigame(embed_id, owner, allowed_params)`, with rules
   such as `[{"key":"level","values":["easy","hard"]}]`. The registry assigns the exact
   destination `https://minigames.grem.studio/games/<embed_id>/index.html`.
3. Review the pending row with `SELECT * FROM minigames_for_review`. Inspect the static
   release and verify that its HTTPS entry responds with HTML and no HTTP redirect.
   Review code for navigation or refresh behavior and confirm every accepted parameter.
   Call `approve_minigame(embed_id, reviewed_origin, reviewed_path)` with the exact
   canonical destination from the row.
4. Call `revoke_minigame(embed_id)` to remove the game from the public catalog and block
   publication. Its ID is permanently retired. Remove the static release from the host
   if its URL must stop serving immediately. Register a new ID for a replacement.

## Reader contract

Subscribe to the public `approved_minigames` view and look up each node's `embed_id`.
The view projects only the approved destination, parameter rules, and policy. The
resolver in [serial-minigames.mjs](../../shared/serial-minigames.mjs) accepts the
SpacetimeDB TypeScript row (camelCase field names), the saved node, and an optional
Fetch-compatible request function.

A ready descriptor supplies the canonical URL with encoded query parameters, the node
title and dimensions, `sandbox="allow-scripts"`, an empty iframe `allow`, and
`referrerpolicy="no-referrer"`. Apply all of these attributes before attaching the
frame. Treat a removed catalog row, a missing or invalid reference, and a failed
availability check as unavailable. The resolver sends a credential-free `HEAD` with a
five-second timeout and rejects redirects. An unavailable descriptor has the saved
title and dimensions and no URL. Render the title and an unavailable message as text.
Use the same placeholder if the frame fails later. On catalog removal, discard any
pending availability result and remove the corresponding frame. The chapter document
and its revision history remain intact.

## Deployment

Provision `minigames.grem.studio` with DNS and HTTPS. Include
[minigames.nginx.conf](../deploy/minigames.nginx.conf) inside a dedicated TLS virtual host
with `root /srv/grem-minigames;` and nginx's MIME types loaded. Keep this origin static,
with no upstream, user uploads, rewrites, custom error redirects, or directory index
handling. The handler serves regular files with known extensions and returns 404 for
directories, symlinks, and missing files. Serve the root from an operator-managed
directory and restrict writes to reviewed releases. Set the reader's CSP
`frame-src` to `https://minigames.grem.studio`. The game host's CSP limits framing
to `https://grem.studio`. The game host grants scripts in the sandbox and disables
privileged browser features. The static policy and the explicit no-redirect
availability check are both required when deploying the reader.

Publish the SpacetimeDB module to the existing database with the normal deploy path.
The registry table starts empty and no existing table needs a data migration.
Chapters containing old references remain readable with unavailable placeholders until
the corresponding ID is approved. Regenerate bindings for clients that consume the
catalog or review view. Legacy clients keep the three-argument `save_draft` and
two-argument `discard_draft` calls. Revision-aware clients use `save_draft_at_revision` and
`discard_draft_at_revision` and read the chapter head from `my_serial_revision_heads`.

Run `node --test site-feed/scripts/test-minigame-reader.mjs` and
`bash site-feed/scripts/test-minigame-delivery.sh` from the repository root. For
registry integration tests, start a disposable local SpacetimeDB 1.12 server and run
`node --test site-feed/scripts/test-minigame-registry.mjs`. Set `SITE_FEED_TEST_BASE` to
the prior deployable module directory to exercise an in-place upgrade.
