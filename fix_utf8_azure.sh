cd /var/www/html

# Replace â€” with em-dash (—)
find . -name "*.html" -exec sed -i 's/â€”—/g' {} +
# Replace â€¢ with bullet (•)
find . -name "*.html" -exec sed -i 's/â€¢/•/g' {} +
# Replace â€¦ with ellipsis (…)
find . -name "*.html" -exec sed -i 's/â€¦/…/g' {} +

# Add and push
sudo git config --global user.email "ai@antigravity.com"
sudo git config --global user.name "Antigravity AI"
sudo git commit -am "Fix utf-8 encoding corruption across all HTML files"
sudo git push
