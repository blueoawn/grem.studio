//! Validate document media and index the assets referenced by published chapters.

use std::collections::BTreeSet;

use spacetimedb::{Identity, ReducerContext, Table};

use super::Actor;
use crate::media::{media_assets, MediaAsset, ASSET_STATUS_READY};
use crate::serial_document::{DocumentNode, SerialDocumentV1};

/// One reference per published chapter and asset, irrespective of how often it
/// appears in the document. These IDs are already in the public document.
#[spacetimedb::table(name = published_media_references, public)]
pub struct PublishedMediaReference {
    #[primary_key]
    key: String,
    #[index(btree)]
    post_slug: String,
    #[index(btree)]
    asset_id: String,
}

#[derive(Clone, Copy)]
enum MediaKind {
    Image,
    Video,
}

impl MediaKind {
    fn matches(self, content_type: &str) -> bool {
        match self {
            Self::Image => content_type.starts_with("image/"),
            Self::Video => content_type.starts_with("video/"),
        }
    }
}

pub(super) fn validate_media_references(
    ctx: &ReducerContext,
    actor: &Actor,
    document: &SerialDocumentV1,
) -> Result<BTreeSet<String>, String> {
    collect_validated_assets(document, ctx.sender, actor.is_admin, |asset_id| {
        ctx.db.media_assets().asset_id().find(asset_id)
    })
}

fn collect_validated_assets(
    document: &SerialDocumentV1,
    caller: Identity,
    is_admin: bool,
    mut lookup: impl FnMut(&String) -> Option<MediaAsset>,
) -> Result<BTreeSet<String>, String> {
    let mut ids = BTreeSet::new();
    visit_media(&document.nodes, &mut |id, kind: MediaKind| {
        let asset = lookup(id).ok_or_else(|| format!("Media asset '{id}' is missing"))?;
        if !is_admin && asset.publisher != caller {
            return Err(format!("Media asset '{id}' belongs to another publisher"));
        }
        if asset.status != ASSET_STATUS_READY {
            return Err(format!("Media asset '{id}' is not ready"));
        }
        if !kind.matches(&asset.content_type) {
            return Err(format!("Media asset '{id}' has the wrong media type"));
        }
        ids.insert(id.clone());
        Ok(())
    })?;
    Ok(ids)
}

fn visit_media(
    nodes: &[DocumentNode],
    visit: &mut impl FnMut(&String, MediaKind) -> Result<(), String>,
) -> Result<(), String> {
    for node in nodes {
        match node {
            DocumentNode::Image(image) => visit(&image.asset_id, MediaKind::Image)?,
            DocumentNode::Video(video) => {
                if video.caption.is_none() && video.transcript_url.is_none() {
                    return Err(format!(
                        "Video '{}' needs a caption or transcript",
                        video.id
                    ));
                }
                visit(&video.asset_id, MediaKind::Video)?;
                if let Some(poster) = &video.poster_asset_id {
                    visit(poster, MediaKind::Image)?;
                }
            }
            DocumentNode::Panel(panel) => visit_media(&panel.children, visit)?,
            _ => (),
        }
    }
    Ok(())
}

fn reference_changes<'a>(
    previous: &'a BTreeSet<String>,
    next: &'a BTreeSet<String>,
) -> (
    impl Iterator<Item = &'a String>,
    impl Iterator<Item = &'a String>,
) {
    (previous.difference(next), next.difference(previous))
}

