#!/bin/bash
# Runs ON the server after the repo is deployed: installs scripts/nginx/private-paths.conf
# and includes it in every nginx server block whose root is /var/www/html. Backs up each edited
# file and rolls back automatically if `nginx -t` fails. Safe to re-run. See scripts/README.md.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"  # az run-command may start us with sh
set -euo pipefail

SRC=/var/www/html/scripts/nginx/private-paths.conf
SNIPPET=/etc/nginx/snippets/pixnivo-private-paths.conf
INCLUDE='include snippets/pixnivo-private-paths.conf;'
BACKUP_DIR=/root/nginx-backup-$(date +%Y%m%d-%H%M%S)

[ -f "$SRC" ] || { echo "FAIL: $SRC not found. Deploy the repo first (scripts/deploy_ui.sh)."; exit 1; }
sudo install -d /etc/nginx/snippets
sudo install -m 644 "$SRC" "$SNIPPET"
echo "Installed $SNIPPET"

# sites-enabled entries are usually symlinks: edit the real file, never the link.
mapfile -t FILES < <(sudo grep -lE '^\s*root\s+/var/www/html/?\s*;' /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null | xargs -r -n1 readlink -f | sort -u)
[ "${#FILES[@]}" -gt 0 ] || { echo "FAIL: no nginx config with 'root /var/www/html;' found. Send the output of: sudo nginx -T | grep -nE 'server_name|root|include'"; exit 1; }

sudo mkdir -p "$BACKUP_DIR"
CHANGED=()
for f in "${FILES[@]}"; do
  if sudo grep -qF "$INCLUDE" "$f"; then
    echo "Already included: $f"
    continue
  fi
  sudo cp -p "$f" "$BACKUP_DIR/$(basename "$f")"
  # Put the include right after each `root /var/www/html;`, at the same indentation.
  sudo sed -E -i "s|^([[:space:]]*)root[[:space:]]+/var/www/html/?[[:space:]]*;.*\$|&\n\1$INCLUDE|" "$f"
  CHANGED+=("$f")
  echo "Added include to $f:"
  sudo grep -nF "$INCLUDE" "$f"
done

if ! sudo nginx -t; then
  echo "FAIL: nginx -t rejected the config. Restoring backups from $BACKUP_DIR"
  for f in "${CHANGED[@]}"; do sudo cp -p "$BACKUP_DIR/$(basename "$f")" "$f"; done
  sudo nginx -t
  exit 1
fi

sudo systemctl reload nginx
echo "OK: nginx reloaded. Backups of the edited files are in $BACKUP_DIR"
for p in /.git/config /backend/data/auth.json /scripts/deploy_ui.sh /package.json /index.html; do
  curl -s -o /dev/null -w "%{http_code} $p\n" --resolve pixnivo.app:443:127.0.0.1 "https://pixnivo.app$p" || true
done
