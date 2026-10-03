"""
FastAPI Dependencies: Auth token extraction, Current User loading, Step-Up enforcement.
"""
from typing import Optional, Generator
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
from server.core.config import settings
from server.core.security import decode_token
from server.core.crypto import CryptoService
from server.models.models import User

from server.core.database import get_db

security = HTTPBearer(auto_error=False)

def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
    token = credentials.credentials
    try:
        payload = decode_token(token, settings.JWT_SECRET_KEY)
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token."
            )
        return user_id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired."
        )

def require_step_up(
    step_up_token: Optional[str] = Header(None, alias="X-Step-Up-Token"),
    user_id: str = Depends(get_current_user_id)
) -> bool:
    """
    Dependency that enforces step-up verification for high-risk actions
    (e.g., account deletion, disabling 2FA, viewing raw recovery codes, full unmasked export).
    """
    if not step_up_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Step-up authentication required for this sensitive action. Please enter your 2FA code."
        )
    try:
        payload = decode_token(step_up_token, settings.JWT_SECRET_KEY)
        if payload.get("type") != "step_up" or payload.get("sub") != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid step-up authorization.")
        return True
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Step-up token expired or invalid.")

class CurrentUser:
    def __init__(self, user_id: str):
        self.id = user_id

def get_current_user(user_id: str = Depends(get_current_user_id)) -> CurrentUser:
    return CurrentUser(user_id)
