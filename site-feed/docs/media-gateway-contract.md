# Media Gateway Contract

## Status

This document defines the contract for the site-feed media gateway. The
gateway provides authenticated, publisher-owned upload intents and publishes
completed uploads as media assets.

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
  intents. Published assets are not removed by revocation.

## Limits

| Limit | Value |
| --- | ---: |
| Upload-intent lifetime | 15 minutes |
| Maximum size of one upload | 100 MiB |
| Maximum published storage per publisher | 1 GiB |

`byte_limit` must be greater than zero and must not exceed 100 MiB. Quota is
calculated from the byte sizes of the publisher's already-published assets
plus the requested `byte_limit`.

## Upload lifecycle

1. The publisher creates an upload intent.
2. The storage layer uploads bytes using the intent's metadata.
3. The client reports the current byte count, optionally more than once for a
   resumable upload.
4. The publisher finalizes the intent with the storage backend key.
5. The gateway creates a public media asset and removes the pending intent.

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

Completes an upload and publishes its media asset.

Requirements:

- The intent must exist and belong to the caller.
- The intent must not be expired.
- `bytes_received` must be greater than zero and no greater than `byte_limit`.
- `storage_key` must identify the object written by the storage layer.

On success, the gateway creates a `media_assets` row containing the intent's
`asset_id`, publisher, content type, and final byte count, plus the supplied
storage key and creation timestamp. The intent is then deleted.

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

Deleting an intent does not delete an object already uploaded to storage and
does not affect published assets.

Possible errors include:

- `Upload intent not found`
- `Not your upload intent`

## Public view

### `my_media_assets`

```text
my_media_assets() -> Vec<MediaAsset>
```

Returns the authenticated publisher's published assets:

```text
MediaAsset {
  asset_id: String,
  publisher: Identity,
  content_type: String,
  byte_size: u64,
  storage_key: String,
  created_at: u64
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
| `asset_id` | string, primary key | Globally unique public asset ID |
| `publisher` | identity, indexed | Publishing owner |
| `content_type` | string | Published media type |
| `byte_size` | unsigned 64-bit integer | Final uploaded size |
| `storage_key` | string | Object-storage key or local path |
| `created_at` | unsigned 64-bit integer | Publication timestamp in microseconds |

## Storage integration requirements

The storage layer must:

- associate the uploaded object with the intent and publisher;
- enforce the intent's `byte_limit` while receiving bytes;
- report the actual stored byte count before finalization;
- avoid publishing an object until `finalize_upload` succeeds;
- treat an intent expiry or deletion as a signal to stop or clean up the
  pending object;
- retain the object at the exact `storage_key` passed to finalization.

The database gateway does not itself stream or delete object-storage bytes.
Storage cleanup for cancelled, expired, or failed uploads is an integration
responsibility.

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

The media tables are created by
`migrations/0000000000000000000000000000000000000001_create_media.sql`.
`media_assets` remains private and is exposed through `my_media_assets`.

For SpacetimeDB 1.12, publish the database migration before adding or
recompiling the `media.rs` module, as described by the migration. Always set
`SITE_FEED_OWNER_IDENTITY` when publishing or rebuilding the site-feed module.

