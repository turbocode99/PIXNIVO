cd /opt/pixnivo-backend
sudo ./venv/bin/pip install "numpy<2.0.0"
sudo systemctl reset-failed pixnivo-ocr
sudo systemctl restart pixnivo-ocr
