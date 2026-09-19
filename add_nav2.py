import os

nav_link = '''
          <a class="nav-link" href="/barcode-tools.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M16 5v14"></path></svg>
            Barcode Tools
          </a>'''

# The exact string to search for in the pristine files
search_str = '''          <a class="nav-link" href="/image-upscaler">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            AI Upscaler
          </a>'''

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    idx = content.find(search_str)
    if idx != -1:
        idx += len(search_str)
        content = content[:idx] + nav_link + content[idx:]
        with open(file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f"Added nav to {file}")
    else:
        print(f"FAILED to find nav in {file}")
