# Media Gateway Contract

## Status

This document defines the contract for the site-feed media gateway. The
gateway provides authenticated, publisher-owned upload intents and records
completed uploads as media assets pending processing.

The database module is the source of truth for authorization and upload state.
The object-storage service is responsible for transferring bytes and retaining
the object identified by `storage_key`.

## Roles and authorization

- Calls are authorized from the authenticated SpacetimeDB identity
  (`ctx.sender`). A username, publisher identity, or role supplied by a client
  is never trusted.
- A caller must have an active session and a non-admin account to create or
  manage uploads.
- Admin accounts cannot upload media. They must use a publisher account.
- Every upload intent is owned by the publisher identity that created it.
- A publisher may only read or modify its own upload intents and assets.
- The `my_media_assets` view returns no assets for an admin account.
- Revoking a publisher removes that publisher's sessions and pending upload
  intents. Stored assets are retained.
- The storage-side processor uses a dedicated SpacetimeDB identity configured
  at build time as `SITE_FEED_MEDIA_PROCESSOR_IDENTITY`. Upload ownership and
  admin privileges do not confer processor access.

## Limits

| Limit | Value |
| --- | ---: |
| Upload-intent lifetime | 15 minutes |
| Maximum size of one upload | 100 MiB |
| Maximum stored bytes per publisher | 1 GiB |
| Maximum image width and height for processing | 8192 pixels each |
| Maximum video duration for processing | 3600 seconds |

`byte_limit` must be greater than zero and must not exceed 100 MiB. Quota is
calculated from the byte sizes of the publisher's stored assets
plus the requested `byte_limit`.

## Upload lifecycle

1. The publisher creates an upload intent.
2. The storage layer uploads bytes using the intent's metadata.
3. The client reports the current byte count, optionally more than once for a
   resumable upload.
4. The publisher finalizes the intent with the storage backend key.
5. The gateway creates a pending media asset and removes the upload intent.
6. The storage-side processor reports `Processing`, inspects the stored bytes,
   writes the variants, and reports `Ready` or `Failed`.
7. Ready assets become eligible for published references. The public gateway
   checks published references before serving bytes.

An intent expires 15 minutes after creation. Expiry is enforced whenever the
intent is progressed or finalized; expired intents cannot be used.

## Reducer contract

### `create_upload_intent`

```text
create_upload_intent(
  intent_key,
  asset_id,
  filename,
  content_type,
  byte_limit
) -> Result<(), String>
```

Creates a pending upload intent for the authenticated publisher.

Requirements:

- The caller must be a logged-in, non-admin publisher.
- `intent_key` must be unique, unless it already belongs to the caller. A
  retry using the same key and caller is idempotent and returns success without
  modifying the existing intent.
- `asset_id` is the globally unique identifier of the eventual asset.
- `filename` and `content_type` describe the upload.
- `byte_limit` must satisfy the limits above.
- The publisher's quota must permit the requested limit.

Possible errors include:

- `Must be logged in as a publisher`
- `Admins cannot upload media; use a publisher account`
- `Byte limit must be between 1 and 100 MB`
- `Intent key already in use by another publisher`
- `Publisher quota exceeded`

### `upload_progress`

```text
upload_progress(intent_key, bytes_received) -> Result<(), String>
```

Reports the number of bytes successfully stored for a pending intent.

Requirements:

- The intent must exist.
- The caller must own the intent.
- The intent must not be expired.
- `bytes_received` must not exceed `byte_limit`.

Progress may be reported repeatedly. The recorded value is replaced by the
latest value.

Possible errors include:

- `Upload intent not found`
- `Not your upload intent`
- `Upload intent expired`
- `Upload exceeds byte limit`

### `finalize_upload`

```text
finalize_upload(intent_key, storage_key) -> Result<(), String>
```

Completes an upload and registers its media asset for processing.

Requirements:

- The intent must exist and belong to the caller.
- The intent must not be expired.
- `bytes_received` must be greater than zero and no greater than `byte_limit`.
- `storage_key` must identify the object written by the storage layer.

On success, the gateway creates a `media_assets` row containing the intent's
`asset_id`, publisher, content type, and final byte count, plus the supplied
storage key and creation timestamp. The new asset status is `0` (pending),
and the intent is deleted.

