import re
from collections import Counter

with open('pdf-tools.html', 'r', encoding='utf-8') as f:
    content = f.read()

cards = re.findall(r'class="pdf-tool-card"[^>]*data-tool="([^"]+)"', content)
stages = re.findall(r'id="stage-([^"]+)"', content)
cats = re.findall(r'class="pdf-tool-card"[^>]*data-category="([^"]+)"', content)

print(f"Total Cards found: {len(cards)}")
print(f"Total Stages found: {len(stages)}")
print("Categories counter:", Counter(cats))

missing_stages = set(cards) - set(stages)
extra_stages = set(stages) - set(cards)

print(f"Missing stages for cards: {missing_stages}")
print(f"Extra stages without cards: {extra_stages}")

for idx, (c, s, cat) in enumerate(zip(cards, stages, cats), 1):
    print(f"{idx:02d}. Card: {c:15s} | Stage: {s:15s} | Category: {cat}")
