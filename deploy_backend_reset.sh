cd /var/www/html
sudo git reset --hard HEAD
sudo git pull origin main

sudo mkdir -p /opt/pixnivo-backend
sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/
sudo cp /var/www/html/backend/requirements.txt /opt/pixnivo-backend/

cd /opt/pixnivo-backend
sudo ./venv/bin/pip install -r requirements.txt
sudo ./venv/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)"

sudo systemctl restart pixnivo-ocr
sudo systemctl restart nginx
