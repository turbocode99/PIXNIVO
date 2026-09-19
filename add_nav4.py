import re

nav_link = '''
        <a class="tab-btn" href="/barcode-tools.html">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M16 5v14"></path></svg>
          Barcode Tools
        </a>'''

with open('image-upscaler.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(<a class="tab-btn" href="/image-upscaler">.*?AI Upscaler\s*</a>)', re.DOTALL)
match = pattern.search(content)
if match:
    content = content[:match.end()] + nav_link + content[match.end():]
    with open('image-upscaler.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("Added nav to image-upscaler.html")
