cd /var/www/html
sudo git reset --hard HEAD
sudo git pull

find . -name "*.html" -exec sed -i 's/â€”/—/g' {} +
find . -name "*.html" -exec sed -i 's/â€¢/•/g' {} +
find . -name "*.html" -exec sed -i 's/â€¦/…/g' {} +
find . -name "*.html" -exec sed -i 's/â€œ/“/g' {} +
find . -name "*.html" -exec sed -i 's/â€/”/g' {} +

sudo git commit -am "Fix utf-8 encoding corruption natively"
sudo git push
