with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
scripts = [m.start() for m in re.finditer(r'<script>', html)]
print("Script tags at indices:", scripts)
