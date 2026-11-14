//! # SerialDocumentV1 — versioned, server-validated rich document format
//!
//! A stable content model for web-serial chapters that represents paragraphs with inline
//! marks, rotated text lines, image/video asset references, sized minigame embeds, and
//! optional scene/panel groupings — using **typed, bounded fields** rather than arbitrary
//! style/HTML strings.
//!
//! This module is pure data plus validation. It adds **no tables, no reducers, and no
//! rendering**, and it does **not** touch the existing plain-text `serial_posts` contract
//! (issue A1). It is the shared contract consumed by the future publisher (write) and
//! reader (read) clients (issues A2–A3) and by the public renderer (C-series).
//!
//! ## Wire format
//!
//! A `SerialDocumentV1` is a JSON object:
//!
//! ```json
//! {
//!   "version": 1,
//!   "nodes": [ /* ordered DocumentNode values, in reading order */ ]
//! }
//! ```
//!
//! Each `DocumentNode` is an internally-tagged object whose `"type"` field selects the
//! variant: `paragraph`, `rotatedText`, `image`, `video`, `gameEmbed`, or `panel`. Every
//! node carries a stable `id` that is **unique across the whole document** (including
//! nested panels) and is never altered by validation. Reading order is the top-level node
//! order; a `panel`'s `children` contribute a nested reading order.
//!
//! ## Determinism & normalization
//!
//! [`SerialDocumentV1::from_json`] trims text fields, rejects control characters, and
//! enforces every bound. [`SerialDocumentV1::to_json`] serializes the *normalized*
//! document using fixed field order, so the same logical document always produces the same
//! bytes. [`SerialDocumentV1::plain_text`] yields a normalized plain-text projection in
//! reading order that retains meaningful text and accessibility labels.
//!
//! ## Security
//!
//! There is **no field for raw HTML, CSS, or JavaScript**. URLs must be `http(s)`;
//! identifiers use a restricted charset (`a-z`, `A-Z`, `0-9`, `-`, `_`); and text fields
//! are screened for executable markup tokens. See the bounds table in
//! `docs/serial-document-v1.md`.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fmt;

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/// The only document version this server currently reads and writes.
pub const SUPPORTED_VERSION: u32 = 1;
/// Maximum number of top-level nodes.
pub const MAX_TOP_LEVEL_NODES: usize = 200;
/// Maximum total number of nodes (including nested panel children).
pub const MAX_TOTAL_NODES: usize = 500;
/// Maximum panel nesting depth (a top-level panel is depth 1).
pub const MAX_PANEL_DEPTH: usize = 8;
/// Maximum inline runs per text block (paragraph / rotated text).
pub const MAX_RUNS_PER_BLOCK: usize = 200;
/// Maximum UTF-8 byte length of a single text block.
pub const MAX_BLOCK_TEXT_BYTES: usize = 10_000;
/// Maximum UTF-8 byte length of all text in the document.
pub const MAX_TOTAL_TEXT_BYTES: usize = 200_000;
/// Maximum UTF-8 byte length of the serialized document.
pub const MAX_DOCUMENT_BYTES: usize = 1_000_000;
/// Maximum UTF-8 byte length of a node id.
pub const MAX_NODE_ID_BYTES: usize = 128;
/// Maximum UTF-8 byte length of an asset id (image / video).
pub const MAX_ASSET_ID_BYTES: usize = 128;
/// Maximum UTF-8 byte length of a game-embed registry id.
pub const MAX_EMBED_ID_BYTES: usize = 128;
/// Maximum UTF-8 byte length of a URL.
pub const MAX_URL_BYTES: usize = 500;
/// Maximum UTF-8 byte length of a short text field (alt, caption, label, title, link text).
pub const MAX_TEXT_FIELD_BYTES: usize = 500;
/// Maximum number of parameters on a game embed.
pub const MAX_EMBED_PARAMS: usize = 16;
/// Maximum UTF-8 byte length of an embed parameter key.
pub const MAX_EMBED_PARAM_KEY_BYTES: usize = 64;
/// Maximum UTF-8 byte length of an embed parameter value.
pub const MAX_EMBED_PARAM_VALUE_BYTES: usize = 256;
/// Maximum absolute rotation, in whole degrees (range is `[-180, 180]`).
pub const MAX_ROTATION_DEGREES: i16 = 180;
/// Minimum display dimension in device-independent units.
pub const MIN_DIMENSION_UNITS: u16 = 1;
/// Maximum display dimension in device-independent units.
pub const MAX_DIMENSION_UNITS: u16 = 4096;

/// Substrings (matched case-insensitively) that mark a text field as executable content.
///
/// The format has no HTML/JS surface; this is a defensive screen on free-text fields so
/// that a script-bearing payload fails loudly rather than being persisted as inert text.
pub const DENY_TOKENS: &[&str] = &[
    "javascript:",
    "vbscript:",
    "data:text/html",
    "<script",
    "<iframe",
    "<object",
    "<embed",
];

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/// A versioned rich document for a serial chapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SerialDocumentV1 {
    /// Bumped when the wire format changes incompatibly. Must equal [`SUPPORTED_VERSION`].
    pub version: u32,
    /// Top-level nodes, in reading order.
    pub nodes: Vec<DocumentNode>,
}

/// A single node in reading order. Internally tagged by `"type"`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DocumentNode {
    Paragraph(Paragraph),
    RotatedText(RotatedText),
    Image(Image),
    Video(Video),
    GameEmbed(GameEmbed),
    Panel(Panel),
}

/// A paragraph of text made of inline runs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Paragraph {
    pub id: String,
    pub runs: Vec<InlineRun>,
}

/// A line of text rendered at a bounded rotation angle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RotatedText {
    pub id: String,
    pub runs: Vec<InlineRun>,
    /// Signed rotation in whole degrees, within `[-180, 180]`.
    pub rotation: i16,
    /// Horizontal alignment of the line.
    #[serde(default)]
    pub alignment: TextAlignment,
    /// Motion-safe / accessible alternative read when rotation is unsupported.
    pub alt: Option<String>,
}

/// A reference to a published image asset (by id, never a raw URL in A1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Image {
    pub id: String,
    /// Reference to a published media asset.
    pub asset_id: String,
    /// Alt text; empty string for a decorative image.
    pub alt: String,
    /// Optional caption.
    pub caption: Option<String>,
    /// Optional display width in device-independent units.
    pub width: Option<u16>,
    /// Optional display height in device-independent units.
    pub height: Option<u16>,
}

