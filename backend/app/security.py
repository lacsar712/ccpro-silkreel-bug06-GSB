from datetime import datetime, timedelta, timezone

import jwt
from werkzeug.security import check_password_hash, generate_password_hash

from app.config import JWT_ALG, JWT_SECRET


def hash_password(plain: str) -> str:
    return generate_password_hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return check_password_hash(hashed, plain)


def make_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": username, "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)


def parse_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
