from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time

options = Options()
options.add_argument('--headless')

driver = webdriver.Edge(options=options)
driver.get("https://pixnivo.app/barcode-tools.html")
time.sleep(3)

print("BROWSER LOGS:")
for log in driver.get_log('browser'):
    print(log)

driver.quit()
