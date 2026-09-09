sudo sed -i 's/, enable_mkldnn=False, use_mkldnn=False//g' /opt/pixnivo-backend/main.py
sudo systemctl restart pixnivo-ocr
