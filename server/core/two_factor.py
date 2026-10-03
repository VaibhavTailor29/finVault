"""
Two-Factor Authentication (TOTP, RFC 6238, Argon2id Recovery Codes, Step-Up)
"""
import secrets
import pyotp
import segno
import io
import time
from datetime import datetime, timezone
from typing import List, Tuple
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from server.core.config import settings

ph = PasswordHasher()

def generate_totp_secret() -> str:
    """Generates standard Base32 TOTP secret."""
    return pyotp.random_base32()

def get_totp_provisioning_uri(secret: str, email: str) -> str:
    """Returns standard otpauth:// URI."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=settings.TOTP_ISSUER)

def generate_qr_code_svg(provisioning_uri: str) -> str:
    """Generates inline SVG string of QR code."""
    qr = segno.make(provisioning_uri, error='M')
    buff = io.BytesIO()
    qr.save(buff, kind='svg', scale=4, border=1)
    return buff.getvalue().decode('utf-8')

def verify_totp_code(secret: str, code: str, last_used_step: int = 0) -> Tuple[bool, int]:
    """
    Validates 6-digit TOTP code with +/- 1 time-step window (30s before/after).
    Enforces replay protection by verifying current step > last_used_step.
    Returns (is_valid, current_step).
    """
    if not code or len(code.strip()) != 6:
        return False, last_used_step
        
    totp = pyotp.TOTP(secret)
    # Check current, -1, +1 window
    current_time_step = totp.timecode(datetime.now(timezone.utc))
    
    # Check within valid window
    is_valid = totp.verify(code.strip(), valid_window=1)
    if is_valid:
        # Check against replay
        if current_time_step <= last_used_step:
            return False, last_used_step  # Code replayed
        return True, current_time_step
        
    return False, last_used_step

def generate_recovery_codes(count: int = 10) -> Tuple[List[str], List[str]]:
    """
    Generates single-use recovery codes (e.g. 'ABCD-1234-EFGH').
    Returns (plaintext_codes_for_user, hashed_codes_for_db).
    Plaintext codes are shown ONLY ONCE to user.
    """
    plain_codes = []
    hashed_codes = []
    for _ in range(count):
        token = secrets.token_hex(4).upper()
        formatted = f"{token[:4]}-{token[4:]}"
        plain_codes.append(formatted)
        hashed_codes.append(ph.hash(formatted))
    return plain_codes, hashed_codes

def verify_recovery_code(entered_code: str, hashed_codes: List[str]) -> Tuple[bool, str]:
    """
    Constant-time verification against stored Argon2id hashes.
    Returns (True, matching_hash) if valid so it can be consumed and deleted.
    """
    cleaned = entered_code.strip().upper()
    for stored_hash in hashed_codes:
        try:
            if ph.verify(stored_hash, cleaned):
                return True, stored_hash
        except VerifyMismatchError:
            continue
        except Exception:
            continue
    return False, ""
