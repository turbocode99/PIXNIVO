with open('index.html', 'rb') as f:
    text = f.read()

import re
title = re.search(b'<title>PIXNIVO(.*?)</title>', text)
if title:
    print(f"Title separator hex: {title.group(1).hex()}")

dot = re.search(b'<span class="dot">(.*?)</span>', text)
if dot:
    print(f"Footer dot hex: {dot.group(1).hex()}")

copy = re.search(b'<span>(.*?) 2026 PIXNIVO', text)
if copy:
    print(f"Copyright hex: {copy.group(1).hex()}")
