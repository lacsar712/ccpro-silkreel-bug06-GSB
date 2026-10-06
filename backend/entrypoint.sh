#!/bin/sh
set -e
python - << 'PY'
import asyncio, os
import asyncpg

async def wait():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "")
    creds, rest = url.split("@", 1)
    user, password = creds.split(":", 1)
    hostport, db = rest.split("/", 1)
    host, port = (hostport.split(":") + ["5432"])[:2]
    for i in range(60):
        try:
            conn = await asyncpg.connect(host=host, port=int(port), user=user, password=password, database=db)
            await conn.close()
            print("PostgreSQL ready")
            return
        except Exception as e:
            print(f"waiting db {i+1}/60 {e}")
            await asyncio.sleep(2)
    raise SystemExit("db unavailable")

asyncio.run(wait())
PY
python - << 'PY'
import asyncio
from app.db import engine, init_db
from app.seed import seed_demo

async def boot():
    await init_db()
    await seed_demo()
    await engine.dispose()

asyncio.run(boot())
print("migrate/seed done")
PY
exec hypercorn app.main:app --bind 0.0.0.0:8760 --workers 1
