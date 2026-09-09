cd /var/www/html
sudo git pull origin main

sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/

sudo /opt/pixnivo-backend/venv/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(use_textline_orientation=True, lang='en')"

sudo systemctl restart pixnivo-ocr
sudo systemctl restart nginx
