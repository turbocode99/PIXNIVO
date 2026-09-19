cd /var/www/html
sudo git fetch
sudo git reset --hard origin/main

cd /opt/pixnivo-backend
sudo cp /var/www/html/backend/main.py /opt/pixnivo-backend/main.py
sudo cp /var/www/html/backend/requirements.txt /opt/pixnivo-backend/requirements.txt

# Install the new dependencies
sudo ./venv/bin/pip install python-docx openpyxl reportlab

sudo systemctl restart pixnivo-ocr
