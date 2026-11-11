//! Private revision history for draft and published serial content.

use std::{cmp::Reverse, time::Duration};

use spacetimedb::{ReducerContext, ScheduleAt, SpacetimeType, Table, ViewContext};

use super::{
    can_change_post, draft_rich_documents, find_post, published_rich_documents, require_actor,
    serial_posts, serial_posts__view, Actor, DraftRichDocument, PublishedRichDocument, SerialPost,
};
use crate::accounts::{accounts__view, require_admin, sessions__view};
use crate::now_micros;

const DAY_SECONDS: u64 = 24 * 60 * 60;
const RETENTION_MICROS: u64 = 90 * DAY_SECONDS * 1_000_000;
const MAX_REVISIONS: usize = 100;
const MAX_HISTORY_BYTES: u64 = 16 * 1024 * 1024;

// Only metadata goes through the history view. The payload remains private and can be
// restored by ID. Keep it separate so pruning and listing do not load document bodies.
#[spacetimedb::table(name = serial_revisions)]
pub struct SerialRevision {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[index(btree)]
    pub slug: String,
    pub author: String,
    #[index(btree)]
    pub timestamp: u64,
    pub revision: u64,
    pub draft_id: Option<u64>,
    pub parent_revision_id: Option<u64>,
    payload_bytes: u64,
}

#[spacetimedb::table(name = serial_revision_snapshots)]
struct SerialRevisionSnapshot {
    #[primary_key]
    revision_id: u64,
    content: RevisionContent,
}

#[derive(SpacetimeType)]
pub(super) enum RevisionContent {
    Published(PublishedSnapshot),
    Draft(DraftSnapshot),
    DiscardedDraft(u64),
}

#[derive(SpacetimeType)]
pub(super) struct PublishedSnapshot {
    pub(super) title: String,
    pub(super) body: String,
    pub(super) document: Option<String>,
}

impl PublishedSnapshot {
    pub(super) fn from_post(post: &SerialPost, rich: Option<PublishedRichDocument>) -> Self {
        Self {
            title: post.title.clone(),
            body: post.body.clone(),
            document: rich.map(|row| row.document),
        }
    }

    fn apply_to(&self, post: SerialPost) -> SerialPost {
        SerialPost {
            title: self.title.clone(),
            body: self.body.clone(),
            ..post
        }
    }
}

#[derive(SpacetimeType)]
pub(super) struct DraftSnapshot {
    pub(super) draft_id: u64,
    pub(super) document: String,
    pub(super) created_at: u64,
    pub(super) created_by: String,
}

impl From<DraftRichDocument> for DraftSnapshot {
    fn from(draft: DraftRichDocument) -> Self {
        Self {
            draft_id: draft.draft_id,
            document: draft.document,
            created_at: draft.created_at,
            created_by: draft.created_by,
        }
    }
}

impl DraftSnapshot {
    pub(super) fn row(&self, post_slug: String) -> DraftRichDocument {
        DraftRichDocument {
            post_slug,
            draft_id: self.draft_id,
            document: self.document.clone(),
            created_at: self.created_at,
            created_by: self.created_by.clone(),
        }
    }
}

impl RevisionContent {
    fn draft_id(&self) -> Option<u64> {
        match self {
            Self::Published(_) => None,
            Self::Draft(draft) => Some(draft.draft_id),
            Self::DiscardedDraft(id) => Some(*id),
        }
    }

    fn payload_bytes(&self) -> u64 {
        (match self {
            Self::Published(post) => {
                post.title.len() + post.body.len() + post.document.as_ref().map_or(0, String::len)
            }
            Self::Draft(draft) => draft.document.len(),
            Self::DiscardedDraft(_) => 0,
        }) as u64
    }
}

/// The chapter revision survives pruning. An old client token can never match again
/// just because all snapshots for the chapter expired.
#[spacetimedb::table(name = serial_revision_heads)]
pub struct SerialRevisionHead {
    #[primary_key]
    pub slug: String,
    #[index(btree)]
    pub revision: u64,
    last_snapshot_id: u64,
}

#[spacetimedb::table(name = serial_revision_expiry, scheduled(expire_serial_revisions))]
pub struct SerialRevisionExpiry {
    #[primary_key]
    scheduled_id: u64,
    scheduled_at: ScheduleAt,
}

#[derive(SpacetimeType)]
pub struct SerialRevisionInfo {
    pub id: u64,
    pub slug: String,
    pub author: String,
    pub timestamp: u64,
    pub revision: u64,
    pub draft_id: Option<u64>,
    pub parent_revision_id: Option<u64>,
}

#[derive(SpacetimeType)]
pub struct SerialRevisionVersion {
    pub slug: String,
    pub revision: u64,
}

fn history_actor(ctx: &ViewContext) -> Option<Actor> {
    let session = ctx.db.sessions().identity().find(ctx.sender)?;
    let account = ctx.db.accounts().username().find(&session.username)?;
    Some(Actor {
        username: account.username,
        is_admin: account.is_admin,
    })
}

