# Releasing Drinkwater

A personal cheat-sheet for shipping a release. There are three deploy tracks —
**backend**, **web**, and **desktop** — and they release in that order so the
frontends always meet a verified API.

```
push to main ─► Backend CD (GHCR image) ─► Web Deploy (Cloudflare Pages)
                                        └─► Desktop Release (GitHub Release + auto-update)
```

Backend image lands first; web and desktop both fire automatically off the same
backend-verified commit once Backend CD goes green.

---

## TL;DR

| I want to…            | Do this                                                       |
| --------------------- | ------------------------------------------------------------- |
| Ship backend to prod  | WSL → `cd deploy/ansible` → `ansible-playbook deploy.yml`     |
| Ship web              | Nothing — auto-deploys after Backend CD passes on `main`      |
| Cut a desktop release | `cd web-desktop && pnpm run release <X.Y.Z>`, then commit/tag |

---

## 🖥️ Desktop release

The desktop app ships as a GitHub Release (Windows installer + signed
`latest.json`). Installed copies auto-update from the latest Release via
`tauri-plugin-updater`.

**Steps (run from `web-desktop`):**

```bash
# 1. Bump the version in lockstep across package.json, tauri.conf.json, Cargo.toml
pnpm run release 1.0.0

# 2. Review, then commit, and push
git commit -am "chore: release v1.0.0"
git push
```

What happens next:

- **Normal path:** merging the version bump to `main` triggers Backend CD; once
  it's green, `cd-desktop.yml` sees `package.json`'s version has no tag yet,
  builds the Windows installer, signs the update artifacts, and publishes the
  `vX.Y.Z` Release. If the version is already tagged, the workflow skips cleanly
  (no failure).
- **Manual fallback:** pushing a `v*` tag directly forces a desktop-only release,
  bypassing the backend gate:

```bash
git tag v1.0.0
git push --tags
```

Release notes are auto-generated from Conventional Commits (`cliff.toml`), so
write good commit messages.

---

## ⚙️ Backend release

Two parts: the **image** publishes automatically; the **prod rollout** is manual.

1. **Image** — every push to `main` runs Backend CD (`cd-backend.yml`), which
   verifies and pushes `ghcr.io/ducktivity/drinkwater-backend:latest` (plus an
   immutable `sha-<gitsha>` tag) to GHCR.
2. **Rollout** — from WSL, run the Ansible playbook to pull the new image onto
   the prod box, apply expand-only migrations, and recreate changed containers:

   ```bash
   cd deploy/ansible
   ansible-playbook deploy.yml

   # dry-run first if unsure
   ansible-playbook deploy.yml --check --diff
   ```

   To pin/rollback a specific build, set `image_tag: sha-<gitsha>` in
   `group_vars/prod/vars.yml`.

> First-time Ansible setup (WSL, Cloudflare Access service token, vault, SSH):
> see [`deploy/ansible/README.md`](../deploy/ansible/README.md).

---

## 🌐 Web release

Fully automatic. After Backend CD succeeds on `main`, `cd-web.yml` builds the
SolidJS app and deploys it to Cloudflare Pages (`drinkwater-web`) at the same
verified commit. Nothing to run by hand.

---

## 🔐 GitHub repo secrets

Settings → Secrets and variables → Actions.

| Secret                               | Used by         | What it's for / how to obtain                                                                                                                                                                                                                                                  |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TAURI_SIGNING_PRIVATE_KEY`          | Desktop Release | Signs the auto-update artifacts so installed apps trust the update. Generate with `pnpm tauri signer generate -w ~/.tauri/drinkwater.key`; this secret is the **private key file's contents**. The public half goes in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Desktop Release | The password you set when generating the key above. Leave empty if you generated it without a password.                                                                                                                                                                        |
| `CLOUDFLARE_API_TOKEN`               | Web Deploy      | Lets Wrangler deploy to Pages. Cloudflare dashboard → My Profile → API Tokens → Create Token with **Account › Cloudflare Pages › Edit** permission.                                                                                                                            |
| `CLOUDFLARE_ACCOUNT_ID`              | Web Deploy      | Identifies the account to deploy into. Cloudflare dashboard → Workers & Pages → right sidebar (Account ID).                                                                                                                                                                    |

There's also a repo **variable** (not secret): `VITE_API_BASE_URL` — the backend
URL baked into the web + desktop bundles.

---

## 🗝️ Ansible secrets

Stored encrypted in Ansible Vault. Required keys are documented in
[`deploy/ansible/group_vars/prod/vault.example.yml`](../deploy/ansible/group_vars/prod/vault.example.yml):
`vault_database_url`, `vault_sentry_dsn`, `vault_cloudflare_tunnel_token`,
`vault_betterstack_source_token`, `vault_betterstack_ingest_host`,
`vault_auth_jwt_secret`, `vault_resend_api_key`.

```bash
cd deploy/ansible
ansible-vault edit group_vars/prod/vault.yml   # change a secret, then re-deploy
```

---

## ⏰ Expiry reminders

Renew these before they lapse — deploys break silently otherwise.

| Credential                              | Where                                                                                          | Expires     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- |
| `vault_cloudflare_tunnel_token` (Vault) | Cloudflare → Zero Trust → Access → Service Auth → Service Tokens (`Ducktivity Ansible Deploy`) | 21 Jun 2027 |
| `CLOUDFLARE_API_TOKEN` (repo secret)    | Cloudflare → My Profile → API Tokens                                                           | 22 Jun 2027 |