/// A reference to a published video asset (by id, never a raw URL in A1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Video {
    pub id: String,
    /// Reference to a published media asset.
    pub asset_id: String,
    /// Optional poster image asset.
    pub poster_asset_id: Option<String>,
    /// Optional caption. Existing documents may use this for transcript text.
    pub caption: Option<String>,
    /// Optional HTTP(S) link to a transcript.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_url: Option<String>,
    /// Optional display width in device-independent units.
    pub width: Option<u16>,
    /// Optional display height in device-independent units.
    pub height: Option<u16>,
}

/// An allowlisted key/value parameter for a game embed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EmbedParam {
    pub key: String,
    pub value: String,
}

/// A sized reference to an approved minigame (by registry id, never a raw URL/iframe).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameEmbed {
    pub id: String,
    /// Approved registry id, resolved to an origin/path policy elsewhere.
    pub embed_id: String,
    /// Display width in device-independent units.
    pub width: u16,
    /// Display height in device-independent units.
    pub height: u16,
    /// Accessible title / fallback text shown to non-interactive clients.
    pub title: String,
    /// Allowlisted parameters.
    pub params: Vec<EmbedParam>,
}

/// An optional grouping of nodes into a scene/panel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Panel {
    pub id: String,
    /// Optional label (e.g. "Scene 1").
    pub label: Option<String>,
    /// Child nodes, in reading order. Must not be empty.
    pub children: Vec<DocumentNode>,
}

/// Horizontal alignment for a rotated text line.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextAlignment {
    #[default]
    Left,
    Center,
    Right,
}

/// An inline run of text with optional marks and an optional hyperlink.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InlineRun {
    pub text: String,
    #[serde(default)]
    pub bold: bool,
    #[serde(default)]
    pub italic: bool,
    #[serde(default)]
    pub underline: bool,
    #[serde(default)]
    pub strikethrough: bool,
    #[serde(default)]
    pub code: bool,
    /// Optional hyperlink; when `text` is absent the run's own text is the link text.
    pub link: Option<InlineLink>,
}

/// A typed hyperlink target.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InlineLink {
    /// A validated `http(s)` URL.
    pub url: String,
    /// Optional custom link text; defaults to the run's own text.
    #[serde(default)]
    pub text: Option<String>,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// The scope a node-count limit applies to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeScope {
    TopLevel,
    Total,
}

/// Which kind of identifier failed a rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdKind {
    NodeId,
    AssetId,
    EmbedId,
    EmbedParamKey,
}

/// Why an identifier failed a rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdReason {
    Empty,
    TooLong,
    BadCharacter,
}

/// Why a short text field failed a rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldReason {
    Empty,
    TooLong,
    ControlCharacter,
}

/// A specific, human-readable validation error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocumentError {
    /// The payload is not valid JSON or not a `SerialDocument` object.
    InvalidJson { message: String },
    /// The `version` field is not [`SUPPORTED_VERSION`].
    UnsupportedVersion { version: u32, supported: u32 },
    /// The document has no nodes.
    EmptyDocument,
    /// More nodes than allowed (top-level or total).
    TooManyNodes {
        scope: NodeScope,
        count: usize,
        max: usize,
    },
    /// A node is nested deeper than [`MAX_PANEL_DEPTH`] via panels.
    PanelTooDeep { depth: usize, max: usize },
    /// A panel has no children.
    EmptyPanel { id: String },
    /// A node id is used more than once in the document.
    DuplicateNodeId { id: String },
    /// A node/asset/embed/param identifier failed a rule.
    InvalidIdentifier {
        kind: IdKind,
        value: String,
        reason: IdReason,
    },
    /// A short text field (alt/caption/label/title/param value) failed a rule.
    InvalidTextField { field: String, reason: FieldReason },
    /// A text field contained an executable markup token from [`DENY_TOKENS`].
    ExecutableContent { field: String, token: String },
    /// A paragraph / rotated-text node carries no text.
    EmptyBlock { node_id: String },
    /// A text block has more runs than [`MAX_RUNS_PER_BLOCK`].
    TooManyRuns {
        node_id: String,
        count: usize,
        max: usize,
    },
    /// One text block exceeds [`MAX_BLOCK_TEXT_BYTES`].
    BlockTextTooLong {
        node_id: String,
        bytes: usize,
        max: usize,
    },
    /// The whole document's text exceeds [`MAX_TOTAL_TEXT_BYTES`].
    TotalTextTooLong { bytes: usize, max: usize },
    /// The serialized document exceeds [`MAX_DOCUMENT_BYTES`].
    DocumentTooLarge { bytes: usize, max: usize },
    /// A URL is not an `http(s)` URL (or is otherwise invalid).
    InvalidUrl { url: String },
    /// A numeric field is outside its allowed range.
    OutOfRange {
        field: String,
        value: i128,
        min: i128,
        max: i128,
    },
    /// A game embed has more parameters than [`MAX_EMBED_PARAMS`].
    TooManyEmbedParams {
        node_id: String,
        count: usize,
        max: usize,
    },
}

