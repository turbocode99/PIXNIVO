import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_css = '''          container.style.background = 'white';
          container.style.padding = '15px';
          container.style.borderRadius = '8px';
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'center';
          container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          
          const canvas = document.createElement('canvas');
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          canvas.id = 'bc_' + i;
          
          const title = document.createElement('div');
          title.style.color = '#333';
          title.style.fontSize = '0.75rem';
          title.style.marginTop = '8px';
          title.style.textAlign = 'center';
          title.style.wordBreak = 'break-all';
          title.style.fontWeight = '600';'''

new_css = '''          container.style.background = 'var(--bg-light)';
          container.style.border = '1px solid var(--border)';
          container.style.padding = '1.5rem';
          container.style.borderRadius = '12px';
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'center';
          container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          
          const canvas = document.createElement('canvas');
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          // Ensure the barcode image has rounded corners to match aesthetics, but keep pure white background inside
          canvas.style.borderRadius = '6px';
          canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          canvas.id = 'bc_' + i;
          
          const title = document.createElement('div');
          title.style.color = 'var(--text)';
          title.style.fontSize = '0.75rem';
          title.style.marginTop = '12px';
          title.style.textAlign = 'center';
          title.style.wordBreak = 'break-all';
          title.style.fontWeight = '600';'''

if old_css in html:
    html = html.replace(old_css, new_css)
    with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print("Fixed container aesthetics.")
else:
    print("Could not find old css to replace.")
