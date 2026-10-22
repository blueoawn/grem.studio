# Site Feed

Live "What's New?" feed for the GREM Studio homepage, plus the admin portal
used to publish it. Three pieces, sharing the same SpacetimeDB module:

- `server/spacetimedb/` — the Rust SpacetimeDB module for the whole site:
  - `src/accounts.rs`: one private `accounts` table (Argon2 hashes, `is_admin`)
    and `sessions`, one `login`, plus the `my_account` and `account_audit` views.
    Admins use `/admin/`; publishers use `/publisher/`.
  - `src/lib.rs`: the homepage feed `posts`.
  - `src/serial.rs`: the **web serial** `serial_posts` (see `../web-serial/README.md`).
- To update the live site, run `../deploy.sh` on the host.
- `admin/` — a React admin UI for logging in and creating/editing/deleting posts,
  served at `grem.studio/admin/`
- `widget/` — a tiny vanilla-TS script that renders the live feed into `index.html`'s
  "What's New?" section
- `scripts/` — interactive command-line tools for the server operator to manage
  admin accounts (see [Managing admin accounts](#managing-admin-accounts))

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust toolchain](https://rustup.rs/)
- [SpacetimeDB CLI](https://spacetimedb.com/install)

## Server Setup

### 1. Install SpacetimeDB

```bash
curl -sSf https://install.spacetimedb.com | bash
```

### 2. Start the SpacetimeDB server

```bash
spacetime start
```

This starts SpacetimeDB on `localhost:3000` by default. In production this
repo's site already shares one running instance across `picto-forum`,
`graffiti-together`, and this module — no separate `spacetimedb.service` is
needed here.

### 3. Set the owner identity and publish the backend module

`create_admin_account` and `delete_admin_account` (the only ways to add or
remove an admin) are gated to a single hardcoded operator identity, baked in
at publish time via the `SITE_FEED_OWNER_IDENTITY` env var:

```bash
spacetime login show             # find your operator identity's hex
export SITE_FEED_OWNER_IDENTITY=<your identity hex>
cd server/spacetimedb
spacetime publish site-feed
```

If you skip setting `SITE_FEED_OWNER_IDENTITY`, the module falls back to a
dev-only placeholder identity that no real client can match — fine for local
testing, but `create_admin_account`/`delete_admin_account` will be unusable
until you publish with a real one.

**Important — this env var is re-baked in on every rebuild.** `option_env!`
reads it at compile time, not runtime, so *any* rebuild/republish (including
one triggered by an unrelated schema change, or `spacetime dev`'s
auto-republish-on-save) that happens in a shell without
`SITE_FEED_OWNER_IDENTITY` set will silently revert the owner check to the
placeholder — locking out even the real operator with no obvious cause. If
`create_admin_account`/`delete_admin_account` suddenly start failing for an
identity that used to work, this is the first thing to check: the reducer
now gives a distinct "Server misconfiguration" error in this case rather
than the generic "not you" denial, so check the exact error message.
Re-export the var and republish to fix it.

Also note: a breaking schema change to any table (e.g. adding a
non-nullable column) requires `spacetime publish --delete-data`, which wipes
**every** table in the database, not just the one that changed — including
`accounts`. Re-run the admin-creation step below after any such
republish.

### 4. Create your first admin account

Use the interactive script (see [Managing admin accounts](#managing-admin-accounts)
below), or call the reducer directly on the server, using the same identity as
`SITE_FEED_OWNER_IDENTITY` (your logged-in CLI identity from `spacetime login
show`). Note that `spacetime call` takes each reducer argument as its own JSON
value, not one JSON array:

```bash
spacetime call site-feed create_admin_account '"yourusername"' '"yourpassword"'
```

New admins are only ever added this way — there is no in-app registration or
bootstrap reducer. Calling it (or `delete_admin_account`) from any other
identity (e.g. `--anonymous`, or a browser client) fails with "This action may
only be invoked by the server operator's CLI identity" — verified locally as
part of building this module.

### 5. Generate TypeScript bindings

Both the admin app and the widget need generated bindings from the published
module:

```bash
cd admin && npm install && npm run generate && cd ..
cd widget && npm install && npm run generate && cd ..
```

## Managing admin accounts

There is no self-registration and no in-app admin management — accounts are
only ever created or removed from the server, by whoever holds the operator
identity (`SITE_FEED_OWNER_IDENTITY`). Two interactive scripts, built on
[`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) (the
same prompt library used by npm, Vite, and most other Node CLIs) for masked
password input, wrap the underlying `spacetime call`/`spacetime sql` commands
so you don't have to hand-quote JSON:

```bash
cd scripts && npm install && cd ..
```

```bash
cd scripts

# Add a new admin (prompts for username, then a masked password + confirmation)
node add-admin.mjs

# List existing admins and optionally delete one (prompts for confirmation
# by typing the exact username before deleting)
node manage-admins.mjs
```

Both scripts default to the `site-feed` database name and whatever server the
`spacetime` CLI is currently configured against (see `spacetime server list`).
Override the database name with `SITE_FEED_DB=other-name node add-admin.mjs`
if you ever publish under a different name.

### Web serial publishers

Publishers are managed from the `/admin/` browser console after an admin logs in:
`createPublisher()`, `deletePublisher()` and `auditAccounts()` (every account, with
role, post count and active sessions). Admins and publishers share one `accounts`
table, so usernames are unique across both. A publisher who logs in at `/admin/`
is shown a link to `/publisher/` instead of the admin portal.

All passwords are 12-72 characters and hashed with Argon2.

## Admin app

```bash
cd admin
npm install
npm run dev       # http://localhost:5173, connects to ws://localhost:3000
```

Production build + serve:

```bash
npm run build
npx serve -s dist -l 8082
```

Or install `site-feed-admin.service` as a systemd unit (see that file in
this folder) and reverse-proxy `/admin/` to `localhost:8082`, following the
same pattern as `/picto-forum/` and `/graffiti-together/`.

## Widget (homepage feed)

```bash
cd widget
npm install
npm run build
```

Then copy the build output into the site root so `index.html` can load it:

```bash
cp dist/feed-widget.js ../../feed-widget.js
```

Re-run this copy step (and bump the `?v=` query string in `index.html`)
whenever the widget changes. The widget has no server-side dependency beyond
the shared SpacetimeDB instance — it's a static file like `script.js` or
`waves.js`.

## Remote Deployment

When deploying to a remote server, the widget and admin app both pick their
connection URI automatically: `ws://localhost:3000` when running on
`localhost`, otherwise `wss://grem.studio/spacetimedb/`. No code changes
needed for a normal deploy to `grem.studio`; if you fork this to a different
host, update `SPACETIMEDB_URI` in `widget/src/feed-widget.ts` and
`admin/src/context/SpacetimeContext.tsx`.

### Quick start (all-in-one)

```bash
export SITE_FEED_OWNER_IDENTITY=<your identity hex>
cd server/spacetimedb
spacetime publish site-feed
cd ../..

cd scripts && npm install && cd ..
node scripts/add-admin.mjs

cd admin && npm install && npm run generate && npm run build && cd ..
cd widget && npm install && npm run generate && npm run build && cd ..
cp widget/dist/feed-widget.js ../feed-widget.js

npx serve -s admin/dist -l 8082
```
