with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()
    
# Extract script starting at 13449
script1 = html[13449:13600]
print("Script 1:", script1)

script2 = html[22383:22500]
print("Script 2:", script2)
