//! One account system for the whole site. Admins (`is_admin`) use grem.studio/admin/ and
//! can do everything; publishers write web serial posts at grem.studio/publisher/.
//! Admin accounts are made by the server operator; publisher accounts by an admin or the operator.

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use spacetimedb::rand::Rng;
use spacetimedb::{ReducerContext, SpacetimeType, Table, ViewContext};

use crate::now_micros;
use crate::serial::serial_posts__view;

// -- Tables --

/// Private: password hashes never leave the server.
#[spacetimedb::table(name = accounts)]
pub struct Account {
    #[primary_key]
    pub username: String,
    pub password_hash: String,
    /// Indexed so views can list every account (views can only read through indexes).
    #[index(btree)]
    pub is_admin: bool,
    pub created_at: u64,
}

/// Private: each client reads only its own login, through `my_account`.
#[spacetimedb::table(name = sessions)]
pub struct Session {
    #[primary_key]
    pub identity: spacetimedb::Identity,
    #[index(btree)]
    pub username: String,
}

// -- Views --

#[derive(SpacetimeType)]
pub struct MyAccount {
    pub username: String,
    pub is_admin: bool,
}

/// The caller's own login, or nothing.
#[spacetimedb::view(name = my_account, public)]
fn my_account(ctx: &ViewContext) -> Option<MyAccount> {
    let session = ctx.db.sessions().identity().find(ctx.sender)?;
    let account = ctx.db.accounts().username().find(&session.username)?;
    Some(MyAccount { username: account.username, is_admin: account.is_admin })
}

/// Never includes the password hash.
#[derive(SpacetimeType)]
pub struct AccountSummary {
    pub username: String,
    pub is_admin: bool,
    pub created_at: u64,
    pub serial_posts: u32,
    pub active_sessions: u32,
}

/// Every account for a logged-in admin; empty for everyone else.
#[spacetimedb::view(name = account_audit, public)]
fn account_audit(ctx: &ViewContext) -> Vec<AccountSummary> {
    let caller_is_admin = ctx
        .db
        .sessions()
        .identity()
        .find(ctx.sender)
        .and_then(|session| ctx.db.accounts().username().find(&session.username))
        .is_some_and(|account| account.is_admin);
    if !caller_is_admin {
        return Vec::new();
    }

    let accounts = ctx.db.accounts().is_admin();
    accounts
        .filter(true)
        .chain(accounts.filter(false))
        .map(|account| AccountSummary {
            serial_posts: ctx.db.serial_posts().created_by().filter(&account.username).count() as u32,
            active_sessions: ctx.db.sessions().username().filter(&account.username).count() as u32,
            created_at: account.created_at,
            is_admin: account.is_admin,
            username: account.username,
        })
        .collect()
}

// -- Owner identity (the operator's CLI, baked in at publish time) --

// Dev-only placeholder: matches no real identity. option_env! is read at compile time, so
// any rebuild without SITE_FEED_OWNER_IDENTITY silently reverts to this and locks out the
// real operator; require_owner fails loudly instead of with an indistinguishable "not you".
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

fn hash_password(ctx: &ReducerContext, password: &str) -> Result<String, String> {
    let mut salt_bytes = [0u8; 16];
    ctx.rng().fill(&mut salt_bytes);
    let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| "Unable to create password salt".to_string())?;
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| "Unable to hash password".to_string())
}

fn verify_password(password: &str, stored_hash: &str) -> bool {
    PasswordHash::new(stored_hash)
        .ok()
        .and_then(|hash| Argon2::default().verify_password(password.as_bytes(), &hash).ok())
        .is_some()
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

fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 12 || password.len() > 72 {
        return Err("Password must be 12-72 characters".into());
    }
    Ok(())
}

/// The logged-in account making this call, if any.
pub(crate) fn current_account(ctx: &ReducerContext) -> Option<Account> {
    let session = ctx.db.sessions().identity().find(&ctx.sender)?;
    ctx.db.accounts().username().find(&session.username)
}

/// The calling admin's username. Reads the account, not the session, so removing an
/// account or its admin flag takes effect immediately.
pub(crate) fn require_admin(ctx: &ReducerContext) -> Result<String, String> {
    current_account(ctx)
        .filter(|account| account.is_admin)
        .map(|account| account.username)
        .ok_or_else(|| "Must be logged in as an admin".to_string())
}