`asset_id` is globally unique. If an asset with that ID already exists,
finalization does not create a duplicate asset; the pending intent is still
removed.

Possible errors include:

- `Upload intent not found`
- `Not your upload intent`
- `Upload intent expired`
- `Invalid uploaded byte count`

### `delete_upload_intent`

```text
delete_upload_intent(intent_key) -> Result<(), String>
```

Cancels and removes a pending upload intent.

Requirements:

- The intent must exist.
- The caller must own the intent.

Object-storage cleanup is the storage service's responsibility. The reducer
only removes the intent metadata.

Possible errors include:

- `Upload intent not found`
- `Not your upload intent`

### `report_media_processing_result`

```text
report_media_processing_result(asset_id, result) -> Result<(), String>

result = Processing | Ready(ReadyMedia) | Failed(reason: String)

ReadyMedia {
  width: Option<u32>,
  height: Option<u32>,
  duration_seconds: Option<u32>,
  variants: Vec<MediaVariant>,
  sha256: Option<String>
}

MediaVariant {
  kind: Thumbnail | Poster | Deliverable,
  path: String,
  content_type: String,
  byte_size: u64
}
```

Only the configured processor can call this reducer. It reports `Processing`
before starting work. Then it sends a result for the asset identified by
`asset_id`. A ready image requires both dimensions and a thumbnail. A ready
video requires a duration, a poster, and an MP4 or WebM deliverable. Both
require a 64-character hexadecimal SHA-256 digest. Image formats are JPEG,
PNG, GIF, and WebP. Each variant supplies a unique relative storage path, a
content type matching its role, and a nonzero byte count. Path segments may
contain ASCII letters, digits, dots, dashes, and underscores, except for the
special segments `.` and `..`.

A ready report with missing or invalid metadata records a failed asset with
reason `incomplete_metadata`. A failure report records its error code, for
example `malformed` or `too_large`. The processor sends lowercase error codes
using ASCII letters and underscores so it does not store processor logs,
credentials, or object contents in the media registry.

The reducer records the database timestamp when accepting the first terminal
result. An identical terminal retry leaves the row unchanged. Variant order
and digest letter case are normalized before comparison. A different terminal
result is rejected, including a change to the SHA-256 or variant metadata.

### `cleanup_expired_upload_intents`

The configured processor may call `cleanup_expired_upload_intents()` to
delete intent metadata whose `expires_at` is at or before the database
timestamp. Object storage uses the same expiry deadline for its own cleanup.

## Publisher view

### `my_media_assets`

```text
my_media_assets() -> Vec<MediaAsset>
```

Returns the authenticated publisher's stored assets and processing status:

```text
MediaAsset {
  asset_id: String,
  publisher: Identity,
  content_type: String,
  byte_size: u64,
  storage_key: String,
  created_at: u64,
  status: i32,
  processed_at: Option<u64>,
  width: Option<u32>,
  height: Option<u32>,
  duration_seconds: Option<u32>,
  variants: Option<Vec<MediaVariant>>,
  content_hash: Option<String>,
  processing_error: Option<String>
}
```

The raw `media_assets` table is private. Consumers must use this typed view.
Admins receive an empty result.

## Data model

### `upload_intents`

| Field | Type | Meaning |
| --- | --- | --- |
| `intent_key` | string, primary key | Client-generated pending-upload key |
| `publisher` | identity, indexed | Owning publisher |
| `asset_id` | string | Final globally unique asset ID |
| `filename` | string | Original filename |
| `content_type` | string | Declared media type |
| `byte_limit` | unsigned 64-bit integer | Maximum permitted upload size |
| `bytes_received` | unsigned 64-bit integer | Latest reported uploaded size |
| `expires_at` | unsigned 64-bit integer | Expiry timestamp in microseconds |
| `created_at` | unsigned 64-bit integer | Creation timestamp in microseconds |

### `media_assets`

