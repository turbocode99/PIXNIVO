with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'container.style.background' in line:
        print("START AT", i)
        print("".join(lines[i:i+15]))
        break