impl fmt::Display for DocumentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DocumentError::InvalidJson { message } => {
                write!(f, "Document is not valid JSON: {message}")
            }
            DocumentError::UnsupportedVersion { version, supported } => write!(
                f,
                "Unsupported document version {version}; this server only supports version {supported}"
            ),
            DocumentError::EmptyDocument => write!(f, "Document has no nodes"),
            DocumentError::TooManyNodes { scope, count, max } => {
                let label = match scope {
                    NodeScope::TopLevel => "top-level nodes",
                    NodeScope::Total => "nodes in total",
                };
                write!(f, "Document has {count} {label}; the maximum is {max}")
            }
            DocumentError::PanelTooDeep { depth, max } => {
                write!(f, "Panels are nested {depth} levels deep; the maximum is {max}")
            }
            DocumentError::EmptyPanel { id } => write!(f, "Panel '{id}' has no child nodes"),
            DocumentError::DuplicateNodeId { id } => {
                write!(f, "Node id '{id}' is used more than once in the document")
            }
            DocumentError::InvalidIdentifier { kind, value, reason } => {
                let name = match kind {
                    IdKind::NodeId => "Node id",
                    IdKind::AssetId => "Asset id",
                    IdKind::EmbedId => "Embed id",
                    IdKind::EmbedParamKey => "Embed parameter key",
                };
                let reason = match reason {
                    IdReason::Empty => "must not be empty",
                    IdReason::TooLong => "is too long",
                    IdReason::BadCharacter => {
                        "contains characters outside a-z, A-Z, 0-9, '-' and '_'"
                    }
                };
                write!(f, "{name} '{value}' {reason}")
            }
            DocumentError::InvalidTextField { field, reason } => {
                let reason = match reason {
                    FieldReason::Empty => "must not be empty",
                    FieldReason::TooLong => "is too long",
                    FieldReason::ControlCharacter => "contains control characters",
                };
                write!(f, "Field '{field}' {reason}")
            }
            DocumentError::ExecutableContent { field, token } => write!(
                f,
                "Field '{field}' contains executable markup token '{token}'"
            ),
            DocumentError::EmptyBlock { node_id } => {
                write!(f, "Node '{node_id}' has no text")
            }
            DocumentError::TooManyRuns { node_id, count, max } => write!(
                f,
                "Node '{node_id}' has {count} text runs; the maximum is {max}"
            ),
            DocumentError::BlockTextTooLong { node_id, bytes, max } => write!(
                f,
                "Node '{node_id}' text is {bytes} bytes; the maximum is {max}"
            ),
            DocumentError::TotalTextTooLong { bytes, max } => write!(
                f,
                "Document text is {bytes} bytes in total; the maximum is {max}"
            ),
            DocumentError::DocumentTooLarge { bytes, max } => write!(
                f,
                "Document is {bytes} bytes when serialized; the maximum is {max}"
            ),
            DocumentError::InvalidUrl { url } => write!(
                f,
                "URL '{url}' is not allowed; only http:// and https:// URLs are accepted"
            ),
            DocumentError::OutOfRange { field, value, min, max } => write!(
                f,
                "Field '{field}' value {value} is out of range; it must be between {min} and {max}"
            ),
            DocumentError::TooManyEmbedParams { node_id, count, max } => write!(
                f,
                "Embed '{node_id}' has {count} parameters; the maximum is {max}"
            ),
        }
    }
}

impl std::error::Error for DocumentError {}

// ---------------------------------------------------------------------------
// Parsing / normalization
// ---------------------------------------------------------------------------

struct Walk {
    seen: BTreeSet<String>,
    total_nodes: usize,
    total_text: usize,
}

impl SerialDocumentV1 {
    /// Parse, validate, and normalize a `SerialDocumentV1` from its JSON wire form.
    ///
    /// On success the returned document is **normalized** (text trimmed, optional fields
    /// dropped when blank) and safe to persist or re-serialize deterministically.
    pub fn from_json(input: &str) -> Result<SerialDocumentV1, DocumentError> {
        let byte_len = input.len();
        if byte_len > MAX_DOCUMENT_BYTES {
            return Err(DocumentError::DocumentTooLarge {
                bytes: byte_len,
                max: MAX_DOCUMENT_BYTES,
            });
        }

        let doc: SerialDocumentV1 =
            serde_json::from_str(input).map_err(|e| DocumentError::InvalidJson {
                message: e.to_string(),
            })?;

        if doc.version != SUPPORTED_VERSION {
            return Err(DocumentError::UnsupportedVersion {
                version: doc.version,
                supported: SUPPORTED_VERSION,
            });
        }

        let normalized = doc.normalize()?;

        // Guard the serialized size of the normalized document as well.
        let serialized = normalized.to_json()?;
        if serialized.len() > MAX_DOCUMENT_BYTES {
            return Err(DocumentError::DocumentTooLarge {
                bytes: serialized.len(),
                max: MAX_DOCUMENT_BYTES,
            });
        }

        Ok(normalized)
    }

    /// Serialize the (already normalized) document to its canonical JSON bytes.
    ///
    /// Deterministic: field order is fixed by the struct definitions, so equal logical
    /// documents always produce equal strings.
    pub fn to_json(&self) -> Result<String, DocumentError> {
        serde_json::to_string(self).map_err(|e| DocumentError::InvalidJson {
            message: format!("serialization failed: {e}"),
        })
    }

    /// Re-run validation on an in-memory document (e.g. before persisting).
    /// Returns the normalized form.
    pub fn validate(self) -> Result<Self, DocumentError> {
        if self.version != SUPPORTED_VERSION {
            return Err(DocumentError::UnsupportedVersion {
                version: self.version,
                supported: SUPPORTED_VERSION,
            });
        }
        self.normalize()
    }

    fn normalize(self) -> Result<Self, DocumentError> {
        if self.nodes.is_empty() {
            return Err(DocumentError::EmptyDocument);
        }
        if self.nodes.len() > MAX_TOP_LEVEL_NODES {
            return Err(DocumentError::TooManyNodes {
                scope: NodeScope::TopLevel,
                count: self.nodes.len(),
                max: MAX_TOP_LEVEL_NODES,
            });
        }

        let mut walk = Walk {
            seen: BTreeSet::new(),
            total_nodes: 0,
            total_text: 0,
        };
        let mut nodes = self.nodes;
        for node in &mut nodes {
            normalize_node(node, 1, &mut walk)?;
        }

        if walk.total_nodes > MAX_TOTAL_NODES {
            return Err(DocumentError::TooManyNodes {
                scope: NodeScope::Total,
                count: walk.total_nodes,
                max: MAX_TOTAL_NODES,
            });
        }
        if walk.total_text > MAX_TOTAL_TEXT_BYTES {
            return Err(DocumentError::TotalTextTooLong {
                bytes: walk.total_text,
                max: MAX_TOTAL_TEXT_BYTES,
            });
        }

        Ok(SerialDocumentV1 {
            version: self.version,
            nodes,
        })
    }
}

