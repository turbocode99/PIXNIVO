with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(410, 430):
    if i < len(lines):
        print(f"{i+1}: {lines[i].strip()}")
