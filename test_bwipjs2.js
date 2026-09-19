const https = require('https');

https.get('https://cdnjs.cloudflare.com/ajax/libs/bwip-js/3.4.0/bwip-js-min.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (data.includes('toCanvas')) {
            console.log('toCanvas exists, but maybe under a different object.');
        } else {
            console.log('toCanvas DOES NOT EXIST ANYWHERE.');
        }
    });
});
