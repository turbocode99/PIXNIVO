import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Find title string
title = re.search(r'<title>PIXNIVO(.*?)</title>', text)
if title:
    print(f"Title separator: {repr(title.group(1))}")

# Find footer dots
dot = re.search(r'<span class="dot">(.*?)</span>', text)
if dot:
    print(f"Footer dot: {repr(dot.group(1))}")

# Find copyright
copy = re.search(r'<span>(.*?) 2026 PIXNIVO', text)
if copy:
    print(f"Copyright: {repr(copy.group(1))}")
