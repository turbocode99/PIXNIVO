import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for file in html_files:
    with open(file, 'rb') as f:
        content = f.read()
        
    # We will decode using 'utf-8' with 'replace' so we don't crash on bad bytes
    text = content.decode('utf-8', errors='replace')
    
    # The footer dot is inside <span class="dot">...</span>
    text = re.sub(r'<span class="dot">.*?</span>', r'<span class="dot">&bull;</span>', text)
    
    # The copyright is <span>... 2026 PIXNIVO
    text = re.sub(r'<span>.*? 2026 PIXNIVO', r'<span>&copy; 2026 PIXNIVO', text)
    
    # The title separator is PIXNIVO ... Smart Image Tool
    text = re.sub(r'<title>PIXNIVO .*? Smart Image Tool', r'<title>PIXNIVO &mdash; Smart Image Tool', text)
    
    # The og:title separator
    text = re.sub(r'content="PIXNIVO .*? Smart Image Tool', r'content="PIXNIVO &mdash; Smart Image Tool', text)
    
    # Any other weird occurrences of â€” or similar?
    text = text.replace('â€”', '&mdash;')
    text = text.replace('â€¢', '&bull;')
    text = text.replace('Â©', '&copy;')
    
    with open(file, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
        
print("Replaced all special characters with safe HTML entities!")
