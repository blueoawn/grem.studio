# grem.studio
website

## Updating the live site

On the host, from the repository root:

```bash
export SITE_FEED_OWNER_IDENTITY=<spacetime login show identity hex>
./deploy.sh              # pull, republish the site-feed module, rebuild /admin, the feed widget and web-serial, restart services
./deploy.sh --wipe-data  # only for breaking schema changes: deletes every post and account, then prompts for a new admin
```

Services restart with `systemctl --user` by default; set `SYSTEMCTL="sudo systemctl"` if they are system units.
nginx needs `/web-serial/` and `/publisher/` proxied to port 8083 (see `web-serial/README.md`).
