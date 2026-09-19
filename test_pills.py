import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the feature pills
import re
pills = re.findall(r'<div class="f-icon">(.*?)</div>', text)
print(pills)
