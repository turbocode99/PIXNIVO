with open('index.html', 'rb') as f:
    text = f.read()

import re
dot = re.search(b'<span class="dot">(.*?)</span>', text)
if dot:
    print(f"Footer dot hex: {dot.group(1).hex()}")
