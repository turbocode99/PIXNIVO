import os
import subprocess

def run(cmd):
    return subprocess.check_output(cmd, shell=True).decode('utf-8')

html_files = ['index.html', 'pdf-tools.html', 'image-upscaler.html']

for f in html_files:
    # Get the raw file content from the b4d0e00 commit (pristine UTF-8)
    pristine_content = run(f"git show b4d0e00:{f}")
    
    # Save it back to disk
    with open(f, 'w', encoding='utf-8', newline='\n') as file:
        file.write(pristine_content)

print("Restored pristine files.")
