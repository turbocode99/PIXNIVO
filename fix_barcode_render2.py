import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

def replace_bwipjs(match):
    canvas_var = match.group(1)
    return f'''            const is2D = ['qrcode', 'datamatrix', 'pdf417', 'azteccode', 'gs1datamatrix'].includes(bcType.value);
            const options = {{
                bcid: bcType.value,
                text: line,
                scale: 5,
                includetext: bcShowText.checked,
                textxalign: 'center',
                backgroundcolor: 'FFFFFF',
                padding: 10
            }};
            if (!is2D) options.height = 15;
            bwipjs.toCanvas({canvas_var}, options);'''

pattern = re.compile(r'bwipjs\.toCanvas\((canvas|offCanvas),\s*\{[^\}]+\}\);')
html = pattern.sub(replace_bwipjs, html)

with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print("Fixed all bwipjs.toCanvas calls.")
