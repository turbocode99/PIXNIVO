#!/bin/bash
# Runs ON the server: creates a 4 GB swap file as a safety net against out-of-memory
# kills (PaddleOCR can briefly need several GB). Low swappiness keeps it unused in
# normal operation. Safe to re-run. See scripts/README.md.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"  # az run-command may start us with sh
set -euo pipefail

SWAPFILE=/swapfile
SIZE=4G

if ! sudo swapon --show=NAME --noheadings | grep -qx "$SWAPFILE"; then
  if [ ! -f "$SWAPFILE" ]; then
    sudo fallocate -l "$SIZE" "$SWAPFILE"
    sudo chmod 600 "$SWAPFILE"
    sudo mkswap "$SWAPFILE"
  fi
  sudo swapon "$SWAPFILE"
fi
grep -qE "^$SWAPFILE\s" /etc/fstab || echo "$SWAPFILE none swap sw,nofail 0 0" | sudo tee -a /etc/fstab >/dev/null

echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/90-pixnivo-swap.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/90-pixnivo-swap.conf
swapon --show
