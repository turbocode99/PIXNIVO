cd /var/www/html
sudo git fetch
sudo git reset --hard origin/main

sudo bash -c 'if ! grep -q "client_max_body_size 50M;" /etc/nginx/nginx.conf; then sed -i "/http {/a \\    client_max_body_size 50M;" /etc/nginx/nginx.conf; fi'
sudo systemctl restart nginx
