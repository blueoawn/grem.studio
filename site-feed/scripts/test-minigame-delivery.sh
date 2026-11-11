#!/usr/bin/env bash
# Run with nginx, curl, and rg. Override NGINX_BIN, NGINX_MIME_TYPES, or MINIGAME_TEST_PORT if needed.
set -euo pipefail

site_feed="$(cd "$(dirname "$0")/.." && pwd)"
nginx="${NGINX_BIN:-nginx}"
port="${MINIGAME_TEST_PORT:-3316}"
fixture="$(mktemp -d)"
nginx_pid=''
cleanup() {
    if [[ -n "$nginx_pid" ]]; then
        kill "$nginx_pid" 2>/dev/null || true
        wait "$nginx_pid" 2>/dev/null || true
    fi
    rm -rf -- "$fixture"
}
trap cleanup EXIT

mkdir -p "$fixture/www/games/"{maze,directory/index.html,symlink}
echo '<!doctype html><title>Maze fixture</title>' > "$fixture/www/games/maze/index.html"
ln -s "$fixture/www/games/maze/index.html" "$fixture/www/games/symlink/index.html"
cat > "$fixture/nginx.conf" <<EOF
error_log "$fixture/error.log";
pid "$fixture/nginx.pid";
events {}
http {
    include "${NGINX_MIME_TYPES:-/etc/nginx/mime.types}";
    client_body_temp_path "$fixture/client_body";
    proxy_temp_path "$fixture/proxy";
    fastcgi_temp_path "$fixture/fastcgi";
    uwsgi_temp_path "$fixture/uwsgi";
    scgi_temp_path "$fixture/scgi";
    access_log off;
    server {
        listen 127.0.0.1:$port;
        root "$fixture/www";
        include "$site_feed/deploy/minigames.nginx.conf";
    }
}
EOF

"$nginx" -p "$fixture/" -c "$fixture/nginx.conf" -g 'daemon off; master_process off;' &
nginx_pid=$!
base="http://127.0.0.1:$port"
for _ in {1..25}; do
    if curl --noproxy '*' -sS -o /dev/null "$base/" 2>/dev/null; then break; fi
    sleep 0.1
done

assert_response() {
    local method="$1" path="$2" expected="$3" status
    local -a args=()
    if [[ "$method" == HEAD ]]; then args+=(--head); fi
    status="$(curl --noproxy '*' -sS --path-as-is -o /dev/null -D "$fixture/headers" \
        -w '%{http_code}' "${args[@]}" "$base$path")"
    if [[ "$status" != "$expected" ]]; then
        echo "$method $path returned $status, expected $expected" >&2
        exit 1
    fi
    if rg -qi '^location:' "$fixture/headers"; then
        echo "$method $path returned a redirect location" >&2
        exit 1
    fi
}

for method in GET HEAD; do
    assert_response "$method" '/games/maze/index.html?next=https%3A%2F%2Felsewhere.example' 200
    assert_response "$method" '/games/maze' 404
    assert_response "$method" '/games/maze/' 404
    assert_response "$method" '/games/maze/missing.html' 404
    assert_response "$method" '/games/directory/index.html' 404
    assert_response "$method" '/games/symlink/index.html' 404
    assert_response "$method" '/unapproved-destination' 404
done
echo 'PASS: static game routes serve files and never redirect for query strings, directories, symlinks, or missing files'

assert_response HEAD '/games/maze/index.html' 200
rg -qi '^Content-Type: text/html' "$fixture/headers"
rg -qi '^Content-Security-Policy: sandbox allow-scripts; .*frame-ancestors https://grem\.studio' "$fixture/headers"
rg -qi '^Permissions-Policy: .*fullscreen=\(\).*microphone=\(\)' "$fixture/headers"
rg -qi '^Access-Control-Allow-Origin: https://grem\.studio' "$fixture/headers"
echo 'PASS: static responses set the script-only sandbox, embedding origin, and feature restrictions'
