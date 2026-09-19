import sys

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('ðŸ”’', '🔒')
text = text.replace('âš¡', '⚡')
text = text.replace('âˆž', '∞')

with open('barcode-tools.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed barcode-tools.html emojis.")
