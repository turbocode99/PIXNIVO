#!/bin/bash
# Runs ON the server: pulls main, (re)installs the FastAPI backend in /opt/pixnivo-backend, restarts services. See scripts/README.md.
# Backend secrets (ADMIN_SECRET_KEY, ...) live only in /etc/pixnivo/backend.env on the
# server (root-owned, mode 600), never in this repo. See backend/README.md.
if ! sudo test -f /etc/pixnivo/backend.env; then
    echo "ERROR: /etc/pixnivo/backend.env is missing. Create it (root, mode 600) as described in backend/README.md, then re-run." >&2
    exit 1
fi
sudo git config --global --get-all safe.directory | grep -qx /var/www/html || sudo git config --global --add safe.directory /var/www/html
cd /var/www/html
sudo git pull origin main

sudo apt-get update
sudo apt-get install -y python3-pip python3-venv poppler-utils libgl1 libglib2.0-0

sudo mkdir -p /opt/pixnivo-backend/data
sudo mkdir -p /var/www/html/assets/uploads
sudo chmod -R 777 /var/www/html/assets/uploads
sudo cp /var/www/html/backend/main.py /var/www/html/backend/ocr_worker.py /opt/pixnivo-backend/
sudo cp /var/www/html/backend/requirements.txt /opt/pixnivo-backend/
if [ ! -f /opt/pixnivo-backend/data/blogs.json ]; then
    sudo cp -r /var/www/html/backend/data/* /opt/pixnivo-backend/data/ || true
fi

cd /opt/pixnivo-backend
sudo python3 -m venv venv
sudo ./venv/bin/pip install --upgrade pip
sudo ./venv/bin/pip install -r requirements.txt

sudo ./venv/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)"

sudo bash -c 'cat > /etc/systemd/system/pixnivo-ocr.service <<EOF
[Unit]
Description=Pixnivo AI Backend
After=network.target

[Service]
User=root
WorkingDirectory=/opt/pixnivo-backend
EnvironmentFile=/etc/pixnivo/backend.env
ExecStart=/opt/pixnivo-backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF'

# OCR runs in a child process (ocr_worker.py). Cap the service's memory so a runaway
# job is killed and replaced instead of exhausting the VM, and keep the API running
# when that happens (OOMPolicy=continue).
sudo mkdir -p /etc/systemd/system/pixnivo-ocr.service.d
sudo bash -c 'cat > /etc/systemd/system/pixnivo-ocr.service.d/20-memory.conf <<EOF
[Service]
MemoryHigh=60%
MemoryMax=70%
OOMPolicy=continue
EOF'

sudo systemctl daemon-reload
sudo systemctl enable pixnivo-ocr
sudo systemctl restart pixnivo-ocr

sudo bash -c "cat << 'EOF' > /tmp/add_api.py
with open('/etc/nginx/sites-available/default', 'r') as f:
    config = f.read()
if 'location /api/' not in config:
    config = config.replace('location / {', '''location /api/ {
        proxy_pass http://localhost:8001;
        client_max_body_size 50M;
    }
    
    location / {''')
    with open('/etc/nginx/sites-available/default', 'w') as f:
        f.write(config)
EOF"
sudo python3 /tmp/add_api.py
sudo systemctl restart nginx