fn normalize_node(
    node: &mut DocumentNode,
    depth: usize,
    walk: &mut Walk,
) -> Result<(), DocumentError> {
    walk.total_nodes += 1;

    match node {
        DocumentNode::Paragraph(p) => {
            normalize_identifier(IdKind::NodeId, &mut p.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&p.id, &mut walk.seen)?;
            p.runs = normalize_runs(&p.id, &p.runs, walk)?;
        }
        DocumentNode::RotatedText(r) => {
            normalize_identifier(IdKind::NodeId, &mut r.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&r.id, &mut walk.seen)?;
            let rotation = i32::from(r.rotation);
            if rotation < -(MAX_ROTATION_DEGREES as i32) || rotation > MAX_ROTATION_DEGREES as i32 {
                return Err(DocumentError::OutOfRange {
                    field: "rotation".to_string(),
                    value: r.rotation as i128,
                    min: -(MAX_ROTATION_DEGREES as i128),
                    max: MAX_ROTATION_DEGREES as i128,
                });
            }
            normalize_optional_text("alt", &mut r.alt)?;
            r.runs = normalize_runs(&r.id, &r.runs, walk).map_err(rotated_text_error)?;
        }
        DocumentNode::Image(img) => {
            normalize_identifier(IdKind::NodeId, &mut img.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&img.id, &mut walk.seen)?;
            normalize_identifier(IdKind::AssetId, &mut img.asset_id, MAX_ASSET_ID_BYTES)?;
            normalize_text_allow_empty("alt", &mut img.alt)?;
            normalize_optional_text("caption", &mut img.caption)?;
            check_dimension("width", &mut img.width)?;
            check_dimension("height", &mut img.height)?;
        }
        DocumentNode::Video(v) => {
            normalize_identifier(IdKind::NodeId, &mut v.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&v.id, &mut walk.seen)?;
            normalize_identifier(IdKind::AssetId, &mut v.asset_id, MAX_ASSET_ID_BYTES)?;
            if let Some(poster) = v.poster_asset_id.as_mut() {
                normalize_identifier(IdKind::AssetId, poster, MAX_ASSET_ID_BYTES)?;
            }
            normalize_optional_text("caption", &mut v.caption)?;
            if let Some(transcript_url) = &mut v.transcript_url {
                validate_url(transcript_url)?;
            }
            check_dimension("width", &mut v.width)?;
            check_dimension("height", &mut v.height)?;
        }
        DocumentNode::GameEmbed(g) => {
            normalize_identifier(IdKind::NodeId, &mut g.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&g.id, &mut walk.seen)?;
            normalize_identifier(IdKind::EmbedId, &mut g.embed_id, MAX_EMBED_ID_BYTES)?;
            check_dimension_non_optional("width", &mut g.width)?;
            check_dimension_non_optional("height", &mut g.height)?;
            normalize_required_text("title", &mut g.title)?;
            if g.params.len() > MAX_EMBED_PARAMS {
                return Err(DocumentError::TooManyEmbedParams {
                    node_id: g.id.clone(),
                    count: g.params.len(),
                    max: MAX_EMBED_PARAMS,
                });
            }
            for p in &mut g.params {
                normalize_identifier(IdKind::EmbedParamKey, &mut p.key, MAX_EMBED_PARAM_KEY_BYTES)?;
                let trimmed = p.value.trim().to_string();
                reject_unsafe_text("embed param value", &trimmed)?;
                if trimmed.is_empty() {
                    return Err(DocumentError::InvalidTextField {
                        field: "embed param value".to_string(),
                        reason: FieldReason::Empty,
                    });
                }
                if trimmed.len() > MAX_EMBED_PARAM_VALUE_BYTES {
                    return Err(DocumentError::InvalidTextField {
                        field: "embed param value".to_string(),
                        reason: FieldReason::TooLong,
                    });
                }
                p.value = trimmed;
            }
        }
        DocumentNode::Panel(panel) => {
            if depth > MAX_PANEL_DEPTH {
                return Err(DocumentError::PanelTooDeep {
                    depth,
                    max: MAX_PANEL_DEPTH,
                });
            }
            normalize_identifier(IdKind::NodeId, &mut panel.id, MAX_NODE_ID_BYTES)?;
            register_node_id(&panel.id, &mut walk.seen)?;
            if panel.children.is_empty() {
                return Err(DocumentError::EmptyPanel {
                    id: panel.id.clone(),
                });
            }
            normalize_optional_text("label", &mut panel.label)?;
            for child in &mut panel.children {
                normalize_node(child, depth + 1, walk)?;
            }
        }
    }
    Ok(())
}

fn normalize_runs(
    node_id: &str,
    runs: &[InlineRun],
    walk: &mut Walk,
) -> Result<Vec<InlineRun>, DocumentError> {
    if runs.is_empty() {
        return Err(DocumentError::EmptyBlock {
            node_id: node_id.to_string(),
        });
    }
    if runs.len() > MAX_RUNS_PER_BLOCK {
        return Err(DocumentError::TooManyRuns {
            node_id: node_id.to_string(),
            count: runs.len(),
            max: MAX_RUNS_PER_BLOCK,
        });
    }

    let mut out = Vec::with_capacity(runs.len());
    let mut block_bytes = 0usize;
    for run in runs {
        let mut text = run.text.clone();
        normalize_run_text(node_id, &mut text)?;

        let link = match &run.link {
            None => None,
            Some(l) => {
                let mut url = l.url.clone();
                validate_url(&mut url)?;
                let mut link_text = l.text.clone();
                normalize_optional_text("link text", &mut link_text)?;
                Some(InlineLink {
                    url,
                    text: link_text,
                })
            }
        };

        block_bytes += text.len();
        out.push(InlineRun {
            text,
            bold: run.bold,
            italic: run.italic,
            underline: run.underline,
            strikethrough: run.strikethrough,
            code: run.code,
            link,
        });
    }

    if block_bytes > MAX_BLOCK_TEXT_BYTES {
        return Err(DocumentError::BlockTextTooLong {
            node_id: node_id.to_string(),
            bytes: block_bytes,
            max: MAX_BLOCK_TEXT_BYTES,
        });
    }
    walk.total_text += block_bytes;
    Ok(out)
}

// -- field helpers ---------------------------------------------------------

fn normalize_identifier(kind: IdKind, value: &mut String, max: usize) -> Result<(), DocumentError> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(DocumentError::InvalidIdentifier {
            kind,
            value: trimmed,
            reason: IdReason::Empty,
        });
    }
    if trimmed.len() > max {
        return Err(DocumentError::InvalidIdentifier {
            kind,
            value: trimmed,
            reason: IdReason::TooLong,
        });
    }
    if trimmed
        .chars()
        .any(|c| !(c.is_ascii_alphanumeric() || c == '_' || c == '-'))
    {
        return Err(DocumentError::InvalidIdentifier {
            kind,
            value: trimmed,
            reason: IdReason::BadCharacter,
        });
    }
    *value = trimmed;
    Ok(())
}

fn register_node_id(id: &str, seen: &mut BTreeSet<String>) -> Result<(), DocumentError> {
    if !seen.insert(id.to_string()) {
        return Err(DocumentError::DuplicateNodeId { id: id.to_string() });
    }
    Ok(())
}

