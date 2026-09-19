const fs = require('fs');

const files = ['index.html', 'pdf-tools.html', 'image-upscaler.html', 'barcode-tools.html'];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf-8');
        
        // Windows powershell mangled utf-8 characters:
        // '—' (em-dash) -> 'â€”'
        // '•' (bullet) -> 'â€¢'
        // '…' (ellipsis) -> 'â€¦'
        
        content = content.replace(/â€”/g, '—');
        content = content.replace(/â€¢/g, '•');
        content = content.replace(/â€¦/g, '…');
        content = content.replace(/â€œ/g, '“');
        content = content.replace(/â€/g, '”');
        
        fs.writeFileSync(file, content, 'utf-8');
    }
}
