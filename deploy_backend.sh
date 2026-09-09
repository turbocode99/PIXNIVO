cd /var/www/html
sudo git pull origin main

sudo apt-get update
sudo apt-get install -y python3-pip python3-venv poppler-utils libgl1-mesa-glx libglib2.0-0

sudo mkdir -p /opt/pixnivo-backend
sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/
sudo cp /var/www/html/backend/requirements.txt /opt/pixnivo-backend/

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
ExecStart=/opt/pixnivo-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable pixnivo-ocr
sudo systemctl restart pixnivo-ocr

sudo bash -c "cat << 'EOF' > /tmp/add_api.py
with open('/etc/nginx/sites-available/default', 'r') as f:
    config = f.read()
if 'location /api/' not in config:
    config = config.replace('location / {', '''location /api/ {
        proxy_pass http://localhost:8000;
        client_max_body_size 50M;
    }
    
    location / {''')
    with open('/etc/nginx/sites-available/default', 'w') as f:
        f.write(config)
EOF"
sudo python3 /tmp/add_api.py
sudo systemctl restart nginx
