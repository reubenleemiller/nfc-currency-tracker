#!/bin/sh
set -eu
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/nfc-currency-deploy.lock
  flock -n 9 || { echo "A deployment is already running."; exit 1; }
fi
git pull --ff-only
docker compose build app
docker compose up -d db
docker compose up -d --remove-orphans app caddy
attempt=0
until docker compose exec -T app node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>{if(!r.ok)process.exit(1)})"; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { docker compose logs app; exit 1; }
  sleep 2
done
docker image prune -f >/dev/null
echo "Deployment healthy at https://${DOMAIN}"
