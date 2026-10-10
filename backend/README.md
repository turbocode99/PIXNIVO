# PIXNIVO backend

FastAPI app (`main.py`) serving OCR, barcode export, the public blog API and the admin portal API.
On the server it runs from `/opt/pixnivo-backend` as the systemd service `pixnivo-ocr`, written by
`deploy_backend.sh`. `deploy_backend.sh`, `deploy_backend_patch.sh` and the other deploy scripts copy
`backend/main.py` there. A `git pull` into `/var/www/html` on its own does not update the running backend.

## Secrets: `/etc/pixnivo/backend.env`

The repo holds no secrets. Everything sensitive goes in `/etc/pixnivo/backend.env` on the server.
The systemd unit loads it with `EnvironmentFile=/etc/pixnivo/backend.env`. The file must be owned by
root with mode `600`. `deploy_backend.sh` refuses to run if it is missing. Never commit it, and never
copy its values into scripts, tests or commit messages.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_SECRET_KEY` | yes, for admin | HMAC key that signs admin session tokens. At least 32 characters. If it is missing or shorter, every `/api/auth/*` and `/api/admin/*` endpoint returns 503. The public OCR, barcode and blog endpoints keep working. |
| `ADMIN_PASSWORD` | first run only | Used only when the admin credentials file does not exist yet. Creates the admin account with this password. Remove it after the first login. |
| `ADMIN_USERNAME` | no | Admin login name for a newly created account. Default `admin@pixnivo.app`. |
| `ADMIN_AUTH_FILE` | no | Path of the admin credentials file. Default: `data/auth.json` next to `main.py`, which is `/opt/pixnivo-backend/data/auth.json` on the server. |
| `AGENTROUTER_API_KEY` | no | API key for the logo generator proxy, if used. |

Create the file as root. Generate a fresh secret on the server; never reuse a value that has been in git:

```bash
sudo install -d -m 700 -o root -g root /etc/pixnivo
sudo sh -c 'umask 077; printf "ADMIN_SECRET_KEY=%s\n" "$(openssl rand -hex 32)" > /etc/pixnivo/backend.env'
sudo chown root:root /etc/pixnivo/backend.env
sudo chmod 600 /etc/pixnivo/backend.env
```

To set the first admin password, open the file with `sudo nano /etc/pixnivo/backend.env` and add the line
`ADMIN_PASSWORD=...`. Using an editor keeps the password out of shell history. The password needs
at least 10 characters with uppercase, lowercase and a digit. Avoid spaces, quotes, backslashes and `$`,
because systemd parses the file.

If the server's unit was written before this change, it does not load the file yet. Either re-run
`deploy_backend.sh`, or add a drop-in. Check that the unit's port matches nginx before re-running the
script: `fix_port.sh` may have moved the service to 8001. To add a drop-in:

```bash
sudo mkdir -p /etc/systemd/system/pixnivo-ocr.service.d
printf '[Service]\nEnvironmentFile=/etc/pixnivo/backend.env\n' | sudo tee /etc/systemd/system/pixnivo-ocr.service.d/secrets.conf
sudo systemctl daemon-reload
```

## Admin account: first run and password rotation

Admin credentials are a PBKDF2 hash and salt in the credentials file (see `ADMIN_AUTH_FILE`). That file
is created on the server and is git-ignored. The backend never falls back to built-in credentials.
If the file is missing and `ADMIN_PASSWORD` is unset, or the file is unreadable, admin login
stays disabled and the reason is logged.

To create the account, or to reset a password you no longer trust:

1. Put `ADMIN_PASSWORD=<new password>` in `/etc/pixnivo/backend.env`.
2. Move the old credentials file out of the way: `sudo mv /opt/pixnivo-backend/data/auth.json /root/auth.json.old`.
3. Restart with `sudo systemctl restart pixnivo-ocr`. Then check the log with
   `sudo journalctl -u pixnivo-ocr -n 100 | grep SECURITY`. It should report that the admin account was created.
4. Log in to the admin portal. Then delete the `ADMIN_PASSWORD` line and restart the service again.
   Delete `/root/auth.json.old` once everything works.

Changing `ADMIN_SECRET_KEY` logs out every admin session.

## Local development

Export the same variables before starting uvicorn, e.g. a random `ADMIN_SECRET_KEY` and a dev-only
`ADMIN_PASSWORD`. `test_admin_api.py` generates throwaway values and a temporary credentials
file by itself.
