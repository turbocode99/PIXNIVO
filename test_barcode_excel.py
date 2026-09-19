import requests
import json

payload = {
    "format": "xlsx",
    "images": [
        {
            "text": "123456789",
            "base64_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        }
    ]
}

response = requests.post('https://pixnivo.app/api/export-barcodes', json=payload)
print(response.status_code)
