//! Registry for minigames served by the deployment's dedicated static HTTPS host.

use std::collections::HashSet;

use spacetimedb::{AnonymousViewContext, ReducerContext, SpacetimeType, Table, ViewContext};

use crate::accounts::{accounts, accounts__view, require_admin, sessions__view};
use crate::now_micros;
use crate::serial_document::{
    DocumentNode, EmbedParam, GameEmbed, SerialDocumentV1, MAX_DOCUMENT_BYTES, MAX_EMBED_ID_BYTES,
    MAX_EMBED_PARAMS, MAX_EMBED_PARAM_KEY_BYTES, MAX_EMBED_PARAM_VALUE_BYTES,
};

const GAME_ORIGIN: &str = "https://minigames.grem.studio";
const PENDING: &str = "pending";
const APPROVED: &str = "approved";
const REVOKED: &str = "revoked";
const MAX_VALUES_PER_PARAM: usize = 16;

#[derive(Clone, SpacetimeType)]
pub struct MinigameParameter {
    pub key: String,
    pub values: Vec<String>,
}

#[derive(Clone, SpacetimeType)]
pub struct MinigamePolicy {
    pub sandbox: String,
    pub allow: String,
}

#[spacetimedb::table(name = minigame_registry)]
pub struct Minigame {
    #[primary_key]
    pub embed_id: String,
    pub origin: String,
    pub path: String,
    pub owner: String,
    #[index(btree)]
    pub status: String,
    pub allowed_params: Vec<MinigameParameter>,
    pub policy: MinigamePolicy,
    pub created_at: u64,
    pub updated_at: u64,
    pub reviewed_by: Option<String>,
}

#[derive(SpacetimeType)]
pub struct ApprovedMinigame {
    pub embed_id: String,
    pub origin: String,
    pub path: String,
    pub allowed_params: Vec<MinigameParameter>,
    pub policy: MinigamePolicy,
}

#[spacetimedb::view(name = approved_minigames, public)]
fn approved_minigames(ctx: &AnonymousViewContext) -> Vec<ApprovedMinigame> {
    ctx.db
        .minigame_registry()
        .status()
        .filter(APPROVED)
        .map(|game| ApprovedMinigame {
            embed_id: game.embed_id,
            origin: game.origin,
            path: game.path,
            allowed_params: game.allowed_params,
            policy: game.policy,
        })
        .collect()
}

#[spacetimedb::view(name = minigames_for_review, public)]
fn minigames_for_review(ctx: &ViewContext) -> Vec<Minigame> {
    let is_admin = ctx
        .db
        .sessions()
        .identity()
        .find(ctx.sender)
        .and_then(|session| ctx.db.accounts().username().find(&session.username))
        .is_some_and(|account| account.is_admin);
    if !is_admin {
        return Vec::new();
    }

    let statuses = ctx.db.minigame_registry().status();
    statuses
        .filter(PENDING)
        .chain(statuses.filter(APPROVED))
        .chain(statuses.filter(REVOKED))
        .collect()
}

