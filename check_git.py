import os
import subprocess

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

# Find the commit before we started adding Barcode Tools
run('git log --oneline -n 10 > git_log.txt')
