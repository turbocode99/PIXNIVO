import urllib.request
import json
req = urllib.request.Request('https://registry.npmjs.org/bwip-js/3.4.0', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print("Found package.")
