#!/bin/bash
# Runs ON the server: generates a new ADMIN_SECRET_KEY for the backend, loads it into
# pixnivo-ocr via a systemd drop-in, and restarts the service. All admin sessions are
# logged out. The secret is created on the server and never printed. See scripts/README.md.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"  # az run-command may start us with sh
set -euo pipefail

ENV_FILE=/etc/pixnivo/backend.env
DROPIN=/etc/systemd/system/pixnivo-ocr.service.d/10-env.conf

# Generated inside a root shell so the value never appears in argv or on screen.
# Other variables already in the file are kept.
sudo bash -c '
  set -euo pipefail
  umask 077
  mkdir -p /etc/pixnivo
  f='"$ENV_FILE"'
  touch "$f"
  { grep -v "^ADMIN_SECRET_KEY=" "$f" || true; echo "ADMIN_SECRET_KEY=$(openssl rand -hex 32)"; } > "$f.new"
  mv "$f.new" "$f"
  chown root:root "$f"
  chmod 600 "$f"
'

# A drop-in survives deploy_backend.sh rewriting the main unit file.
sudo mkdir -p "$(dirname "$DROPIN")"
printf '[Service]\nEnvironmentFile=%s\n' "$ENV_FILE" | sudo tee "$DROPIN" >/dev/null

sudo systemctl daemon-reload
sudo systemctl restart pixnivo-ocr

PID=$(systemctl show -p MainPID --value pixnivo-ocr)
if [ "$PID" != "0" ] && sudo grep -qz '^ADMIN_SECRET_KEY=' "/proc/$PID/environ"; then
  echo "OK: pixnivo-ocr (pid $PID) is running with ADMIN_SECRET_KEY set"
else
  echo "FAIL: ADMIN_SECRET_KEY is not in the service environment"; exit 1
fi

PORT=$(systemctl show -p ExecStart pixnivo-ocr | grep -oE -- '--port [0-9]+' | grep -oE '[0-9]+' || echo 8000)
echo "Waiting for the API on port $PORT (OCR models can take a minute to load)..."
for _ in $(seq 1 36); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health"; then
    echo "OK: /api/health responds. Every admin must log in again."
    exit 0
  fi
  sleep 5
done
echo "FAIL: API did not come back within 3 minutes. Check: sudo journalctl -u pixnivo-ocr -n 50 --no-pager"
exit 1
