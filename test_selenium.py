from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time
import os

options = Options()
options.add_argument('--headless')

driver = webdriver.Edge(options=options)
file_path = f"file:///{os.path.abspath('barcode-tools.html').replace('\\', '/')}"
driver.get(file_path)
time.sleep(2)

driver.find_element("id", "btnGenerate").click()
time.sleep(2)

# Check if bcResults is visible
style = driver.find_element("id", "bcResults").get_attribute("style")
print(f"Results style: {style}")

# Check console logs
for log in driver.get_log('browser'):
    print(log)

driver.quit()
