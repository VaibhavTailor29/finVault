"""
Security utilities: Password hashing (bcrypt) and JWT tokens.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
import bcrypt
from server.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_mfa_token(user_id: str) -> str:
    """Short-lived, single-purpose token issued upon primary password success."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.MFA_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "type": "mfa_pending", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_step_up_token(user_id: str) -> str:
    """Fresh step-up verification token required for sensitive actions."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.STEP_UP_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": user_id, "type": "step_up", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str, secret_key: str) -> Dict[str, Any]:
    return jwt.decode(token, secret_key, algorithms=[settings.JWT_ALGORITHM])

def create_password_reset_token(user_id: str, email: str) -> str:
    """Password reset token valid for 30 minutes."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    to_encode = {"sub": user_id, "email": email, "type": "password_reset", "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def verify_password_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a password reset JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload
    except Exception:
        return None
