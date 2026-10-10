# scripts/

Operational files for the PIXNIVO VM. **Nothing in this folder is part of the website and it must never be served.**

| File | What it does |
|---|---|
| `deploy_ui.sh` | Hard-resets `/var/www/html` to `origin/main`, ensures `client_max_body_size 50M` in nginx, restarts nginx. Use for HTML/CSS/JS changes. |
| `deploy_backend.sh` | Pulls `main`, installs system deps, copies `backend/` into `/opt/pixnivo-backend`, rebuilds the venv, (re)writes the `pixnivo-ocr` systemd unit, adds the `/api/` proxy to nginx if missing, restarts both. |
| `nginx/pixnivo-private-paths.conf` | nginx rules that 404 `.git/`, `scripts/`, `tests/`, `backend/`, other dotfiles and root tooling files. |

Both deploy scripts run **on the server** and only use absolute paths (`/var/www/html`, `/opt/pixnivo-backend`), so they work from any working directory. Run them on the VM from your machine, for example:

```bash
ssh <user>@<vm> 'bash -s' < scripts/deploy_ui.sh
```

or with the Azure CLI: `az vm run-command invoke -g <resource-group> -n <vm> --command-id RunShellScript --scripts @scripts/deploy_ui.sh`

## Keeping scripts/ (and the rest of the repo) private

`/var/www/html` is a git checkout, so without these rules nginx serves `.git/`, `backend/`, `scripts/` and `tests/` as files. Install the rules once on the server:

```bash
sudo install -m 644 /var/www/html/scripts/nginx/pixnivo-private-paths.conf /etc/nginx/snippets/pixnivo-private-paths.conf
grep -ln "root /var/www/html" /etc/nginx/sites-enabled/*
```

In **every** file that `grep` lists, add this line inside each `server { }` block, above `location / {` and any other regex `location`s:

```nginx
include snippets/pixnivo-private-paths.conf;
```

Then test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The snippet is copied into `/etc/nginx/snippets/` instead of included from the repo so that a `git reset --hard` can never break or silently drop the server config. Re-copy it if you change it.

Check from anywhere. Every line should print `404` except `/index.html`, which should print `200`:

```bash
for p in /.git/config /backend/data/auth.json /scripts/deploy_ui.sh /package.json /index.html; do curl -s -o /dev/null -w "%{http_code} $p\n" "https://pixnivo.app$p"; done
```

Run the same loop against `https://admin.pixnivo.app`.

If the site is ever deployed on Netlify instead, the same paths are forced to 404 at the top of `_redirects`.

## Caveat in deploy_backend.sh

It writes the systemd unit with `--port 8000` but only patches nginx's `/api/` proxy when that block is missing. If the server's proxy was moved to another port (the old `fix_port.sh` switched both to 8001), check `grep -rn proxy_pass /etc/nginx/sites-enabled/` before re-running, or the API will 502.

## tests/

Node smoke tests for the logo-generator ES modules, run from the repo root: `for f in tests/*.js; do node "$f" || break; done`
