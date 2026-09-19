import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the placeholder attribute completely
html = re.sub(r'\s*placeholder="[^"]+"', '', html)

# Find the empty textarea and insert text into it
html = re.sub(r'(<textarea id="bcData"[^>]*>)(\s*)(</textarea>)', r'\11234567890\nPIXNIVO-PRO\nhttps://pixnivo.app\3', html)

with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
