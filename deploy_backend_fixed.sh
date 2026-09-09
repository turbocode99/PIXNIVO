sudo git config --global --add safe.directory /var/www/html
cd /var/www/html
sudo git pull origin main

sudo apt-get update
sudo apt-get install -y python3-pip python3-venv poppler-utils libgl1 libglib2.0-0

sudo mkdir -p /opt/pixnivo-backend
sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/
sudo cp /var/www/html/backend/requirements.txt /opt/pixnivo-backend/

cd /opt/pixnivo-backend
sudo python3 -m venv venv
sudo ./venv/bin/pip install --upgrade pip
sudo ./venv/bin/pip install -r requirements.txt

sudo ./venv/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)"

sudo systemctl daemon-reload
sudo systemctl restart pixnivo-ocr
sudo systemctl restart nginx