fn visible_chapters(ctx: &ViewContext) -> Vec<SerialRevisionVersion> {
    let Some(actor) = history_actor(ctx) else {
        return Vec::new();
    };
    let heads = ctx.db.serial_revision_heads();
    let posts = ctx.db.serial_posts();
    if actor.is_admin {
        return heads
            .revision()
            .filter(1u64..)
            .filter_map(|head| {
                let post = posts.slug().find(&head.slug)?;
                can_access_history(&actor, &post).then_some(SerialRevisionVersion {
                    slug: head.slug,
                    revision: head.revision,
                })
            })
            .collect();
    }
    posts
        .created_by()
        .filter(&actor.username)
        .filter(|post| can_access_history(&actor, post))
        .map(|post| {
            let revision = heads
                .slug()
                .find(&post.slug)
                .map_or(0, |head| head.revision);
            SerialRevisionVersion {
                slug: post.slug,
                revision,
            }
        })
        .collect()
}

#[spacetimedb::view(name = my_serial_revision_heads, public)]
fn my_serial_revision_heads(ctx: &ViewContext) -> Vec<SerialRevisionVersion> {
    visible_chapters(ctx)
}

#[spacetimedb::view(name = my_serial_revisions, public)]
fn my_serial_revisions(ctx: &ViewContext) -> Vec<SerialRevisionInfo> {
    let chapters = visible_chapters(ctx);
    let revisions = ctx.db.serial_revisions();
    chapters
        .iter()
        .flat_map(|chapter| revisions.slug().filter(&chapter.slug))
        .map(|row| SerialRevisionInfo {
            id: row.id,
            slug: row.slug,
            author: row.author,
            timestamp: row.timestamp,
            revision: row.revision,
            draft_id: row.draft_id,
            parent_revision_id: row.parent_revision_id,
        })
        .collect()
}

fn can_access_history(actor: &Actor, post: &SerialPost) -> bool {
    can_change_post(actor.is_admin, &actor.username, &post.created_by)
}

fn head_revision(ctx: &ReducerContext, slug: &String) -> u64 {
    ctx.db
        .serial_revision_heads()
        .slug()
        .find(slug)
        .map_or(0, |head| head.revision)
}

fn next_revision(current: u64) -> Result<u64, String> {
    current
        .checked_add(1)
        .ok_or_else(|| "Chapter revision limit reached".into())
}

fn check_expected_revision(current: u64, expected: u64) -> Result<(), String> {
    if expected != current {
        return Err(format!(
            "Revision mismatch: expected {expected}, current revision is {current}"
        ));
    }
    Ok(())
}

fn expiry_cutoff(now: u64) -> u64 {
    now.saturating_sub(RETENTION_MICROS)
}

fn excess_revisions(mut revisions: Vec<SerialRevision>, now: u64) -> Vec<u64> {
    revisions.sort_unstable_by_key(|row| Reverse(row.revision));
    let mut bytes = 0u64;
    let mut count = 0;
    revisions
        .into_iter()
        .filter_map(|row| {
            if row.timestamp < expiry_cutoff(now) {
                return Some(row.id);
            }
            count += 1;
            bytes = bytes.saturating_add(row.payload_bytes);
            (count > MAX_REVISIONS || bytes > MAX_HISTORY_BYTES).then_some(row.id)
        })
        .collect()
}

fn delete_snapshots(ctx: &ReducerContext, ids: Vec<u64>) {
    for id in ids {
        ctx.db.serial_revision_snapshots().revision_id().delete(id);
        ctx.db.serial_revisions().id().delete(id);
    }
}

fn expire_snapshots(ctx: &ReducerContext) {
    let expired = ctx
        .db
        .serial_revisions()
        .timestamp()
        .filter(..expiry_cutoff(now_micros(ctx)))
        .map(|row| row.id)
        .collect();
    delete_snapshots(ctx, expired);
}

#[spacetimedb::reducer]
pub fn prune_old_revisions(ctx: &ReducerContext) -> Result<(), String> {
    require_admin(ctx)?;
    expire_snapshots(ctx);
    Ok(())
}

#[spacetimedb::reducer]
fn expire_serial_revisions(
    ctx: &ReducerContext,
    _schedule: SerialRevisionExpiry,
) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        return Err("Only the database scheduler can expire serial revisions".into());
    }
    expire_snapshots(ctx);
    Ok(())
}

pub(super) fn clear_history(ctx: &ReducerContext, slug: &String) {
    let ids = ctx
        .db
        .serial_revisions()
        .slug()
        .filter(slug)
        .map(|row| row.id)
        .collect();
    delete_snapshots(ctx, ids);
    ctx.db.serial_revision_heads().slug().delete(slug);
}

/// Capture a chapter or draft that already existed before history was enabled.
/// The recorded time is when we captured the baseline.
pub(super) fn record_baseline(
    ctx: &ReducerContext,
    slug: &String,
    author: &str,
    content: RevisionContent,
) -> Result<(), String> {
    let cutoff = expiry_cutoff(now_micros(ctx));
    let has_history = ctx
        .db
        .serial_revisions()
        .slug()
        .filter(slug)
        .any(|row| row.draft_id == content.draft_id() && row.timestamp >= cutoff);
    if !has_history && content.payload_bytes() <= MAX_HISTORY_BYTES {
        record_revision(ctx, slug, author, content)?;
    }
    Ok(())
}

