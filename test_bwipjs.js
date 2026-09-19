const http = require('http');
const https = require('https');

https.get('https://cdnjs.cloudflare.com/ajax/libs/bwip-js/3.4.0/bwip-js-min.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (data.includes('bwipjs.toCanvas')) {
            console.log('bwipjs.toCanvas exists in the script!');
        } else {
            console.log('bwipjs.toCanvas DOES NOT EXIST!');
        }
    });
});
