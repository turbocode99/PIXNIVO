cd /opt/pixnivo-backend
sudo ./venv/bin/pip install --upgrade pip
sudo ./venv/bin/pip uninstall -y paddlepaddle paddleocr
sudo ./venv/bin/pip install paddlepaddle==2.6.1 paddleocr==2.7.3

sudo systemctl restart pixnivo-ocr
