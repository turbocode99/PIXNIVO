import os

nav_link = '''
          <a class="nav-link" href="/barcode-tools.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M16 5v14"></path></svg>
            Barcode Tools
          </a>'''

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'Barcode Tools' not in content:
        # We find the image-upscaler nav-link and insert after it
        search_str = 'AI Upscaler\n          </a>'
        idx = content.find(search_str)
        if idx != -1:
            idx += len(search_str)
            content = content[:idx] + nav_link + content[idx:]
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Added nav to {file}")
        else:
            print(f"Could not find insert point in {file}")
