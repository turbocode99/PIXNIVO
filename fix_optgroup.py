with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_css = '''  #bcType option {
    background-color: #1a1a2e;
    color: #ffffff;
  }'''

new_css = '''  #bcType option, #bcType optgroup {
    background-color: #1a1a2e;
    color: #ffffff;
  }
  #bcType optgroup {
    font-weight: 600;
    color: #a0a0b8;
  }'''

content = content.replace(old_css, new_css)

with open('barcode-tools.html', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("CSS updated.")