fn create_account(ctx: &ReducerContext, username: &str, password: &str, is_admin: bool) -> Result<(), String> {
    let username = validate_username(username)?;
    validate_password(password)?;
    if ctx.db.accounts().username().find(&username).is_some() {
        return Err(format!("Account '{}' already exists", username));
    }
    ctx.db.accounts().insert(Account {
        password_hash: hash_password(ctx, password)?,
        username,
        is_admin,
        created_at: now_micros(ctx),
    });
    Ok(())
}

/// Logs the account out everywhere, then removes it. Posts stay up under the same name.
fn delete_account(ctx: &ReducerContext, account: &Account) {
    let sessions: Vec<Session> = ctx.db.sessions().username().filter(&account.username).collect();
    for session in sessions {
        ctx.db.sessions().identity().delete(&session.identity);
    }
    ctx.db.accounts().username().delete(&account.username);
}

fn find_account(ctx: &ReducerContext, username: &str) -> Result<Account, String> {
    let username = validate_username(username)?;
    ctx.db
        .accounts()
        .username()
        .find(&username)
        .ok_or_else(|| format!("Account '{}' does not exist", username))
}

// -- Login --

/// One login for /admin/ and /publisher/. Each page decides what the role may see;
/// every reducer checks the role again on the server.
#[spacetimedb::reducer]
pub fn login(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    let username = validate_username(&username)?;
    let account = ctx
        .db
        .accounts()
        .username()
        .find(&username)
        .filter(|account| verify_password(&password, &account.password_hash))
        .ok_or_else(|| "Invalid username or password".to_string())?;

    ctx.db.sessions().identity().delete(&ctx.sender);
    ctx.db.sessions().insert(Session { identity: ctx.sender, username: account.username });
    Ok(())
}

#[spacetimedb::reducer]
pub fn logout(ctx: &ReducerContext) -> Result<(), String> {
    ctx.db.sessions().identity().delete(&ctx.sender);
    Ok(())
}

// -- Admin accounts (operator CLI only: scripts/add-admin.mjs, scripts/manage-admins.mjs) --

#[spacetimedb::reducer]
pub fn create_admin_account(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    require_owner(ctx)?;
    create_account(ctx, &username, &password, true)
}

#[spacetimedb::reducer]
pub fn delete_admin_account(ctx: &ReducerContext, username: String) -> Result<(), String> {
    require_owner(ctx)?;
    let account = find_account(ctx, &username)?;
    if !account.is_admin {
        return Err(format!("'{}' is a publisher; use delete_publisher_account", account.username));
    }
    delete_account(ctx, &account);
    Ok(())
}

// -- Publisher accounts (admin console at /admin/, or the operator CLI) --

/// The calling admin's account, or None for the operator's CLI.
fn require_account_manager(ctx: &ReducerContext) -> Result<Option<Account>, String> {
    if require_owner(ctx).is_ok() {
        return Ok(None);
    }
    current_account(ctx)
        .filter(|account| account.is_admin)
        .map(Some)
        .ok_or_else(|| "Only admins can manage publisher accounts".to_string())
}

#[spacetimedb::reducer]
pub fn create_publisher_account(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    require_account_manager(ctx)?;
    create_account(ctx, &username, &password, false)
}

/// Admins re-enter their own password to confirm; the operator's CLI passes an empty string.
#[spacetimedb::reducer]
pub fn delete_publisher_account(ctx: &ReducerContext, username: String, confirm_password: String) -> Result<(), String> {
    if let Some(admin) = require_account_manager(ctx)? {
        if !verify_password(&confirm_password, &admin.password_hash) {
            return Err("Your password is incorrect".into());
        }
    }
    let account = find_account(ctx, &username)?;
    if account.is_admin {
        return Err("Admins can only be removed by the server operator".into());
    }
    delete_account(ctx, &account);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_password, validate_username};

    #[test]
    fn passwords_must_be_12_to_72_characters() {
        assert!(validate_password("short").is_err());
        assert!(validate_password("twelve-chars").is_ok());
        assert!(validate_password(&"x".repeat(73)).is_err());
    }

    #[test]
    fn usernames_are_trimmed_and_restricted() {
        assert_eq!(validate_username("  ana_1 ").unwrap(), "ana_1");
        assert!(validate_username("ana smith").is_err());
    }
}
