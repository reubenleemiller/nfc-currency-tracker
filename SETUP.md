# Production Setup

This guide assumes a fresh Linux VM and a domain name you control. The app, database, and HTTPS certificate all run on that VM.

## 1. Prepare DNS and the firewall

1. Find the VM's public IP in your hosting account.
2. In your DNS provider, create an `A` record such as `rewards.example.org` pointing to that IP. Remove an incorrect `AAAA` record unless the VM has working IPv6.
3. Allow inbound TCP ports `22`, `80`, and `443`, plus UDP `443`, in the provider firewall. Do not expose database port `5432`.

## 2. Install Docker

Check the distribution with `cat /etc/os-release`. Docker's official convenience script works across common distributions:

```sh
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
```

Sign out and back in, then check `docker --version` and `docker compose version`. If the script does not support the distribution, follow the matching manual installation page at <https://docs.docker.com/engine/install/> and install both Docker Engine and the Compose plugin. Docker group membership gives root-equivalent access; only add trusted deployment users.

## 3. Download and configure

```sh
git clone YOUR_GITHUB_REPOSITORY_URL nfc-currency-tracker
cd nfc-currency-tracker
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set every value. Generate a session secret with `openssl rand -base64 48` and a separate URL-safe database password. `DOMAIN` is the public hostname without `https://`.

**Finalize `CARD_BASE_URL` before writing any NFC chip.** Cards are written once and may be locked. Changing this origin later invalidates every physical card, even if the main app moves to another hostname. A stable example is `https://cards.example.org`; point it at this VM and include it in Caddy if it differs from `DOMAIN`.

If card and app hostnames differ, change the first line of `Caddyfile` to `{$DOMAIN}, cards.example.org {`.

## 4. Start the app

```sh
chmod +x deploy.sh docker-entrypoint.sh
docker compose up -d --build
docker compose ps
```

Open `https://YOUR_DOMAIN`. Create the first teacher account with **Create a teacher account** on the login page. Check `https://YOUR_DOMAIN/api/health`; it should show `{"status":"ok"}`. Caddy requests and renews a trusted Let's Encrypt certificate automatically.

## 5. Automatic GitHub deployment

In the GitHub repository, open **Settings > Secrets and variables > Actions** and create:

- `DEPLOY_HOST`: VM hostname or IP.
- `DEPLOY_USER`: Linux user that owns the checkout and can run Docker.
- `DEPLOY_SSH_KEY`: private key whose public key is in that user's `~/.ssh/authorized_keys`.
- `DEPLOY_HOST_KEY`: output of `ssh-keyscan YOUR_VM_HOST` reviewed against the VM's real host fingerprint.
- `DEPLOY_PATH`: absolute checkout path, such as `/home/deploy/nfc-currency-tracker`.

A push to `main` runs type checks, tests, and a production build before connecting to the VM and running `deploy.sh`. The script pulls only fast-forward changes, rebuilds, runs migrations automatically before the app starts, and verifies health. It is safe to run repeatedly.

## Backups

Create a host directory and make one dated compressed database dump:

```sh
mkdir -p "$HOME/nfc-backups" && docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$HOME/nfc-backups/nfc-$(date +%F-%H%M).dump"
```

Sample daily cron entry at 2:15 AM. Replace `/absolute/project/path` and values with the real location and database names:

```cron
15 2 * * * cd /absolute/project/path && docker compose exec -T db pg_dump -U nfc_currency -d nfc_currency -Fc > /home/deploy/nfc-backups/nfc-$(date +\%F-\%H\%M).dump
```

Copy backups off the VM regularly. A backup on the same disk is not protection from disk loss. Test restores periodically. To restore into an empty database:

```sh
docker compose stop app
docker compose exec -T db dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose exec -T db createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < "$HOME/nfc-backups/YOUR_BACKUP.dump"
docker compose up -d app
```

## Troubleshooting

**Certificate is not issued:** Confirm the A record resolves to this VM, ports 80 and 443 are open, no stale AAAA record points elsewhere, and `DOMAIN` exactly matches DNS. Run `docker compose logs caddy`.

**Database will not connect:** Run `docker compose ps` and `docker compose logs db app`. Check that `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` match. Password punctuation with URL-reserved characters can break `DATABASE_URL`; use a long URL-safe password.