fn restored_revision(
    source: &SerialRevision,
    author: &str,
    now: u64,
    current: u64,
) -> Result<SerialRevision, String> {
    Ok(SerialRevision {
        id: 0,
        slug: source.slug.clone(),
        author: author.to_owned(),
        timestamp: now,
        revision: next_revision(current)?,
        draft_id: source.draft_id,
        parent_revision_id: Some(source.id),
        payload_bytes: source.payload_bytes,
    })
}

fn insert_revision(ctx: &ReducerContext, revision: SerialRevision, content: RevisionContent) {
    let revision = ctx.db.serial_revisions().insert(revision);
    ctx.db
        .serial_revision_snapshots()
        .insert(SerialRevisionSnapshot {
            revision_id: revision.id,
            content,
        });
    let heads = ctx.db.serial_revision_heads().slug();
    let head = SerialRevisionHead {
        slug: revision.slug.clone(),
        revision: revision.revision,
        last_snapshot_id: revision.id,
    };
    if heads.find(&revision.slug).is_some() {
        heads.update(head);
    } else {
        ctx.db.serial_revision_heads().insert(head);
    }
    let candidates = ctx
        .db
        .serial_revisions()
        .slug()
        .filter(&revision.slug)
        .collect();
    delete_snapshots(ctx, excess_revisions(candidates, revision.timestamp));

    // An additive publish does not rerun init. Start the singleton timer on the first write.
    let schedules = ctx.db.serial_revision_expiry();
    if schedules.scheduled_id().find(1u64).is_none() {
        schedules.insert(SerialRevisionExpiry {
            scheduled_id: 1,
            scheduled_at: Duration::from_secs(DAY_SECONDS).into(),
        });
    }
}

pub(super) fn record_revision(
    ctx: &ReducerContext,
    slug: &String,
    author: &str,
    content: RevisionContent,
) -> Result<(), String> {
    let head = ctx.db.serial_revision_heads().slug().find(slug);
    let current = head.as_ref().map_or(0, |head| head.revision);
    let row = SerialRevision {
        id: 0,
        slug: slug.clone(),
        author: author.to_owned(),
        timestamp: now_micros(ctx),
        revision: next_revision(current)?,
        draft_id: content.draft_id(),
        parent_revision_id: head.map(|head| head.last_snapshot_id),
        payload_bytes: content.payload_bytes(),
    };
    insert_revision(ctx, row, content);
    Ok(())
}

#[spacetimedb::reducer]
pub fn restore_serial_post(
    ctx: &ReducerContext,
    slug: String,
    revision_id: u64,
    expected_revision: u64,
) -> Result<(), String> {
    let actor = require_actor(ctx)?;
    let post = find_post(ctx, &slug)?;
    if !can_access_history(&actor, &post) {
        return Err("Only the author or an admin can restore revisions".into());
    }
    let current = head_revision(ctx, &post.slug);
    check_expected_revision(current, expected_revision)?;
    let now = now_micros(ctx);
    let source = ctx
        .db
        .serial_revisions()
        .id()
        .find(revision_id)
        .filter(|row| row.slug == post.slug && row.timestamp >= expiry_cutoff(now))
        .ok_or_else(|| "Revision not found".to_string())?;
    let snapshot = ctx
        .db
        .serial_revision_snapshots()
        .revision_id()
        .find(source.id)
        .ok_or_else(|| "Revision snapshot not found".to_string())?;
    let revision = restored_revision(&source, &actor.username, now, current)?;

    match &snapshot.content {
        RevisionContent::Published(published) => {
            ctx.db
                .serial_posts()
                .slug()
                .update(published.apply_to(post));
            let documents = ctx.db.published_rich_documents();
            if let Some(document) = &published.document {
                let row = PublishedRichDocument {
                    slug: source.slug.clone(),
                    document: document.clone(),
                    last_modified: now,
                    modified_by: actor.username,
                };
                if documents.slug().find(&source.slug).is_some() {
                    documents.slug().update(row);
                } else {
                    documents.insert(row);
                }
            } else {
                documents.slug().delete(&source.slug);
            }
        }
        RevisionContent::Draft(draft) => {
            let drafts = ctx.db.draft_rich_documents();
            let row = draft.row(source.slug);
            if drafts.post_slug().find(&row.post_slug).is_some() {
                drafts.post_slug().update(row);
            } else {
                drafts.insert(row);
            }
        }
        RevisionContent::DiscardedDraft(draft_id) => {
            let drafts = ctx.db.draft_rich_documents();
            if drafts
                .post_slug()
                .find(&source.slug)
                .is_some_and(|row| row.draft_id == *draft_id)
            {
                drafts.post_slug().delete(&source.slug);
            }
        }
    }
    insert_revision(ctx, revision, snapshot.content);
    Ok(())
}
