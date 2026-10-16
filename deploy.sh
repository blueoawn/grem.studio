#!/usr/bin/env bash
# Update grem.studio on the host: pull, republish the site-feed SpacetimeDB module
# (which also hosts the web serial and all accounts), rebuild the apps, restart services.
#
# Usage:
#   SITE_FEED_OWNER_IDENTITY=<hex> ./deploy.sh              # normal update, keeps data
#   SITE_FEED_OWNER_IDENTITY=<hex> ./deploy.sh --wipe-data  # breaking schema change: deletes ALL data
#   ./deploy.sh --skip-pull                                 # build what is already checked out
#
# Environment:
#   SITE_FEED_OWNER_IDENTITY  required; `spacetime login show` identity, baked in at publish time
#   SITE_FEED_DB              database name (default: site-feed)
#   SYSTEMCTL                 how to restart services (default: "systemctl --user")

set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }

WIPE=false
PULL=true
for arg in "$@"; do
  case "$arg" in
    --wipe-data) WIPE=true ;;
    --skip-pull) PULL=false ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="${SITE_FEED_DB:-site-feed}"
read -r -a SYSTEMCTL_CMD <<< "${SYSTEMCTL:-systemctl --user}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

# Non-interactive SSH sessions don't load nvm; the services use the nvm Node too.
if ! command -v npm >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi
command -v npm >/dev/null 2>&1 || fail "npm not found"
command -v spacetime >/dev/null 2>&1 || fail "spacetime CLI not found"

# option_env! bakes the owner in at compile time; publishing without it locks the operator
# out of create_admin_account and friends until the next correct publish.
[ -n "${SITE_FEED_OWNER_IDENTITY:-}" ] || fail "SITE_FEED_OWNER_IDENTITY is not set (see: spacetime login show)"
if ! spacetime login show 2>/dev/null | grep -qi "$SITE_FEED_OWNER_IDENTITY"; then
  fail "SITE_FEED_OWNER_IDENTITY does not match the identity in 'spacetime login show'"
fi

if $WIPE; then
  echo "--wipe-data deletes EVERY table in '$DB': site-feed posts, web serial posts and all accounts."
  read -r -p "Type the database name to confirm: " answer
  [ "$answer" = "$DB" ] || fail "Confirmation did not match; nothing was changed"
fi

cd "$ROOT"

if $PULL; then
  step "Pulling latest code"
  # feed-widget.js is a build output this script rewrites; drop the local copy so the pull is clean.
  git restore --source=HEAD -- feed-widget.js 2>/dev/null || true
  git pull --ff-only
  git submodule update --init --recursive
  # web-serial may be its own repository rather than a tracked folder.
  if [ -d web-serial/.git ]; then git -C web-serial pull --ff-only; fi
fi

step "Publishing SpacetimeDB module '$DB'"
publish_args=(publish "$DB" -y)
$WIPE && publish_args+=(--delete-data)
(cd site-feed/server/spacetimedb && spacetime "${publish_args[@]}")

build() {
  step "Building $1"
  (cd "$1" && npm ci && npm run generate && npm run build)
}
build site-feed/admin
build site-feed/widget
cp site-feed/widget/dist/feed-widget.js "$ROOT/feed-widget.js"
build web-serial

step "Restarting services"
"${SYSTEMCTL_CMD[@]}" restart site-feed-admin.service web-serial.service

if $WIPE; then
  step "Creating the first admin (the wipe removed every account)"
  (cd site-feed/scripts && npm ci && node add-admin.mjs)
fi

step "Done"
echo "If index.php still serves an old feed widget from cache, bump its feed-widget.js?v= number."
