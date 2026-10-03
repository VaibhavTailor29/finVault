"""
Tests for Two-Factor Authentication (pyotp, RFC 6238, replay protection, recovery codes).
"""
import pyotp
import pytest
from server.core.two_factor import (
    generate_totp_secret, verify_totp_code, generate_recovery_codes, verify_recovery_code
)

def test_totp_verification_valid_window():
    secret = generate_totp_secret()
    totp = pyotp.TOTP(secret)
    current_code = totp.now()

    is_valid, step = verify_totp_code(secret, current_code, last_used_step=0)
    assert is_valid is True
    assert step > 0

def test_totp_replay_protection():
    secret = generate_totp_secret()
    totp = pyotp.TOTP(secret)
    code = totp.now()

    # First validation succeeds
    is_valid, step = verify_totp_code(secret, code, last_used_step=0)
    assert is_valid is True

    # Immediate second validation with same time step is rejected (replay attack prevention)
    replayed_valid, _ = verify_totp_code(secret, code, last_used_step=step)
    assert replayed_valid is False

def test_recovery_codes_single_use():
    plain_codes, hashed_codes = generate_recovery_codes(10)
    assert len(plain_codes) == 10
    assert len(hashed_codes) == 10

    code_to_use = plain_codes[0]
    is_valid, matched_hash = verify_recovery_code(code_to_use, hashed_codes)
    assert is_valid is True
    assert matched_hash in hashed_codes

    # Consume code (delete from list)
    remaining_hashes = [h for h in hashed_codes if h != matched_hash]
    assert len(remaining_hashes) == 9

    # Re-using code fails
    retry_valid, _ = verify_recovery_code(code_to_use, remaining_hashes)
    assert retry_valid is False