| Field | Type | Meaning |
| --- | --- | --- |
| `asset_id` | string, primary key | Globally unique asset ID |
| `publisher` | identity, indexed | Owning publisher |
| `content_type` | string | Declared media type validated by the processor |
| `byte_size` | unsigned 64-bit integer | Final uploaded size |
| `storage_key` | string | Object-storage key or local path |
| `created_at` | unsigned 64-bit integer | Finalization timestamp in microseconds |
| `status` | signed 32-bit integer | 0 pending, 1 processing, 2 ready, 3 failed |
| `processed_at` | optional unsigned 64-bit integer | Completion timestamp in microseconds |
| `width`, `height` | optional unsigned 32-bit integers | Image dimensions |
| `duration_seconds` | optional unsigned 32-bit integer | Video duration |
| `variants` | optional list of `MediaVariant` | Verified derivative objects |
| `content_hash` | optional string | Lowercase SHA-256 digest |
| `processing_error` | optional string | Short failure code |

`public_url_for(asset)` produces the stable gateway path `/media/<asset_id>`
only when the asset is ready and its ID uses the serial document's asset-ID
format. The helper checks processing readiness. Before returning or serving
that path, public readers must go through a gateway that checks for a
published reference.

## Published chapter references

Publishing, replacing, or restoring a rich chapter validates every image,
video, and explicit video poster ID, including media nested inside panels.
Assets must be ready and match the node's media type. A publisher can use
assets owned by the calling identity. Admins can also use another publisher's
ready assets. Videos need a caption or HTTP(S) transcript link. Images need
an `alt` field, with an empty value reserved for decorative art.

`published_media_references` contains one `(post_slug, asset_id)` pair per
published chapter using an asset. Each asset's reference count is the number
of its rows. The gateway can check that an asset has at least one row before
serving it. The table holds only IDs present in public chapters. It carries
no storage keys, rendition paths, publisher identities, or draft references.
Publishing and restoring update the rows in the same reducer transaction as
the chapter. Removing a chapter or restoring its legacy-only revision removes
its rows. Other chapters' references are preserved.

Adding the table preserves existing data. A chapter published before this
index existed acquires its rows when an authorized publisher or admin saves
it through the rich publication path. Audit and republish any such chapters
that use media before requiring the index for public delivery. Regenerate
bindings for clients that read the new table.

## Storage integration requirements

The storage layer must:

- associate the uploaded object with the intent and publisher;
- enforce the intent's `byte_limit` while receiving bytes;
- report the actual stored byte count before finalization;
- keep uploaded and variant objects private until an authorized gateway
  serves them;
- treat an intent expiry or deletion as a signal to stop or clean up the
  pending object;
- retain the object at the exact `storage_key` passed to finalization.

The database gateway does not itself stream or delete object-storage bytes.
Storage cleanup for cancelled, expired, or failed uploads is an integration
responsibility.

### Running the storage-side processor

`site-feed/media-processor` handles one finalized upload at a time. Install
dependencies with `npm ci` in that directory. Run with Node.js 22 and `ffmpeg`
and `ffprobe` on PATH. FFmpeg must be able to decode the allowed input formats
and provide the `libx264` and AAC encoders for MP4 output.

```sh
node cli.mjs <asset-id> <storage-key> <content-type>
```

The worker reads `SITE_FEED_SERVER`, `SITE_FEED_DATABASE`,
`SITE_FEED_PROCESSOR_TOKEN`, and `SITE_FEED_STORAGE_ROOT` from its environment.
The token must belong to the dedicated processor identity. Keep the root private
to trusted storage processes. The built-in adapter uses relative storage keys
and requires immutable finalized uploads and a filesystem with hard-link
support. A queue or storage service can also import `processMedia` from
`processor.mjs`, supply its own `size`, bounded `read` and `putVariantIfAbsent`
storage methods, and reuse `spacetimeReporter` from `spacetime.mjs`.

The processor checks the storage size before opening the upload and hashes bytes
while copying at most 100 MiB to working storage. It checks declared media type
against the signature and runs the appropriate decoder. Images produce an
orientation-correct WebP thumbnail with a 256-pixel maximum side. Videos have a
maximum size of 8192 pixels per side and a maximum duration of 3600 seconds.
They produce a JPEG poster and a browser-compatible deliverable. The worker
encodes MP4 as H.264 with AAC audio when present, and remuxes WebM with VP8, VP9
or AV1 video and optional Opus/Vorbis audio. Fractional video durations are
rounded up after enforcing the limit.

