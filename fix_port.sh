sudo sed -i 's/port 8000/port 8001/g' /etc/systemd/system/pixnivo-ocr.service
sudo systemctl daemon-reload
sudo systemctl restart pixnivo-ocr

sudo sed -i 's/localhost:8000/localhost:8001/g' /etc/nginx/sites-available/default
sudo systemctl restart nginx
