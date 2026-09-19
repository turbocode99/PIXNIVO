from bs4 import BeautifulSoup
import re

with open('barcode-tools.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("bcData element exists:", bool(soup.find(id='bcData')))
print("btnGenerate element exists:", bool(soup.find(id='btnGenerate')))
print("previewLimitWarning element exists:", bool(soup.find(id='previewLimitWarning')))

# Let's see the Javascript
js = html.split('<script>')[-1].split('</script>')[0]
with open('temp.js', 'w', encoding='utf-8') as f:
    f.write(js)