Variants are written privately at `variants/media-v1/<sha256>/<filename>` only
after the derivative set has been generated. The storage adapter creates a
complete object at each key only if it is absent and returns the persisted byte
count. This allows retries after partial writes and concurrent workers handling
identical uploads to reuse the same objects. A worker that loses its connection
after the terminal report can send the same result again for the reducer to
compare. Decoder failures produce a short failure code. Temporary I/O, tool,
or database failures are returned to the queue as errors and leave the asset
in processing for retry. The caller schedules retries and storage cleanup.

### Local storage worker and HTTP delivery

Run `node service.mjs` with the same environment as the single-job CLI.
The service binds to loopback on `SITE_FEED_MEDIA_PORT` (8080 by default). Route
`/media/` to it from the site's HTTP proxy. The service polls `media_processing_jobs`
every five seconds and processes pending or interrupted jobs. Transient errors
delay retries for 60 seconds within the running process. After a restart, any
job still in processing can retry immediately. A crash before the final report
keeps the objects private.

Only a trusted upload service should write to the private root. The polling
worker expects immutable originals at `uploads/<publisher-identity-hex>/<asset-id>`.
Use lowercase hex without a prefix. Move finalized bytes there before reporting
progress and finalizing the intent. Migrate older local objects to that layout
and reconcile their stored keys before enabling the polling worker. A job whose
stored key differs from its publisher's canonical key fails with
`invalid_storage_key`. The worker compares the recorded size with the actual
size. For partial uploads, use `partial-uploads/<expiry-unix-ms>-<uuid>.part`
with the intent expiration rounded up to milliseconds. The worker deletes
expired staging files and calls the module to expire intent metadata. Upload
handlers should stop writing at the intent deadline.

The worker and delivery views return rows only to the configured processor.
Delivery checks the ready view and the `published_media_references` index before
opening private storage. Public paths are `/media/<asset-id>` for the source
image or browser video and the `/thumbnail`, `/poster`, or `/deliverable`
subpath for a variant. Responses support `HEAD` and single byte ranges. Removing
the last publication reference removes public access.

### Local verification

Run with Node 22, Cargo with the Wasm target, and FFmpeg/FFprobe on PATH.
Start a disposable SpacetimeDB 1.12 instance on `127.0.0.1:3000` or set
`SITE_FEED_TEST_URL` to its loopback URL. Run from the repository root:

```sh
npm --prefix site-feed/media-processor ci
node --test site-feed/scripts/test-media-processing.mjs
npm --prefix site-feed/media-processor run test:processor
```

The configured Gantry command `media-processor-test` runs both suites via
`npm --prefix site-feed/media-processor test`. The integration suite builds
and publishes the module with throwaway owner and processor identities, then
exercises finalized objects and HTTP delivery against real storage and database
state. The oversized case injects a 101 MiB object after B1 finalization to
exercise the storage-side limit independently of the upload byte-count cap.

## Failure and retry behavior

- Retrying `create_upload_intent` with the same `intent_key` from the same
  publisher is safe and idempotent.
- Progress updates are replace operations, so clients may retry the latest
  value.
- A client must obtain a new intent after expiry.
- A client must not reuse an `intent_key` owned by another publisher.
- Finalization should only be attempted after the storage layer has completed
  the upload and the final byte count has been reported.

## Deployment and migration

For existing SpacetimeDB 1.12 databases, publishing the module adds the
processing columns at the end of `media_assets` with explicit defaults and
adds an expiry index on `upload_intents` when upgrading from the B1 schema.
This integration also adds a status index and two processor-only views for jobs
and delivery. Existing asset rows and their
original metadata are preserved. Existing assets start pending and must be
processed before the readiness helper can return a URL. The publisher view
gains the new fields, so regenerate and deploy client bindings with the module.

Set both `SITE_FEED_OWNER_IDENTITY` and
`SITE_FEED_MEDIA_PROCESSOR_IDENTITY` in the build environment before publishing.
Use the processor's dedicated identity hex value for the latter. If that
value is absent, invalid, or zero, processing reducers reject every call.

