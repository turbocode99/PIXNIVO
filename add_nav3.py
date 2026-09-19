import re

nav_link = '''
          <a class="nav-link" href="/barcode-tools.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M16 5v14"></path></svg>
            Barcode Tools
          </a>'''

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex search for AI Upscaler link closing tag
    pattern = re.compile(r'(<a class="nav-link" href="/image-upscaler">.*?AI Upscaler\s*</a>)', re.DOTALL)
    
    match = pattern.search(content)
    if match:
        content = content[:match.end()] + nav_link + content[match.end():]
        with open(file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Added nav to {file}")
    else:
        print(f"FAILED {file}")
