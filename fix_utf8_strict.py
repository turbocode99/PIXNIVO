import os

files = ['index.html', 'pdf-tools.html', 'image-upscaler.html', 'barcode-tools.html']

for f in files:
    if os.path.exists(f):
        with open(f, 'rb') as file:
            content = file.read()
            
        # The exact UTF-8 bytes for the corrupted strings
        # â€” is \xc3\xa2\xe2\x82\xac\xe2\x80\x9d
        # We will just do text mode with utf-8, but strictly
        text = content.decode('utf-8')
        text = text.replace('â€”—', '—') # Fix my typo if it exists
        text = text.replace('â€”', '—')
        text = text.replace('â€¢', '•')
        text = text.replace('â€¦', '…')
        text = text.replace('â€œ', '“')
        text = text.replace('â€', '”')
        
        with open(f, 'wb') as file:
            file.write(text.encode('utf-8'))