fn normalize_run_text(node_id: &str, value: &mut String) -> Result<(), DocumentError> {
    let trimmed = value.trim().to_string();
    reject_unsafe_text("text", &trimmed)?;
    if trimmed.is_empty() {
        return Err(DocumentError::EmptyBlock {
            node_id: node_id.to_string(),
        });
    }
    *value = trimmed;
    Ok(())
}

/// Normalize a required, non-empty short text field.
fn normalize_required_text(field: &str, value: &mut String) -> Result<(), DocumentError> {
    let trimmed = value.trim().to_string();
    reject_unsafe_text(field, &trimmed)?;
    if trimmed.is_empty() {
        return Err(DocumentError::InvalidTextField {
            field: field.to_string(),
            reason: FieldReason::Empty,
        });
    }
    if trimmed.len() > MAX_TEXT_FIELD_BYTES {
        return Err(DocumentError::InvalidTextField {
            field: field.to_string(),
            reason: FieldReason::TooLong,
        });
    }
    *value = trimmed;
    Ok(())
}

/// Normalize a short text field that may be empty (e.g. a decorative image alt).
fn normalize_text_allow_empty(field: &str, value: &mut String) -> Result<(), DocumentError> {
    let trimmed = value.trim().to_string();
    reject_unsafe_text(field, &trimmed)?;
    if trimmed.len() > MAX_TEXT_FIELD_BYTES {
        return Err(DocumentError::InvalidTextField {
            field: field.to_string(),
            reason: FieldReason::TooLong,
        });
    }
    *value = trimmed;
    Ok(())
}

/// Normalize an optional short text field; a value that trims to empty becomes `None`.
fn normalize_optional_text(field: &str, value: &mut Option<String>) -> Result<(), DocumentError> {
    if let Some(v) = value.as_mut() {
        let trimmed = v.trim().to_string();
        reject_unsafe_text(field, &trimmed)?;
        if trimmed.is_empty() {
            *value = None;
            return Ok(());
        }
        if trimmed.len() > MAX_TEXT_FIELD_BYTES {
            return Err(DocumentError::InvalidTextField {
                field: field.to_string(),
                reason: FieldReason::TooLong,
            });
        }
        *v = trimmed;
    }
    Ok(())
}

fn validate_url(value: &mut String) -> Result<(), DocumentError> {
    let trimmed = value.trim().to_string();
    let ok_scheme = trimmed.starts_with("http://") || trimmed.starts_with("https://");
    let ok_len = trimmed.len() <= MAX_URL_BYTES;
    let no_control = !trimmed.chars().any(|c| (c as u32) < 0x20 || c == '\u{7f}');
    if !ok_scheme || !ok_len || !no_control {
        return Err(DocumentError::InvalidUrl { url: trimmed });
    }
    *value = trimmed;
    Ok(())
}

fn rotated_text_error(error: DocumentError) -> DocumentError {
    // Classify executable targets for rotated lines after the existing URL rules reject them.
    if let DocumentError::InvalidUrl { url } = &error {
        if let Err(executable @ DocumentError::ExecutableContent { .. }) =
            reject_unsafe_text("link url", url)
        {
            return executable;
        }
    }
    error
}

fn check_dimension(field: &str, value: &mut Option<u16>) -> Result<(), DocumentError> {
    if let Some(d) = value {
        if *d < MIN_DIMENSION_UNITS || *d > MAX_DIMENSION_UNITS {
            return Err(DocumentError::OutOfRange {
                field: field.to_string(),
                value: *d as i128,
                min: MIN_DIMENSION_UNITS as i128,
                max: MAX_DIMENSION_UNITS as i128,
            });
        }
    }
    Ok(())
}

fn check_dimension_non_optional(field: &str, value: &mut u16) -> Result<(), DocumentError> {
    if *value < MIN_DIMENSION_UNITS || *value > MAX_DIMENSION_UNITS {
        return Err(DocumentError::OutOfRange {
            field: field.to_string(),
            value: *value as i128,
            min: MIN_DIMENSION_UNITS as i128,
            max: MAX_DIMENSION_UNITS as i128,
        });
    }
    Ok(())
}

