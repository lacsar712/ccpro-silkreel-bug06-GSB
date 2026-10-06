import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://silkreel:silkreel@127.0.0.1:6160/silkreel",
)
JWT_SECRET = os.environ.get("JWT_SECRET", "silkreel-dev-secret")
JWT_ALG = "HS256"
