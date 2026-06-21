# Ansible deploy (WSL)

### 1. Enabling the `metadata` mount option, which lets `chmod` persist on `/mnt/c`:

1. Edit `/etc/wsl.conf` (read only on a **cold** WSL start, not on terminal close):

   ```bash
   sudo nano /etc/wsl.conf
   ```

   Add this (merge into an existing `[automount]` section if you already have one):

   ```ini
   [automount]
   options = "metadata,umask=022,fmask=011"
   ```

   Save & exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

2. Fully restart WSL **from Windows** (PowerShell/CMD) — not from inside WSL:

   ```powershell
   wsl --shutdown
   ```

   Wait ~8 seconds, then reopen Ubuntu.

3. Verify. `findmnt /mnt/c` should now list `metadata` in its options, and `chmod`
   should stick:

   ```bash
   cd /mnt/c/Users/<you>/.../drinkwater/deploy/ansible
   chmod 600 .vault_pass ~/.ssh/id_ed25519
   ls -l .vault_pass        # want -rw------- (no x), NOT -rwxrwxrwx
   ```

### 2. Install Ansible & cloudflared (WSL)

```bash
# Ansible + cloudflared on the control node
sudo apt-get update && sudo apt-get install -y pipx
pipx ensurepath && pipx install --include-deps ansible

sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

### 3. Essential configs

`chmod 600 <file>` on configs below:

- SSH key to box → `~/.ssh/id_ed25519` (set `ansible_ssh_private_key_file` in `inventory.ini`)
- Vault password, use a long & secure one → `.vault_pass` (set `vault_password_file` in `ansible.cfg`)

By default the SSH through Cloudflare Access needs an interactive **browser login**, which Ansible can't do. The fix for automation is a **service token**.

**One-time setup:**

1. Create a service credential on Zero Trust dashboard
2. **Hand the token to cloudflared** via the two env vars it reads. Keep them in a
   git-ignored, `chmod 600` file in your home and source it from
   `~/.bashrc`:

   ```bash
   # ~/.cf_service_token   (chmod 600)
   export TUNNEL_SERVICE_TOKEN_ID="<client-id>"
   export TUNNEL_SERVICE_TOKEN_SECRET="<client-secret>"
   ```

3. Persist on each terminal session

```bash
echo "source ~/.cf_service_token" >> ~/.bashrc
```

### 4. Create env secrets using Ansible Vault (uses .vault_pass via ansible.cfg)

```bash
cd deploy/ansible
ansible-vault create group_vars/prod/vault.yml # fill in keys from vault.example.yml
```

### 5. Verify Cloudflare Access + SSH work BEFORE the first deploy.

```bash
# Should land a shell with no browser prompt once the token is sourced:
source ~/.cf_service_token
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" \
 -i ~/.ssh/id_ed25519 deploy@ducktivity-ssh.ducktvt.com
```

## Daily use

```bash
cd deploy/ansible

# ship latest main
ansible-playbook deploy.yml

# change a secret
ansible-vault edit group_vars/prod/vault.yml && ansible-playbook deploy.yml

# dry-run
ansible-playbook deploy.yml --check --diff
```
