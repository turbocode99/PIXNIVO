with open('index.html', 'rb') as f:
    text = f.read()

import re
pills = re.findall(b'<div class="f-icon">(.*?)</div>', text)
print(pills)
