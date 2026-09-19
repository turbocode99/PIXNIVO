const html = require('fs').readFileSync('barcode-tools.html', 'utf-8');
const js = html.split('<script>')[1].split('</script>')[0];
try {
  new Function(js);
  console.log('Syntax is completely valid!');
} catch(e) {
  console.error(e);
}
