import os
import sys

sys.path.insert(0, r'C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.db import connection

with connection.cursor() as c:
    c.execute("ALTER TABLE AUDIT_LOG ADD COLUMN origen_permiso VARCHAR(20) NULL AFTER fecha")
    print("Column added successfully")