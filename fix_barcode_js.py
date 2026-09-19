with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix the syntax error
html = html.replace('a.download = PIXNIVO_Barcodes. + ext;', "a.download = 'PIXNIVO_Barcodes.' + ext;")

# Remove the old compressor/bg-remover/eraser JS
import re
# Find the start of the compressor tab
start_str = '/* ==================== TAB 1: COMPRESSOR ==================== */'
start_idx = html.find(start_str)

if start_idx != -1:
    # Find the end of the script block containing it
    end_idx = html.find('</script>', start_idx)
    if end_idx != -1:
        # Remove everything between start_idx and end_idx
        html = html[:start_idx] + html[end_idx:]

with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print("Fixed syntax error and cleaned up old JS.")
