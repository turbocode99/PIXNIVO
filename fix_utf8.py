import os

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html', 'barcode-tools.html']

for file in files:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the mangled utf-8 characters
        content = content.replace('â€”', '—')
        content = content.replace('â€¢', '•')
        content = content.replace('â€¦', '…')
        
        # Also just in case they are already rendered as '?"'
        content = content.replace('?"', '—')
        content = content.replace('?', '…') # Wait, ? could be bullet OR ellipsis
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
