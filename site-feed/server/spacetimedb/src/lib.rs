use spacetimedb::{ReducerContext, Table};

mod accounts;
mod serial;

use accounts::require_admin;

// -- Tables --

#[spacetimedb::table(name = posts, public)]
pub struct Post {
    #[primary_key]
    #[auto_inc]
    pub post_id: u64,
    pub title: String,
    pub body: String,
    /// The date the update is about, as chosen by the admin (micros since Unix epoch).
    pub post_date: u64,
    /// Empty string means "no link".
    pub link_url: String,
    /// Empty string means "no category".
    pub category: String,
    /// Empty string means "no image".
    pub image_url: String,
    /// Higher values appear earlier in the public feed.
    pub sort_order: u64,
    /// Archived posts remain available to admins but are omitted from the public feed.
    pub is_archived: bool,
    pub created_by: String,
    pub created_at: u64,
    pub updated_at: u64,
}

// -- Helpers --

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

fn validate_title(title: &str) -> Result<String, String> {
    let trimmed = title.trim().to_string();
    if trimmed.is_empty() || trimmed.len() > 150 {
        return Err("Title must be 1-150 characters".into());
    }
    Ok(trimmed)
}

fn validate_body(body: &str) -> Result<String, String> {
    let trimmed = body.trim().to_string();
    if trimmed.is_empty() || trimmed.len() > 3000 {
        return Err("Body must be 1-3000 characters".into());
    }
    Ok(trimmed)
}

fn validate_optional_url(url: &str, field_name: &str) -> Result<String, String> {
    let trimmed = url.trim().to_string();
    if trimmed.is_empty() {
        return Ok(trimmed);
    }
    if trimmed.len() > 500 {
        return Err(format!("{} too long (max 500 characters)", field_name));
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(format!("{} must start with http:// or https://", field_name));
    }
    Ok(trimmed)
}

fn validate_category(category: &str) -> Result<String, String> {
    let trimmed = category.trim().to_string();
    if trimmed.len() > 40 {
        return Err("Category must be 40 characters or fewer".into());
    }
    Ok(trimmed)
}

// -- Lifecycle --

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {
    log::info!("Site Feed module initialized!");
}

// -- Post Reducers --

#[spacetimedb::reducer]
pub fn create_post(
    ctx: &ReducerContext,
    title: String,
    body: String,
    post_date: u64,
    link_url: String,
    category: String,
    image_url: String,
) -> Result<(), String> {
    let username = require_admin(ctx)?;

    let title = validate_title(&title)?;
    let body = validate_body(&body)?;
    let link_url = validate_optional_url(&link_url, "Link")?;
    let category = validate_category(&category)?;
    let image_url = validate_optional_url(&image_url, "Image URL")?;

    let timestamp = now_micros(ctx);
    ctx.db.posts().insert(Post {
        post_id: 0,
        title,
        body,
        post_date,
        link_url,
        category,
        image_url,
        sort_order: timestamp,
        is_archived: false,
        created_by: username,
        created_at: timestamp,
        updated_at: timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn edit_post(
    ctx: &ReducerContext,
    post_id: u64,
    title: String,
    body: String,
    post_date: u64,
    link_url: String,
    category: String,
    image_url: String,
) -> Result<(), String> {
    require_admin(ctx)?;

    let existing = ctx
        .db
        .posts()
        .post_id()
        .find(&post_id)
        .ok_or_else(|| "Post not found".to_string())?;

    let title = validate_title(&title)?;
    let body = validate_body(&body)?;
    let link_url = validate_optional_url(&link_url, "Link")?;
    let category = validate_category(&category)?;
    let image_url = validate_optional_url(&image_url, "Image URL")?;

    ctx.db.posts().post_id().update(Post {
        title,
        body,
        post_date,
        link_url,
        category,
        image_url,
        updated_at: now_micros(ctx),
        ..existing
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_post(ctx: &ReducerContext, post_id: u64) -> Result<(), String> {
    require_admin(ctx)?;

    if let Some(post) = ctx.db.posts().post_id().find(&post_id) {
        ctx.db.posts().delete(post);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn set_post_archived(
    ctx: &ReducerContext,
    post_id: u64,
    is_archived: bool,
) -> Result<(), String> {
    require_admin(ctx)?;

    let existing = ctx
        .db
        .posts()
        .post_id()
        .find(&post_id)
        .ok_or_else(|| "Post not found".to_string())?;

    ctx.db.posts().post_id().update(Post {
        is_archived,
        updated_at: now_micros(ctx),
        ..existing
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn move_post(ctx: &ReducerContext, post_id: u64, move_up: bool) -> Result<(), String> {
    require_admin(ctx)?;

    let mut posts: Vec<_> = ctx
        .db
        .posts()
        .iter()
        .filter(|post| !post.is_archived)
        .collect();
    posts.sort_by(|left, right| {
        right
            .sort_order
            .cmp(&left.sort_order)
            .then_with(|| right.post_date.cmp(&left.post_date))
    });

    let position = posts
        .iter()
        .position(|post| post.post_id == post_id)
        .ok_or_else(|| "Post not found or archived".to_string())?;
    let target = if move_up {
        position.checked_sub(1)
    } else {
        position.checked_add(1).filter(|target| *target < posts.len())
    };

    let Some(target) = target else {
        return Ok(());
    };

    posts.swap(position, target);
    let timestamp = now_micros(ctx);
    let post_count = posts.len() as u64;
    for (index, post) in posts.into_iter().enumerate() {
        ctx.db.posts().post_id().update(Post {
            sort_order: post_count - index as u64,
            updated_at: timestamp,
            ..post
        });
    }

    Ok(())
}