fn is_token(value: &str, max_len: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_len
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn validate_allowlist(params: &[MinigameParameter]) -> Result<(), String> {
    if params.len() > MAX_EMBED_PARAMS {
        return Err("Too many minigame parameter keys".into());
    }
    let mut keys = HashSet::new();
    for param in params {
        if !is_token(&param.key, MAX_EMBED_PARAM_KEY_BYTES) || !keys.insert(&param.key) {
            return Err("Invalid or duplicate minigame parameter key".into());
        }
        if param.values.is_empty() || param.values.len() > MAX_VALUES_PER_PARAM {
            return Err("Each minigame parameter requires 1-16 allowed values".into());
        }
        let mut values = HashSet::new();
        for value in &param.values {
            if !is_token(value, MAX_EMBED_PARAM_VALUE_BYTES) || !values.insert(value) {
                return Err("Invalid or duplicate minigame parameter value".into());
            }
        }
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn register_local_minigame(
    ctx: &ReducerContext,
    embed_id: String,
    owner: String,
    allowed_params: Vec<MinigameParameter>,
) -> Result<(), String> {
    require_admin(ctx)?;
    if !is_token(&embed_id, MAX_EMBED_ID_BYTES) {
        return Err("Invalid minigame ID".into());
    }
    validate_allowlist(&allowed_params)?;
    if ctx.db.accounts().username().find(&owner).is_none() {
        return Err("Minigame owner account not found".into());
    }
    let registry = ctx.db.minigame_registry();
    if registry.embed_id().find(&embed_id).is_some() {
        return Err("Minigame ID is already registered".into());
    }
    let now = now_micros(ctx);
    registry.insert(Minigame {
        origin: GAME_ORIGIN.into(),
        path: format!("/games/{embed_id}/index.html"),
        embed_id,
        owner,
        status: PENDING.into(),
        allowed_params,
        policy: MinigamePolicy {
            sandbox: "allow-scripts".into(),
            allow: String::new(),
        },
        created_at: now,
        updated_at: now,
        reviewed_by: None,
    });
    Ok(())
}

/// The reviewer must confirm the exact origin and path shown in the review queue.
#[spacetimedb::reducer]
pub fn approve_minigame(
    ctx: &ReducerContext,
    embed_id: String,
    reviewed_origin: String,
    reviewed_path: String,
) -> Result<(), String> {
    let reviewer = require_admin(ctx)?;
    let registry = ctx.db.minigame_registry();
    let game = registry
        .embed_id()
        .find(&embed_id)
        .ok_or("Minigame not found")?;
    if reviewed_origin != game.origin || reviewed_path != game.path {
        return Err(
            "Reviewed minigame destination does not match the registered HTTPS origin and path"
                .into(),
        );
    }
    match game.status.as_str() {
        APPROVED => return Ok(()),
        PENDING => (),
        _ => return Err("Revoked minigame IDs cannot be reapproved".into()),
    }
    registry.embed_id().update(Minigame {
        status: APPROVED.into(),
        reviewed_by: Some(reviewer),
        updated_at: now_micros(ctx),
        ..game
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn revoke_minigame(ctx: &ReducerContext, embed_id: String) -> Result<(), String> {
    let reviewer = require_admin(ctx)?;
    let registry = ctx.db.minigame_registry();
    let game = registry
        .embed_id()
        .find(&embed_id)
        .ok_or("Minigame not found")?;
    if game.status != REVOKED {
        registry.embed_id().update(Minigame {
            status: REVOKED.into(),
            reviewed_by: Some(reviewer),
            updated_at: now_micros(ctx),
            ..game
        });
    }
    Ok(())
}

fn validate_params(game: &Minigame, params: &[EmbedParam]) -> Result<(), String> {
    let mut keys = HashSet::new();
    for param in params {
        if !keys.insert(&param.key) {
            return Err(format!("Duplicate minigame parameter '{}'", param.key));
        }
        let rule = game
            .allowed_params
            .iter()
            .find(|rule| rule.key == param.key)
            .ok_or_else(|| format!("Unknown minigame parameter '{}'", param.key))?;
        if !rule.values.contains(&param.value) {
            return Err(format!(
                "Unapproved value for minigame parameter '{}'",
                param.key
            ));
        }
    }
    Ok(())
}

pub(crate) fn validate_publication(
    ctx: &ReducerContext,
    document: &str,
) -> Result<SerialDocumentV1, String> {
    if document.len() > MAX_DOCUMENT_BYTES as usize {
        return Err(format!(
            "Document exceeds maximum size of {} bytes",
            MAX_DOCUMENT_BYTES
        ));
    }
    let document =
        SerialDocumentV1::from_json(document).map_err(|err| format!("Invalid document: {err}"))?;
    visit_embeds(&document.nodes, &mut |embed| {
        let game = ctx
            .db
            .minigame_registry()
            .embed_id()
            .find(&embed.embed_id)
            .filter(|game| game.status == APPROVED)
            .ok_or_else(|| format!("Minigame '{}' is not approved", embed.embed_id))?;
        validate_params(&game, &embed.params)
    })?;
    Ok(document)
}

fn visit_embeds(
    nodes: &[DocumentNode],
    visit: &mut impl FnMut(&GameEmbed) -> Result<(), String>,
) -> Result<(), String> {
    for node in nodes {
        match node {
            DocumentNode::GameEmbed(embed) => visit(embed)?,
            DocumentNode::Panel(panel) => visit_embeds(&panel.children, visit)?,
            _ => (),
        }
    }
    Ok(())
}
