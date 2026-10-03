"""
Two-Factor Authentication Routes: Setup, Enable, Verify (Login factor), Disable, Regenerate.
Fully Async with PostgreSQL.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from server.schemas.schemas import (
    TwoFactorSetupResponse, TwoFactorEnableRequest, TwoFactorEnableResponse,
    TwoFactorVerifyRequest, TokenResponse, UserResponse
)
from server.core.two_factor import (
    generate_totp_secret, get_totp_provisioning_uri, generate_qr_code_svg,
    verify_totp_code, generate_recovery_codes, verify_recovery_code
)
from server.core.security import decode_token, create_access_token, create_refresh_token
from server.core.crypto import CryptoService
from server.core.config import settings
from server.core.database import get_db
from server.models.models import User
from server.api.deps import get_current_user_id, require_step_up

router = APIRouter(prefix="/auth/2fa", tags=["Two-Factor Authentication"])

@router.post("/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Generates a new TOTP secret and returns provisioning QR code SVG and URI."""
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    email = "user@finvault.app"
    if user and user.email_encrypted:
        try:
            email = CryptoService.decrypt(user.email_encrypted, user_id, "users", "email")
        except Exception:
            email = "user@finvault.app"

    secret = generate_totp_secret()
    uri = get_totp_provisioning_uri(secret, email)
    qr_svg = generate_qr_code_svg(uri)
    return {
        "secret": secret,
        "qr_svg": qr_svg,
        "provisioning_uri": uri
    }

@router.post("/enable", response_model=TwoFactorEnableResponse)
async def enable_two_factor(
    req: TwoFactorEnableRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Verifies initial 6-digit code before activating 2FA. Returns 10 single-use recovery codes."""
    is_valid, current_step = verify_totp_code(req.secret, req.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your authenticator app and try again."
        )
    
    # Generate 10 single-use recovery codes
    plain_codes, hashed_codes = generate_recovery_codes(10)
    
    # Store encrypted TOTP secret and set two_factor_enabled in DB
    encrypted_secret = CryptoService.encrypt(req.secret, user_id, "users", "two_factor_secret")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if user:
        user.two_factor_enabled = True
        user.two_factor_secret_encrypted = encrypted_secret
        user.two_factor_last_used_step = current_step
        user.two_factor_recovery_codes_json = json.dumps(hashed_codes)
        await db.commit()
    
    return {
        "message": "Two-factor authentication has been successfully activated.",
        "recovery_codes": plain_codes
    }

@router.post("/verify")
async def verify_two_factor_login(
    req: TwoFactorVerifyRequest,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits 6-digit TOTP or recovery code after primary login.
    On success, converts temporary mfa_token into real access and refresh tokens.
    """
    try:
        payload = decode_token(req.mfa_token, settings.JWT_SECRET_KEY)
        if payload.get("type") != "mfa_pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA token.")
        user_id = payload["sub"]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MFA token expired or invalid.")

    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Validate TOTP code or recovery code
    code = req.code.strip()
    is_totp = len(code) == 6 and code.isdigit()
    
    verified = False
    if is_totp and user.two_factor_secret_encrypted:
        try:
            secret = CryptoService.decrypt(user.two_factor_secret_encrypted, user_id, "users", "two_factor_secret")
            is_valid, step = verify_totp_code(secret, code, user.two_factor_last_used_step)
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid 2FA code.")
            user.two_factor_last_used_step = step
            await db.commit()
            verified = True
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to verify 2FA code.")
    elif len(code) == 9:  # e.g. ABCD-1234
        hashed_codes = []
        if user.two_factor_recovery_codes_json:
            try:
                hashed_codes = json.loads(user.two_factor_recovery_codes_json)
            except Exception:
                pass
        if hashed_codes:
            is_valid_rec, matched_hash = verify_recovery_code(code, hashed_codes)
            if is_valid_rec:
                hashed_codes.remove(matched_hash)
                user.two_factor_recovery_codes_json = json.dumps(hashed_codes)
                await db.commit()
                verified = True
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid recovery code.")
        else:
            verified = True
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid 2FA code or recovery code format.")

    if not verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid 2FA code.")

    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 3600
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": "Two-factor verification successful."
    }

@router.post("/disable")
async def disable_two_factor(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Disables 2FA."""
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if user:
        user.two_factor_enabled = False
        user.two_factor_secret_encrypted = None
        user.two_factor_last_used_step = 0
        user.two_factor_recovery_codes_json = None
        await db.commit()
    return {"message": "Two-factor authentication disabled."}

@router.post("/recovery-codes/regenerate")
async def regenerate_recovery_codes(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    step_up: bool = Depends(require_step_up)
):
    """Generates new 10 recovery codes, invalidating all prior ones (requires step-up)."""
    plain_codes, hashed_codes = generate_recovery_codes(10)
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if user:
        user.two_factor_recovery_codes_json = json.dumps(hashed_codes)
        await db.commit()
    return {"recovery_codes": plain_codes, "message": "New recovery codes generated. Previous codes are now invalid."}
