# scripts/

Operational files for the PIXNIVO VM. **Nothing in this folder is part of the website and it must never be served.**

| File | What it does |
|---|---|
| `deploy_ui.sh` | Hard-resets `/var/www/html` to `origin/main`, ensures `client_max_body_size 50M` in nginx, restarts nginx. Use for HTML/CSS/JS changes. |
| `deploy_backend.sh` | Pulls `main`, installs system deps, copies `backend/` into `/opt/pixnivo-backend`, rebuilds the venv, (re)writes the `pixnivo-ocr` systemd unit, adds the `/api/` proxy to nginx if missing, restarts both. |
| `rotate_admin_secret.sh` | Generates a new `ADMIN_SECRET_KEY` on the server into `/etc/pixnivo/backend.env` (root-only), loads it via a systemd drop-in, restarts `pixnivo-ocr`, and waits for `/api/health`. Logs out every admin session. The secret is never printed. |
| `install_nginx_private_paths.sh` | Installs `nginx/pixnivo-private-paths.conf` and includes it in every server block with `root /var/www/html`. Backs up edited files to `/root/nginx-backup-*` and rolls back if `nginx -t` fails. Safe to re-run. |
| `nginx/pixnivo-private-paths.conf` | nginx rules that 404 `.git/`, `scripts/`, `tests/`, `backend/`, other dotfiles and root tooling files. |

All scripts run **on the server** and only use absolute paths, so they work from any working directory. From your machine (PowerShell or Git Bash), copy the script up and run it with a terminal attached, so `sudo` can prompt if it needs to:

```bash
scp scripts/deploy_ui.sh <user>@<vm>:/tmp/
```

```bash
ssh -t <user>@<vm> "bash /tmp/deploy_ui.sh"
```

Or with the Azure CLI: `az vm run-command invoke -g <resource-group> -n <vm> --command-id RunShellScript --scripts @scripts/deploy_ui.sh`

`.gitattributes` keeps these files LF on checkout. A CRLF copy would break bash on the server.

## Keeping scripts/ (and the rest of the repo) private

`/var/www/html` is a git checkout, so without these rules nginx serves `.git/`, `backend/`, `scripts/` and `tests/` as files. After deploying the repo, run `install_nginx_private_paths.sh` once (as above). It copies the snippet to `/etc/nginx/snippets/` rather than including it from the repo, so a `git reset --hard` can never break or silently drop the server config. Re-run it whenever the snippet changes.

To do it by hand instead, copy the snippet to `/etc/nginx/snippets/` and add `include snippets/pixnivo-private-paths.conf;` inside each `server { }` block whose root is `/var/www/html`, above `location / {` and any other regex `location`s. Then run `sudo nginx -t && sudo systemctl reload nginx`.

Check from anywhere. Every line should print `404` except `/index.html`, which should print `200`:

```bash
for p in /.git/config /backend/data/auth.json /scripts/deploy_ui.sh /package.json /index.html; do curl -s -o /dev/null -w "%{http_code} $p\n" "https://pixnivo.app$p"; done
```

Run the same loop against `https://admin.pixnivo.app`.

If the site is ever deployed on Netlify instead, the same paths are forced to 404 at the top of `_redirects`.

## Backend secrets

The backend reads `ADMIN_SECRET_KEY` (signs admin sessions) from `/etc/pixnivo/backend.env`, loaded by the drop-in `/etc/systemd/system/pixnivo-ocr.service.d/10-env.conf`. The drop-in survives `deploy_backend.sh` rewriting the main unit file. Rotate the secret with `rotate_admin_secret.sh`. Other variables in that file are kept.

## Caveat in deploy_backend.sh

It writes the systemd unit with `--port 8000` but only patches nginx's `/api/` proxy when that block is missing. If the server's proxy was moved to another port (the old `fix_port.sh` switched both to 8001), check `grep -rn proxy_pass /etc/nginx/sites-enabled/` before re-running, or the API will 502.

## tests/

Node smoke tests for the logo-generator ES modules, run from the repo root: `for f in tests/*.js; do node "$f" || break; done`