fn reject_unsafe_text(field: &str, s: &str) -> Result<(), DocumentError> {
    if s.chars().any(|c| (c as u32) < 0x20 || c == '\u{7f}') {
        return Err(DocumentError::InvalidTextField {
            field: field.to_string(),
            reason: FieldReason::ControlCharacter,
        });
    }
    let lowered = s.to_ascii_lowercase();
    for token in DENY_TOKENS {
        if lowered.contains(token) {
            return Err(DocumentError::ExecutableContent {
                field: field.to_string(),
                token: token.to_string(),
            });
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Plain-text extraction
// ---------------------------------------------------------------------------

impl SerialDocumentV1 {
    /// Extract a single normalized plain-text string in reading order.
    ///
    /// Retains all meaningful text and accessibility labels (paragraph text, rotated-text
    /// text plus a differing alt, image alt + caption, video caption, embed title, panel
    /// labels). Whitespace is collapsed to single spaces per line and blank lines are
    /// removed, so the result is stable across serialization.
    pub fn plain_text(&self) -> String {
        let mut segments: Vec<String> = Vec::new();
        for node in &self.nodes {
            extract_node(node, &mut segments);
        }
        segments
            .iter()
            .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    }
}

fn extract_node(node: &DocumentNode, segments: &mut Vec<String>) {
    match node {
        DocumentNode::Paragraph(p) => {
            let line = p
                .runs
                .iter()
                .map(|run| run.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            segments.push(line);
        }
        DocumentNode::RotatedText(r) => {
            let mut line = r
                .runs
                .iter()
                .map(|run| run.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            if let Some(alt) = &r.alt {
                let alt_trim = alt.trim();
                if !alt_trim.is_empty() && !alt_trim.eq_ignore_ascii_case(line.trim()) {
                    line.push_str(&format!(" ({alt_trim})"));
                }
            }
            segments.push(line);
        }
        DocumentNode::Image(img) => {
            let mut line = String::new();
            if !img.alt.trim().is_empty() {
                line.push_str(&img.alt);
            }
            if let Some(cap) = &img.caption {
                if !line.is_empty() {
                    line.push(' ');
                }
                line.push_str(cap);
            }
            segments.push(line);
        }
        DocumentNode::Video(v) => {
            if let Some(cap) = &v.caption {
                segments.push(cap.clone());
            }
        }
        DocumentNode::GameEmbed(g) => {
            segments.push(g.title.clone());
        }
        DocumentNode::Panel(panel) => {
            if let Some(label) = &panel.label {
                if !label.trim().is_empty() {
                    segments.push(label.clone());
                }
            }
            for child in &panel.children {
                extract_node(child, segments);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal but valid document: one paragraph.
    fn minimal_json() -> String {
        r#"{
            "version": 1,
            "nodes": [
                {
                    "type": "paragraph",
                    "id": "p1",
                    "runs": [{ "text": "  It was a bright cold day in April.  " }]
                }
            ]
        }"#
        .to_string()
    }

    /// A full-featured valid document exercising every node type and a nested panel.
    fn full_json() -> String {
        r#"{
            "version": 1,
            "nodes": [
                {
                    "type": "paragraph",
                    "id": "p1",
                    "runs": [
                        { "text": "The " },
                        { "text": "door", "bold": true },
                        {
                            "text": " swung open",
                            "link": { "url": "https://example.com/door" }
                        }
                    ]
                },
                {
                    "type": "rotatedText",
                    "id": "r1",
                    "runs": [{ "text": "TURN BACK NOW" }],
                    "rotation": -90,
                    "alignment": "center",
                    "alt": "turn back now"
                },
                {
                    "type": "image",
                    "id": "img1",
                    "asset_id": "asset_img_001",
                    "alt": "A dark corridor",
                    "caption": "Fig 1. The corridor.",
                    "width": 640,
                    "height": 480
                },
                {
                    "type": "video",
                    "id": "vid1",
                    "asset_id": "asset_vid_001",
                    "caption": "Narration: the corridor in motion.",
                    "width": 640,
                    "height": 360
                },
                {
                    "type": "gameEmbed",
                    "id": "g1",
                    "embed_id": "minigame-escape-room",
                    "width": 480,
                    "height": 320,
                    "title": "Escape the room",
                    "params": [{ "key": "level", "value": "3" }]
                },
                {
                    "type": "panel",
                    "id": "panel1",
                    "label": "Scene 1",
                    "children": [
                        { "type": "paragraph", "id": "p2", "runs": [{ "text": "Inside, it was quiet." }] },
                        {
                            "type": "panel",
                            "id": "panel2",
                            "children": [
                                { "type": "paragraph", "id": "p3", "runs": [{ "text": "A clock ticked." }] }
                            ]
                        }
                    ]
                }
            ]
        }"#
        .to_string()
    }

    #[test]
    fn parses_and_normalizes_minimal_document() {
        let doc = SerialDocumentV1::from_json(&minimal_json()).expect("minimal doc should parse");
        assert_eq!(doc.version, 1);
        assert_eq!(doc.nodes.len(), 1);
        if let DocumentNode::Paragraph(p) = &doc.nodes[0] {
            assert_eq!(p.id, "p1");
            // text is trimmed during normalization
            assert_eq!(p.runs[0].text, "It was a bright cold day in April.");
        } else {
            panic!("expected paragraph");
        }
    }

    #[test]
    fn round_trip_preserves_ids_and_order() {
        let first = SerialDocumentV1::from_json(&full_json()).expect("full doc should parse");
        let serialized = first.to_json().expect("serialize");
        let second = SerialDocumentV1::from_json(&serialized).expect("re-parse");
        assert_eq!(first, second, "round-trip must be stable");

        // node ids preserved verbatim and in reading order
        let ids: Vec<&str> = first.nodes.iter().map(node_id).collect();
        assert_eq!(ids, ["p1", "r1", "img1", "vid1", "g1", "panel1"]);
    }

    #[test]
    fn serialization_is_deterministic() {
        let a = SerialDocumentV1::from_json(&full_json()).unwrap();
        let b = SerialDocumentV1::from_json(&full_json()).unwrap();
        assert_eq!(a.to_json().unwrap(), b.to_json().unwrap());
    }

    #[test]
    fn plain_text_retains_meaningful_text_and_labels() {
        let doc = SerialDocumentV1::from_json(&full_json()).unwrap();
        let text = doc.plain_text();
        let lines: Vec<&str> = text.split('\n').collect();
        // The rotated text alt equals its text, so it is not duplicated.
        assert_eq!(
            lines,
            [
                "The door swung open",
                "TURN BACK NOW",
                "A dark corridor Fig 1. The corridor.",
                "Narration: the corridor in motion.",
                "Escape the room",
                "Scene 1",
                "Inside, it was quiet.",
                "A clock ticked.",
            ]
        );
    }

    #[test]
    fn rejects_wrong_version() {
        let v0 = r#"{"version":0,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"hi"}]}]}"#;
        assert!(matches!(
            SerialDocumentV1::from_json(v0),
            Err(DocumentError::UnsupportedVersion { version: 0, .. })
        ));
        let v2 = r#"{"version":2,"nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"hi"}]}]}"#;
        assert!(matches!(
            SerialDocumentV1::from_json(v2),
            Err(DocumentError::UnsupportedVersion { version: 2, .. })
        ));
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(matches!(
            SerialDocumentV1::from_json("{ not json"),
            Err(DocumentError::InvalidJson { .. })
        ));
    }

    #[test]
    fn rejects_empty_document() {
        let doc = r#"{"version":1,"nodes":[]}"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::EmptyDocument)
        ));
    }

    #[test]
    fn rejects_oversized_document() {
        let filler = "x".repeat(MAX_DOCUMENT_BYTES);
        let doc = format!(
            r#"{{"version":1,"nodes":[{{"type":"paragraph","id":"p1","runs":[{{"text":"{}"}}]}}]}}"#,
            filler
        );
        assert!(matches!(
            SerialDocumentV1::from_json(&doc),
            Err(DocumentError::DocumentTooLarge { .. })
        ));
    }

    #[test]
    fn rejects_duplicate_node_ids() {
        let doc = r#"{
            "version":1,
            "nodes":[
                {"type":"paragraph","id":"p1","runs":[{"text":"a"}]},
                {"type":"paragraph","id":"p1","runs":[{"text":"b"}]}
            ]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::DuplicateNodeId { .. })
        ));
    }

    #[test]
    fn duplicate_id_in_nested_panel_is_rejected() {
        let doc = r#"{
            "version":1,
            "nodes":[
                {"type":"paragraph","id":"p1","runs":[{"text":"a"}]},
                {"type":"panel","id":"panel1","children":[
                    {"type":"paragraph","id":"p1","runs":[{"text":"b"}]}
                ]}
            ]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::DuplicateNodeId { .. })
        ));
    }

    #[test]
    fn rejects_rotation_out_of_range() {
        for rotation in [-181, 181] {
            let json = format!(
                r#"{{"version":1,"nodes":[{{"type":"rotatedText","id":"r1","runs":[{{"text":"x"}}],"rotation":{rotation}}}]}}"#
            );
            assert_eq!(
                SerialDocumentV1::from_json(&json),
                Err(DocumentError::OutOfRange {
                    field: "rotation".to_string(),
                    value: rotation,
                    min: -180,
                    max: 180,
                })
            );
        }
    }

    #[test]
    fn accepts_rotation_at_bounds() {
        for rot in [180i16, -180] {
            let doc = format!(
                r#"{{"version":1,"nodes":[{{"type":"rotatedText","id":"r1","runs":[{{"text":"x"}}],"rotation":{rot}}}]}}"#
            );
            assert!(
                SerialDocumentV1::from_json(&doc).is_ok(),
                "rotation {rot} should be accepted"
            );
        }
    }

    #[test]
    fn accepts_zero_rotation() {
        let json = r#"{"version":1,"nodes":[{"type":"rotatedText","id":"r1","runs":[{"text":"x"}],"rotation":0}]}"#;
        let doc = SerialDocumentV1::from_json(json).unwrap();
        let DocumentNode::RotatedText(line) = &doc.nodes[0] else {
            panic!("expected rotatedText");
        };
        assert_eq!(line.rotation, 0);
    }

    #[test]
    fn rotated_text_round_trips_canonically() {
        let json = r#"{
            "nodes":[{
                "type":"rotatedText","id":"r1","rotation":-12,"alignment":"center",
                "runs":[{"text":" Turn back ","bold":true}],"alt":" turn back "
            }],
            "version":1
        }"#;
        let canonical = concat!(
            r#"{"version":1,"nodes":[{"type":"rotatedText","id":"r1","runs":[{"text":"Turn back","bold":true,"#,
            r#""italic":false,"underline":false,"strikethrough":false,"code":false,"link":null}],"#,
            r#""rotation":-12,"alignment":"center","alt":"turn back"}]}"#,
        );
        let doc = SerialDocumentV1::from_json(json).unwrap();
        let serialized = doc.to_json().unwrap();
        assert_eq!(serialized, canonical);
        let reparsed = SerialDocumentV1::from_json(&serialized).unwrap();
        assert_eq!(reparsed, doc);
        assert_eq!(reparsed.to_json().unwrap(), canonical);
    }

    #[test]
    fn rejects_unknown_rotated_text_transform() {
        let json = r#"{
            "version":1,
            "nodes":[{"type":"rotatedText","id":"r1","runs":[{"text":"x"}],"rotation":0,
                      "transform":"rotate(90deg)"}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(json),
            Err(DocumentError::InvalidJson { message }) if message.contains("unknown field `transform`")
        ));
    }

    #[test]
    fn rejects_script_in_rotated_text_runs() {
        let json = r#"{
            "version":1,
            "nodes":[{"type":"rotatedText","id":"r1","runs":[{"text":"<script>alert(1)</script>"}],"rotation":0}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(json),
            Err(DocumentError::ExecutableContent { field, token }) if field == "text" && token == "<script"
        ));
    }

    #[test]
    fn rejects_executable_rotated_text_link() {
        let json = r#"{
            "version":1,
            "nodes":[{"type":"rotatedText","id":"r1","runs":[
                {"text":"click","link":{"url":"javascript:alert(1)"}}
            ],"rotation":0}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(json),
            Err(DocumentError::ExecutableContent { field, token }) if field == "link url" && token == "javascript:"
        ));
    }

    #[test]
    fn rejects_dimension_out_of_range() {
        let zero = r#"{
            "version":1,
            "nodes":[{"type":"image","id":"img1","asset_id":"a1","alt":"","width":0}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(zero),
            Err(DocumentError::OutOfRange { field, .. }) if field == "width"
        ));
        let too_big = r#"{
            "version":1,
            "nodes":[{"type":"image","id":"img1","asset_id":"a1","alt":"","width":4097}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(too_big),
            Err(DocumentError::OutOfRange { field, .. }) if field == "width"
        ));
    }

    #[test]
    fn rejects_game_embed_dimension_out_of_range() {
        let zero = r#"{
            "version":1,
            "nodes":[{"type":"gameEmbed","id":"g1","embed_id":"game1","width":0,"height":320,"title":"Test","params":[]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(zero),
            Err(DocumentError::OutOfRange { field, .. }) if field == "width"
        ));
        let too_big = r#"{
            "version":1,
            "nodes":[{"type":"gameEmbed","id":"g1","embed_id":"game1","width":4097,"height":320,"title":"Test","params":[]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(too_big),
            Err(DocumentError::OutOfRange { field, .. }) if field == "width"
        ));
        let zero_h = r#"{
            "version":1,
            "nodes":[{"type":"gameEmbed","id":"g1","embed_id":"game1","width":480,"height":0,"title":"Test","params":[]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(zero_h),
            Err(DocumentError::OutOfRange { field, .. }) if field == "height"
        ));
        let too_big_h = r#"{
            "version":1,
            "nodes":[{"type":"gameEmbed","id":"g1","embed_id":"game1","width":480,"height":4097,"title":"Test","params":[]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(too_big_h),
            Err(DocumentError::OutOfRange { field, .. }) if field == "height"
        ));
    }

    #[test]
    fn accepts_game_embed_dimension_at_bounds() {
        for (w, h) in [(1, 1), (1, 4096), (4096, 1), (4096, 4096)] {
            let doc = format!(
                r#"{{"version":1,"nodes":[{{"type":"gameEmbed","id":"g1","embed_id":"game1","width":{w},"height":{h},"title":"Test","params":[]}}]}}"#
            );
            assert!(
                SerialDocumentV1::from_json(&doc).is_ok(),
                "dimensions {w}x{h} should be accepted"
            );
        }
    }

    #[test]
    fn accepts_game_embed_dimension_intermediate_extremes() {
        // Test intermediate values near bounds to ensure validation is correct
        let doc = format!(
            r#"{{"version":1,"nodes":[{{"type":"gameEmbed","id":"g1","embed_id":"game1","width":4095,"height":2,"title":"Test","params":[]}}]}}"#
        );
        assert!(
            SerialDocumentV1::from_json(&doc).is_ok(),
            "dimensions 4095x2 should be accepted"
        );
    }

    #[test]
    fn round_trip_game_embed_preserves_dimensions() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"gameEmbed","id":"g1","embed_id":"game1","width":480,"height":320,"title":"Test","params":[{"key":"level","value":"3"}]}]
        }"#;
        let first = SerialDocumentV1::from_json(doc).expect("should parse");
        if let DocumentNode::GameEmbed(g) = &first.nodes[0] {
            assert_eq!(g.width, 480);
            assert_eq!(g.height, 320);
        } else {
            panic!("expected gameEmbed");
        }
        let serialized = first.to_json().expect("should serialize");
        let second = SerialDocumentV1::from_json(&serialized).expect("should re-parse");
        if let DocumentNode::GameEmbed(g) = &second.nodes[0] {
            assert_eq!(g.width, 480);
            assert_eq!(g.height, 320);
        } else {
            panic!("expected gameEmbed");
        }
    }

    #[test]
    fn rejects_script_bearing_url() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"paragraph","id":"p1","runs":[
                {"text":"click","link":{"url":"javascript:alert(1)"}}
            ]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::InvalidUrl { .. })
        ));
    }

    #[test]
    fn accepts_http_urls() {
        for scheme in ["https://example.com/x", "http://example.com/x"] {
            let doc = format!(
                r#"{{"version":1,"nodes":[{{"type":"paragraph","id":"p1","runs":[{{"text":"a","link":{{"url":"{scheme}"}}}}]}}]}}"#
            );
            assert!(
                SerialDocumentV1::from_json(&doc).is_ok(),
                "scheme {scheme} should be accepted"
            );
        }
    }

    #[test]
    fn rejects_script_bearing_text() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"<script>alert(1)</script>"}]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::ExecutableContent { token, .. }) if token == "<script"
        ));
    }

    #[test]
    fn rejects_bad_id_charset() {
        // a node id with a space / angle bracket is not a valid identifier
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"paragraph","id":"p 1<x>","runs":[{"text":"a"}]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::InvalidIdentifier {
                kind: IdKind::NodeId,
                reason: IdReason::BadCharacter,
                ..
            })
        ));
    }

    #[test]
    fn rejects_empty_run_text() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"paragraph","id":"p1","runs":[{"text":"   "}]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::EmptyBlock { .. })
        ));
    }

    #[test]
    fn rejects_empty_panel() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"panel","id":"p1","children":[]}]
        }"#;
        assert!(matches!(
            SerialDocumentV1::from_json(doc),
            Err(DocumentError::EmptyPanel { .. })
        ));
    }

    #[test]
    fn rejects_panel_too_deep() {
        // Build a panel nested beyond MAX_PANEL_DEPTH.
        let mut node: serde_json::Value = serde_json::json!({
            "type": "paragraph",
            "id": "leaf",
            "runs": [{ "text": "deep" }]
        });
        for depth in 1..=MAX_PANEL_DEPTH + 1 {
            node = serde_json::json!({
                "type": "panel",
                "id": format!("d{depth}"),
                "children": [node]
            });
        }
        let doc = serde_json::json!({ "version": 1, "nodes": [node] }).to_string();
        assert!(matches!(
            SerialDocumentV1::from_json(&doc),
            Err(DocumentError::PanelTooDeep { .. })
        ));
    }

    #[test]
    fn accepts_panel_at_max_depth() {
        let mut node: serde_json::Value = serde_json::json!({
            "type": "paragraph",
            "id": "leaf",
            "runs": [{ "text": "deep" }]
        });
        for depth in 1..=MAX_PANEL_DEPTH {
            node = serde_json::json!({
                "type": "panel",
                "id": format!("d{depth}"),
                "children": [node]
            });
        }
        let doc = serde_json::json!({ "version": 1, "nodes": [node] }).to_string();
        assert!(SerialDocumentV1::from_json(&doc).is_ok());
    }

    #[test]
    fn rejects_too_many_top_level_nodes() {
        let nodes: Vec<serde_json::Value> = (0..(MAX_TOP_LEVEL_NODES + 1))
            .map(|i| {
                serde_json::json!({
                    "type": "paragraph",
                    "id": format!("p{i}"),
                    "runs": [{ "text": "x" }]
                })
            })
            .collect();
        let doc = serde_json::json!({ "version": 1, "nodes": nodes }).to_string();
        assert!(matches!(
            SerialDocumentV1::from_json(&doc),
            Err(DocumentError::TooManyNodes {
                scope: NodeScope::TopLevel,
                ..
            })
        ));
    }

    #[test]
    fn optional_blank_fields_are_dropped_on_normalization() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"image","id":"img1","asset_id":"a1","alt":"  ","caption":"   "}]
        }"#;
        let parsed = SerialDocumentV1::from_json(doc).expect("decorative image should parse");
        if let DocumentNode::Image(img) = &parsed.nodes[0] {
            assert_eq!(img.alt, "");
            assert!(img.caption.is_none(), "blank caption should become None");
            assert!(img.width.is_none());
        } else {
            panic!("expected image");
        }
    }

    #[test]
    fn rotated_text_alt_is_appended_when_different() {
        let doc = r#"{
            "version":1,
            "nodes":[{"type":"rotatedText","id":"r1","runs":[{"text":"B"}],"rotation":90,"alt":"bee"}]
        }"#;
        let parsed = SerialDocumentV1::from_json(doc).unwrap();
        assert_eq!(parsed.plain_text(), "B (bee)");
    }

    #[test]
    fn plain_text_preserves_rotated_line_in_story_order() {
        let json = r#"{
            "version":1,
            "nodes":[
                {"type":"paragraph","id":"p1","runs":[{"text":"A"}]},
                {"type":"rotatedText","id":"r1","runs":[{"text":"B"}],"rotation":90},
                {"type":"paragraph","id":"p2","runs":[{"text":"C"}]}
            ]
        }"#;
        let parsed = SerialDocumentV1::from_json(json).unwrap();
        assert_eq!(parsed.plain_text(), "A\nB\nC");
    }

    fn node_id(node: &DocumentNode) -> &str {
        match node {
            DocumentNode::Paragraph(p) => &p.id,
            DocumentNode::RotatedText(r) => &r.id,
            DocumentNode::Image(i) => &i.id,
            DocumentNode::Video(v) => &v.id,
            DocumentNode::GameEmbed(g) => &g.id,
            DocumentNode::Panel(p) => &p.id,
        }
    }
}
