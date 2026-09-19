from selenium import webdriver
from selenium.webdriver.edge.options import Options
import time
import os

options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=1920,1080')

driver = webdriver.Edge(options=options)
url = 'file:///' + os.path.abspath('barcode-tools.html').replace('\\', '/')
driver.get(url)
time.sleep(2)

print("Before click:", driver.find_element("id", "bcResults").value_of_css_property("display"))

driver.find_element("id", "btnGenerate").click()
time.sleep(2)

print("After click:", driver.find_element("id", "bcResults").value_of_css_property("display"))

for log in driver.get_log('browser'):
    if log['level'] == 'SEVERE':
        print("ERROR:", log)

driver.quit()
