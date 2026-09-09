const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

// Create a dummy image
const { execSync } = require('child_process');
execSync('convert -size 200x50 xc:white -fill black -pointsize 20 -draw "text 10,30 \'Hello World OCR\'" test_image.png');

const form = new FormData();
form.append('file', fs.createReadStream('test_image.png'));
form.append('enhance', 'none');

const req = https.request('https://pixnivo.app/api/ocr', {
  method: 'POST',
  headers: form.getHeaders()
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('RESPONSE:', res.statusCode, data));
});

req.on('error', (e) => console.error(e));
form.pipe(req);
