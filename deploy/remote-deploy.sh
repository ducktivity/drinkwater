#!/usr/bin/env bash
# Runs on YOUR machine (Git Bash / WSL), NOT the box. One command to deploy or explicitly roll back to a specific commit: opens the Cloudflare Access tunnel and triggers the box's deploy.sh for that git sha over SSH. This is the SAME path CI takes on a push to main — just invoked by hand — so it reuses deploy.sh's logic instead of duplicating it.
#
# It carries NOTHING to the box. The box already holds the git clone and the committed, encrypted .env.sops; deploy.sh checks out the sha (so the compose file + secrets match the image), decrypts .env, pins the matching sha-<short> image, gates on /readyz, and rolls back ON THE BOX if it fails. deploy.sh streams that progress back over this SSH session.
#
# The deploy SSH key is command-restricted (ssh-forced-command.sh) to exactly `deploy.sh <sha>`, so this sends precisely that full-path command and nothing else — no scp, no extra commands (which the forced command would reject anyway).
#
# Migrations are NOT run here; CI applies them (expand-only) as it builds each image, so any sha you deploy already has its schema live. This is an IMAGE revert only — NEVER roll the schema back with a down migration.
#
# Prereqs on your machine: cloudflared installed + the Cloudflare Access service token sourced (TUNNEL_SERVICE_TOKEN_ID / TUNNEL_SERVICE_TOKEN_SECRET).
#
# Usage:  ./deploy/remote-deploy.sh <full-git-sha>   e.g. 1a2b3c4d...e   (40 hex; from the green cd-backend.yml run or `git rev-parse` of the commit you want live)
set -euo pipefail

SHA="${1:?usage: remote-deploy.sh <full-git-sha>   (40-hex; deploy or roll back to that commit)}"
# Fail fast locally with a clear message; the box's forced command validates the same 40-hex shape.
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "error: expected a full 40-hex git sha, got: '$SHA'" >&2; exit 2; }

# Overridable config (sane suite defaults).
SSH_HOST="${SSH_HOST:-ducktivity-ssh.ducktvt.com}"
SSH_USER="${SSH_USER:-deploy}"
# Absolute path so the box's forced-command wrapper's `.../deploy.sh <sha>` pattern matches.
DEPLOY_SH="${DEPLOY_SH:-/opt/ducktivity/drinkwater/deploy/deploy.sh}"

# SSH rides Cloudflare Access (no open port on the box). ProxyCommand needs cloudflared + a sourced service token; see the prereqs above.
SSH_OPTS=(-o "ProxyCommand=cloudflared access ssh --hostname %h" -o StrictHostKeyChecking=accept-new)

echo "==> deploying git sha $SHA on $SSH_USER@$SSH_HOST"
# Send the full path + sha. On the restricted key sshd runs ssh-forced-command.sh, which re-parses the sha from $SSH_ORIGINAL_COMMAND and execs deploy.sh with it; on an unrestricted key deploy.sh runs directly with the sha as $1. Either way the box converges on this exact commit.
ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$DEPLOY_SH $SHA"