pub(super) fn replace_media_references(
    ctx: &ReducerContext,
    slug: &String,
    next: BTreeSet<String>,
) {
    let refs = ctx.db.published_media_references();
    let previous = refs
        .post_slug()
        .filter(slug)
        .map(|row| row.asset_id)
        .collect();
    let (release, add) = reference_changes(&previous, &next);
    for id in release {
        refs.key().delete(format!("{slug}:{id}"));
    }
    for id in add {
        refs.insert(PublishedMediaReference {
            key: format!("{slug}:{id}"),
            post_slug: slug.clone(),
            asset_id: id.clone(),
        });
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::{json, Value};

    use super::*;
    use crate::media::{ASSET_STATUS_FAILED, ASSET_STATUS_PROCESSING};

    const AUTHOR: Identity = Identity::from_byte_array([1; 32]);
    const OTHER: Identity = Identity::from_byte_array([2; 32]);

    fn asset(id: &str, publisher: Identity, status: i32, content_type: &str) -> MediaAsset {
        MediaAsset {
            asset_id: id.into(),
            publisher,
            content_type: content_type.into(),
            byte_size: 8,
            storage_key: "private".into(),
            created_at: 0,
            status,
            processed_at: None,
            width: None,
            height: None,
            duration_seconds: None,
            variants: None,
            content_hash: None,
            processing_error: None,
        }
    }

    fn document(nodes: Value) -> SerialDocumentV1 {
        SerialDocumentV1::from_json(&json!({"version": 1, "nodes": nodes}).to_string()).unwrap()
    }

    fn image_document(alt: &str) -> SerialDocumentV1 {
        document(json!([{"type": "image", "id": "illustration", "asset_id": "image", "alt": alt}]))
    }

    fn image_asset(publisher: Identity, status: i32) -> MediaAsset {
        asset("image", publisher, status, "image/png")
    }

    fn validate_image(row: Option<MediaAsset>, is_admin: bool) -> Result<BTreeSet<String>, String> {
        collect_validated_assets(&image_document("A scene"), AUTHOR, is_admin, |id| {
            row.clone().filter(|asset| asset.asset_id == *id)
        })
    }

    #[test]
    fn accepts_owned_ready_image() {
        assert_eq!(
            validate_image(Some(image_asset(AUTHOR, ASSET_STATUS_READY)), false).unwrap(),
            BTreeSet::from(["image".into()])
        );
    }

    #[test]
    fn refuses_missing_image() {
        assert_eq!(
            validate_image(None, false).unwrap_err(),
            "Media asset 'image' is missing"
        );
    }

    #[test]
    fn refuses_foreign_image() {
        assert_eq!(
            validate_image(Some(image_asset(OTHER, ASSET_STATUS_READY)), false).unwrap_err(),
            "Media asset 'image' belongs to another publisher"
        );
    }

    #[test]
    fn refuses_processing_image() {
        assert_eq!(
            validate_image(Some(image_asset(AUTHOR, ASSET_STATUS_PROCESSING)), false).unwrap_err(),
            "Media asset 'image' is not ready"
        );
    }

    #[test]
    fn refuses_failed_image() {
        assert_eq!(
            validate_image(Some(image_asset(AUTHOR, ASSET_STATUS_FAILED)), false).unwrap_err(),
            "Media asset 'image' is not ready"
        );
    }

    #[test]
    fn refuses_deleted_image() {
        let mut assets =
            BTreeMap::from([("image".to_string(), image_asset(AUTHOR, ASSET_STATUS_READY))]);
        assets.remove("image").unwrap();
        let err = collect_validated_assets(&image_document("A scene"), AUTHOR, false, |id| {
            assets.get(id).cloned()
        })
        .unwrap_err();
        assert_eq!(err, "Media asset 'image' is missing");
    }

    #[test]
    fn accepts_foreign_ready_image_for_admin() {
        assert_eq!(
            validate_image(Some(image_asset(OTHER, ASSET_STATUS_READY)), true).unwrap(),
            BTreeSet::from(["image".into()])
        );
    }

    fn validate_video(
        caption: Option<&str>,
        transcript_url: Option<&str>,
    ) -> Result<BTreeSet<String>, String> {
        let doc = document(json!([{"type": "panel", "id": "panel", "children": [{
            "type": "video", "id": "clip", "asset_id": "video", "caption": caption,
            "transcript_url": transcript_url, "poster_asset_id": "image"
        }]}]));
        collect_validated_assets(&doc, AUTHOR, false, |id| match id.as_str() {
            "video" => Some(asset(id, AUTHOR, ASSET_STATUS_READY, "video/mp4")),
            "image" => Some(image_asset(AUTHOR, ASSET_STATUS_READY)),
            _ => None,
        })
    }

    #[test]
    fn accepts_captioned_video_and_tracks_its_poster() {
        assert_eq!(
            validate_video(Some("Waves reach the shore"), None).unwrap(),
            BTreeSet::from(["image".into(), "video".into()])
        );
    }

    #[test]
    fn accepts_video_with_transcript() {
        assert_eq!(
            validate_video(None, Some("https://example.com/transcripts/clip")).unwrap(),
            BTreeSet::from(["image".into(), "video".into()])
        );
    }

    #[test]
    fn refuses_video_without_caption_or_transcript() {
        assert_eq!(
            validate_video(Some("  "), None).unwrap_err(),
            "Video 'clip' needs a caption or transcript"
        );
    }

    #[test]
    fn accepts_explicit_decorative_alt() {
        let ids = collect_validated_assets(&image_document(""), AUTHOR, false, |_| {
            Some(image_asset(AUTHOR, ASSET_STATUS_READY))
        })
        .unwrap();
        assert_eq!(ids, BTreeSet::from(["image".into()]));
        assert!(SerialDocumentV1::from_json(
            r#"{"version":1,"nodes":[{"type":"image","id":"illustration","asset_id":"image"}]}"#
        )
        .is_err());
    }

    fn ids(values: &[&str]) -> BTreeSet<String> {
        values.iter().map(|id| String::from(*id)).collect()
    }

    #[test]
    fn replacement_retains_shared_reference() {
        let mut chapter = ids(&["a", "b"]);
        let next = ids(&["b", "c"]);
        let (release, add) = reference_changes(&chapter, &next);
        let release: Vec<_> = release.cloned().collect();
        let add: Vec<_> = add.cloned().collect();
        assert_eq!(release, ["a"]);
        assert_eq!(add, ["c"]);
        chapter.retain(|id| !release.contains(id));
        chapter.extend(add);
        let second_chapter = ids(&["b"]);
        assert_eq!(chapter, next);
        assert_eq!(
            [chapter, second_chapter]
                .iter()
                .filter(|c| c.contains("b"))
                .count(),
            2
        );
    }

    #[test]
    fn deletion_releases_only_deleted_chapter_references() {
        let mut chapter = ids(&["a", "b"]);
        let empty = ids(&[]);
        let (release, add) = reference_changes(&chapter, &empty);
        assert_eq!(add.count(), 0);
        let release: Vec<_> = release.cloned().collect();
        chapter.retain(|id| !release.contains(id));
        let chapters = [chapter, ids(&["b"])];
        assert_eq!(chapters.iter().filter(|c| c.contains("a")).count(), 0);
        assert_eq!(chapters.iter().filter(|c| c.contains("b")).count(), 1);
    }
}
