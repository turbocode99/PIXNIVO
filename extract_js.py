with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
for i, s in enumerate(scripts):
    with open(f'test_script_{i}.js', 'w', encoding='utf-8') as f:
        f.write(s)
