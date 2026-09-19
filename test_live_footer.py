import urllib.request
import re

req = urllib.request.Request('https://pixnivo.app/')
with urllib.request.urlopen(req) as response:
    html = response.read()
    
dot = re.search(b'<span class="dot">(.*?)</span>', html)
if dot:
    print(f"Footer dot hex: {dot.group(1).hex()}")
    
copy = re.search(b'<span>(.*?) 2026 PIXNIVO', html)
if copy:
    print(f"Copyright hex: {copy.group(1).hex()}")
