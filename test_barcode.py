import requests
import json
import base64

payload = {
    "format": "pdf",
    "images": [
        {
            "text": "123456789",
            "base64_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        }
    ]
}

response = requests.post('https://pixnivo.app/api/export-barcodes', json=payload)
print(response.status_code)
if response.status_code == 200:
    print("PDF export successful!")
else:
    print(response.text)
