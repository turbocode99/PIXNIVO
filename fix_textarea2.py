import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix the broken textarea
broken_html = '''      J34567890
PIXNIVO-PRO
https://pixnivo.app</textarea>'''

fixed_html = '''      <textarea id="bcData" rows="6" style="width: 100%; padding: 1rem; background: var(--bg-dark); border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: monospace; resize: vertical; margin-bottom: 1.5rem;">1234567890
PIXNIVO-PRO
https://pixnivo.app</textarea>'''

if 'J34567890' in html:
    html = html.replace(broken_html, fixed_html)
    with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print("Fixed corrupted textarea.")
else:
    print("Could not find the corrupted textarea string.")
