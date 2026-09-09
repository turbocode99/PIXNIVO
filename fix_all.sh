cd /opt/pixnivo-backend
sudo ./venv/bin/pip install --upgrade paddlepaddle paddleocr numpy scipy opencv-python-headless tifffile
sudo systemctl restart pixnivo-ocr
