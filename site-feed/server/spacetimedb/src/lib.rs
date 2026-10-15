use spacetimedb::{ReducerContext, Table};
use spacetimedb::rand::Rng;
use sha2::{Sha256, Digest};

// -- Tables --

#[spacetimedb::table(name = admin_accounts, public)]
pub struct AdminAccount {
    #[primary_key]
    pub username: String,
    pub password_hash: String,
    pub created_at: u64,
}

#[spacetimedb::table(name = logged_in_admins, public)]
pub struct LoggedInAdmin {
    #[primary_key]
    pub identity: spacetimedb::Identity,
    pub username: String,
    pub logged_in_at: u64,
}

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

// -- Owner identity (bakes in who may create new admin accounts) --

// Dev-only placeholder: matches no real identity. If this ends up published
// (SITE_FEED_OWNER_IDENTITY wasn't set in the shell that ran `cargo
// build`/`spacetime publish` — every build re-evaluates option_env!, so a
// rebuild without the var silently reverts to this and locks out even the
// real operator), require_owner below fails loudly instead of just denying
// everyone with an indistinguishable "not you" error.
const PLACEHOLDER_OWNER_IDENTITY_HEX: &str =
    "0000000000000000000000000000000000000000000000000000000000000000";

const OWNER_IDENTITY_HEX: &str = match option_env!("SITE_FEED_OWNER_IDENTITY") {
    Some(v) => v,
    None => PLACEHOLDER_OWNER_IDENTITY_HEX,
};

fn require_owner(ctx: &ReducerContext) -> Result<(), String> {
    if OWNER_IDENTITY_HEX == PLACEHOLDER_OWNER_IDENTITY_HEX {
        return Err(
            "Server misconfiguration: this module was published without SITE_FEED_OWNER_IDENTITY \
             set, so no identity (not even the real operator) can perform this action. Set \
             SITE_FEED_OWNER_IDENTITY to your `spacetime login show` identity and republish."
                .into(),
        );
    }
    let owner = spacetimedb::Identity::from_hex(OWNER_IDENTITY_HEX)
        .map_err(|_| "Server misconfiguration: invalid SITE_FEED_OWNER_IDENTITY".to_string())?;
    if ctx.sender != owner {
        return Err("This action may only be invoked by the server operator's CLI identity".into());
    }
    Ok(())
}

// -- Helpers --

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

fn hash_password(ctx: &ReducerContext, password: &str, username: &str) -> String {
    let mut salt_bytes = [0u8; 16];
    ctx.rng().fill(&mut salt_bytes);
    let salt = hex::encode(&salt_bytes);

    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    hasher.update(username.as_bytes());
    let hash = hasher.finalize();

    format!("{}:{}", salt, hex::encode(hash))
}

fn verify_password(password: &str, stored_hash: &str, username: &str) -> bool {
    let parts: Vec<&str> = stored_hash.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let salt = parts[0];
    let expected_hash = parts[1];

    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    hasher.update(username.as_bytes());
    let computed_hash = hex::encode(hasher.finalize());

    computed_hash == expected_hash
}

fn validate_username(username: &str) -> Result<String, String> {
    let trimmed = username.trim().to_string();
    if trimmed.is_empty() || trimmed.len() > 32 {
        return Err("Username must be 1-32 characters".into());
    }
    if !trimmed.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Username may only contain letters, digits, and underscores".into());
    }
    Ok(trimmed)
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

fn require_admin(ctx: &ReducerContext) -> Result<String, String> {
    ctx.db
        .logged_in_admins()
        .identity()
        .find(&ctx.sender)
        .map(|a| a.username)
        .ok_or_else(|| "Must be logged in as an admin".to_string())
}

// -- Lifecycle --

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {
    log::info!("Site Feed module initialized!");
}

// -- Auth Reducers --

#[spacetimedb::reducer]
pub fn login(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    let trimmed = validate_username(&username)?;

    let account = ctx
        .db
        .admin_accounts()
        .username()
        .find(&trimmed)
        .ok_or_else(|| "Invalid username or password".to_string())?;

    if !verify_password(&password, &account.password_hash, &account.username) {
        return Err("Invalid username or password".into());
    }

    let timestamp = now_micros(ctx);
    ctx.db.logged_in_admins().identity().delete(&ctx.sender);
    ctx.db.logged_in_admins().insert(LoggedInAdmin {
        identity: ctx.sender,
        username: account.username,
        logged_in_at: timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn logout(ctx: &ReducerContext) -> Result<(), String> {
    ctx.db.logged_in_admins().identity().delete(&ctx.sender);
    Ok(())
}

#[spacetimedb::reducer]
pub fn create_admin_account(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    require_owner(ctx)?;

    let trimmed = validate_username(&username)?;
    if password.len() < 8 {
        return Err("Password must be at least 8 characters".into());
    }
    if password.len() > 72 {
        return Err("Password too long (max 72 characters)".into());
    }
    if ctx.db.admin_accounts().username().find(&trimmed).is_some() {
        return Err(format!("Account '{}' already exists", trimmed));
    }

    let password_hash = hash_password(ctx, &password, &trimmed);
    let timestamp = now_micros(ctx);

    ctx.db.admin_accounts().insert(AdminAccount {
        username: trimmed,
        password_hash,
        created_at: timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_admin_account(ctx: &ReducerContext, username: String) -> Result<(), String> {
    require_owner(ctx)?;

    let trimmed = validate_username(&username)?;
    let account = ctx
        .db
        .admin_accounts()
        .username()
        .find(&trimmed)
        .ok_or_else(|| format!("Account '{}' does not exist", trimmed))?;

    // Log out any active sessions for this admin so a deleted account can't
    // keep acting through an already-authenticated identity.
    let sessions: Vec<_> = ctx
        .db
        .logged_in_admins()
        .iter()
        .filter(|s| s.username == account.username)
        .collect();
    for session in sessions {
        ctx.db.logged_in_admins().identity().delete(&session.identity);
    }

    ctx.db.admin_accounts().username().delete(&account.username);
    Ok(())
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
