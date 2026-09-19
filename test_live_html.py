import urllib.request

req = urllib.request.Request('https://pixnivo.app/')
with urllib.request.urlopen(req) as response:
    html = response.read(500)
    print(html)
