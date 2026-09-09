import requests
import json

files = {'file': ('test.txt', b'this is a test text file which OCR might reject, but lets see')}
data = {'enhance': 'none'}

response = requests.post('https://pixnivo.app/api/ocr', files=files, data=data)
print(response.status_code)
print(response.text)
