import re

nav_link = '''
        <span class="dot">•</span>
        <a href="/barcode-tools.html">Barcode Tools</a>'''

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex search for AI Upscaler link in footer
    pattern = re.compile(r'(<a href="/image-upscaler">AI Upscaler</a>)', re.DOTALL)
    
    match = pattern.search(content)
    if match:
        content = content[:match.end()] + nav_link + content[match.end():]
        with open(file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Added footer nav to {file}")
