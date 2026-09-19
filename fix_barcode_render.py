import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

# We need to replace the bwipjs.toCanvas block
old_js = '''            bwipjs.toCanvas(canvas, {
                bcid: bcType.value,
                text: line,
                scale: 3,
                height: 15,
                includetext: bcShowText.checked,
                textxalign: 'center',
            });'''

new_js = '''            
            const is2D = ['qrcode', 'datamatrix', 'pdf417', 'azteccode', 'gs1datamatrix'].includes(bcType.value);
            const options = {
                bcid: bcType.value,
                text: line,
                scale: 5, // High quality render
                includetext: bcShowText.checked,
                textxalign: 'center',
                backgroundcolor: 'FFFFFF', // Ensure pure white background for scanners
                padding: 10 // Quiet zone
            };
            
            // Only set height for 1D barcodes
            if (!is2D) {
                options.height = 15;
            }
            
            bwipjs.toCanvas(canvas, options);'''

if old_js in html:
    html = html.replace(old_js, new_js)
    with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print("Fixed bwipjs options for aspect ratio and quality.")
else:
    print("Could not find the old javascript block.")
