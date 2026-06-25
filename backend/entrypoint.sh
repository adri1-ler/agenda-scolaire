#!/bin/sh
set -e

echo "Waiting for database..."
until python -c "
import asyncio, asyncpg
async def check():
    await asyncpg.connect('$DATABASE_URL'.replace('postgresql+asyncpg', 'postgresql'))
asyncio.run(check())
" 2>/dev/null; do
  sleep 1
done

echo "Database ready. Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
