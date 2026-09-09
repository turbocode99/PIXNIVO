cd /var/www/html
sudo git pull origin main
sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/

cd /opt/pixnivo-backend
sudo ./venv/bin/pip install paddleocr==2.7.3

sudo systemctl restart pixnivo-ocr
