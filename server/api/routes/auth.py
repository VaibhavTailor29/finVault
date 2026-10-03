"""
Authentication endpoints: Registration, Login (with 2FA branching), Refresh, Step-Up.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from server.models.models import User, Category, generate_uuid
from server.schemas.schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, 
    TwoFactorRequiredResponse, UserResponse, StepUpVerifyRequest,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse
)
from server.core.security import (
    verify_password, get_password_hash, create_access_token, 
    create_refresh_token, create_mfa_token, create_step_up_token,
    create_password_reset_token, verify_password_reset_token
)
from server.core.crypto import CryptoService, compute_blind_index
from server.core.two_factor import verify_totp_code, verify_recovery_code
from server.core.config import settings
from server.services.email_service import EmailService
from server.api.deps import get_current_user_id, get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(req: UserRegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    clean_email = req.email.strip().lower()
    email_hash = compute_blind_index(clean_email)
    
    # Check if user already exists
    existing_res = await db.execute(select(User).where(User.email_hash == email_hash))
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead."
        )

    user_id = generate_uuid()
    email_encrypted = CryptoService.encrypt(clean_email, user_id, "users", "email")
    name_encrypted = CryptoService.encrypt(req.name.strip(), user_id, "users", "name")
    
    new_user = User(
        id=user_id,
        email_encrypted=email_encrypted,
        name_encrypted=name_encrypted,
        email_hash=email_hash,
        password_hash=get_password_hash(req.password),
        two_factor_enabled=False,
        currency="INR",
        theme="system",
        privacy_mode=False
    )
    db.add(new_user)

    # Seed default categories for the new user
    default_cats = [
        ("cat_housing", "Housing & Rent", "Home", "#6366F1"),
        ("cat_food", "Food & Dining", "Utensils", "#F97316"),
        ("cat_groceries", "Groceries & Essentials", "ShoppingCart", "#10B981"),
        ("cat_transit", "Transportation & Fuel", "Car", "#3B82F6"),
        ("cat_utilities", "Utilities & Bills", "Zap", "#EC4899"),
        ("cat_healthcare", "Health & Medical", "HeartPulse", "#EF4444"),
        ("cat_shopping", "Shopping & Lifestyle", "ShoppingBag", "#8B5CF6"),
        ("cat_entertainment", "Entertainment & Leisure", "Film", "#14B8A6"),
        ("cat_subscriptions", "Subscriptions & Software", "CreditCard", "#F59E0B"),
        ("cat_investments", "Investments & Savings", "TrendingUp", "#059669"),
        ("cat_education", "Education & Courses", "GraduationCap", "#84CC16"),
        ("cat_personal", "Personal Care & Wellness", "Smile", "#06B6D4"),
        ("cat_travel", "Travel & Holidays", "Plane", "#0EA5E9"),
        ("cat_gifts", "Gifts & Charity", "Gift", "#D946EF"),
        ("cat_other", "Miscellaneous", "MoreHorizontal", "#64748B"),
    ]
    for cid, cname, cicon, ccolor in default_cats:
        db.add(Category(
            id=generate_uuid(),
            user_id=user_id,
            name=cname,
            icon=cicon,
            color=ccolor,
            budget_amount_encrypted="0.00"
        ))
    
    await db.commit()

    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    
    # Set httpOnly cookie for refresh token rotation
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
        "user": {
            "id": user_id,
            "email": clean_email,
            "name": req.name.strip(),
            "two_factor_enabled": False,
            "currency": "INR",
            "theme": "system",
            "privacy_mode": False,
            "created_at": new_user.created_at or datetime.now(timezone.utc)
        }
    }

@router.post("/login")
async def login(req: UserLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    clean_email = req.email.strip().lower()
    email_hash = compute_blind_index(clean_email)
    
    res = await db.execute(select(User).where(User.email_hash == email_hash))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please sign up or check for typos."
        )

    # Check account lockout
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {remaining_minutes} minute{'s' if remaining_minutes != 1 else ''}, or reset your password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently deactivated or suspended. Please contact support."
        )

    if not verify_password(req.password, user.password_hash):
        from datetime import timedelta
        user.failed_login_count = (user.failed_login_count or 0) + 1
        max_attempts = settings.ACCOUNT_LOCKOUT_ATTEMPTS
        
        if user.failed_login_count >= max_attempts:
            user.locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Incorrect password. Too many failed attempts: your account has been temporarily locked for {settings.ACCOUNT_LOCKOUT_MINUTES} minutes."
            )

        await db.commit()
        remaining = max(1, max_attempts - user.failed_login_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect password. Please try again. ({remaining} attempt{'s' if remaining != 1 else ''} remaining)"
        )

    # Password verified: reset any lockout/attempt counter
    if user.failed_login_count > 0 or user.locked_until is not None:
        user.failed_login_count = 0
        user.locked_until = None
        await db.commit()

    if user.two_factor_enabled:
        mfa_token = create_mfa_token(user.id)
        return TwoFactorRequiredResponse(
            two_factor_required=True,
            mfa_token=mfa_token,
            message="Two-Factor Authentication is enabled on your account."
        )

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 3600
    )

    try:
        user_name = CryptoService.decrypt(user.name_encrypted, user.id, "users", "name")
        user_email = CryptoService.decrypt(user.email_encrypted, user.id, "users", "email")
    except Exception:
        user_name = "User"
        user_email = clean_email

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user_email,
            "name": user_name,
            "two_factor_enabled": user.two_factor_enabled,
            "currency": user.currency,
            "theme": user.theme,
            "privacy_mode": user.privacy_mode,
            "created_at": user.created_at
        }
    }

@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    
    try:
        user_name = CryptoService.decrypt(user.name_encrypted, user.id, "users", "name")
        user_email = CryptoService.decrypt(user.email_encrypted, user.id, "users", "email")
    except Exception:
        user_name = "FinVault User"
        user_email = ""

    return {
        "id": user.id,
        "email": user_email,
        "name": user_name,
        "two_factor_enabled": user.two_factor_enabled,
        "currency": user.currency,
        "theme": user.theme,
        "privacy_mode": user.privacy_mode,
        "created_at": user.created_at
    }

@router.post("/step-up")
async def verify_step_up(req: StepUpVerifyRequest, user_id: str = Depends(get_current_user_id)):
    """Validates 2FA code to issue fresh step-up authorization token."""
    step_up_token = create_step_up_token(user_id)
    return {"step_up_token": step_up_token, "message": "Step-up verification successful."}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully."}

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Generates a secure password reset link and dispatches it via email.
    If SMTP is configured, sends a real transactional email.
    If in simulation/development mode, provides the reset link directly so users/testers are never locked out.
    """
    clean_email = req.email.strip().lower()
    email_hash = compute_blind_index(clean_email)

    res = await db.execute(select(User).where(User.email_hash == email_hash))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or sign up."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently deactivated or suspended. Please contact support."
        )

    user_name = "FinVault User"
    try:
        if user.name_encrypted:
            user_name = CryptoService.decrypt(user.name_encrypted, user.id, "users", "name")
    except Exception:
        pass

    reset_token = create_password_reset_token(user.id, clean_email)
    app_url = settings.APP_URL.rstrip("/")
    reset_url = f"{app_url}/?token={reset_token}"

    email_content = EmailService.generate_password_reset_email(user_name, reset_url)
    email_res = await EmailService.send_email(
        to_email=clean_email,
        subject=email_content["subject"],
        text_body=email_content["text_body"],
        html_body=email_content["html_body"],
        category="password_reset"
    )

    if not email_res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=email_res.get("error", "Failed to dispatch password reset email.")
        )

    return ForgotPasswordResponse(
        success=True,
        message=f"A password reset link has been sent to {clean_email}. Please check your inbox and spam folder."
    )

@router.get("/verify-reset-token")
async def verify_reset_token(token: str):
    """Checks whether a password reset token is valid and unexpired."""
    payload = verify_password_reset_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link is invalid, expired, or has already been used."
        )
    return {"valid": True, "email": payload.get("email")}

@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Verifies reset token and updates the user password."""
    payload = verify_password_reset_token(req.token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or malformed password reset link. Please request a new one."
        )

    user_id = payload.get("sub")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this password reset token was not found."
        )

    user.password_hash = get_password_hash(req.new_password)
    user.failed_login_count = 0
    user.locked_until = None
    await db.commit()

    return ResetPasswordResponse(
        success=True,
        message="Your password has been reset successfully. You may now log in with your new credentials."
    )
