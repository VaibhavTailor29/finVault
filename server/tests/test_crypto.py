"""
Tests for Field-Level Encryption (AES-256-GCM, HKDF, AAD, Blind Index).
"""
import pytest
from decimal import Decimal
from server.core.crypto import CryptoService, compute_blind_index, derive_user_data_key
from server.core.config import settings

def test_round_trip_encryption():
    user_id = "user_abc_123"
    table = "expenses"
    column = "amount"
    plaintext = "4500.50"

    ciphertext = CryptoService.encrypt(plaintext, user_id, table, column)
    assert ciphertext != plaintext
    assert plaintext not in ciphertext

    decrypted = CryptoService.decrypt(ciphertext, user_id, table, column)
    assert decrypted == plaintext

def test_aad_prevents_ciphertext_swapping_between_columns():
    """AAD check: Ciphertext from 'amount' column cannot be decrypted as 'note'."""
    user_id = "user_abc_123"
    ciphertext = CryptoService.encrypt("Secret Note", user_id, "expenses", "note")

    with pytest.raises(Exception):
        CryptoService.decrypt(ciphertext, user_id, "expenses", "amount")

def test_aad_prevents_ciphertext_swapping_between_users():
    """AAD check: Ciphertext from user A cannot be decrypted by user B."""
    user_a = "user_a_111"
    user_b = "user_b_222"
    ciphertext = CryptoService.encrypt("1000.00", user_a, "expenses", "amount")

    with pytest.raises(Exception):
        CryptoService.decrypt(ciphertext, user_b, "expenses", "amount")

def test_tampered_ciphertext_fails_auth_tag():
    """AES-GCM authentication tag check: Modified payload must raise error."""
    user_id = "user_abc_123"
    ciphertext = CryptoService.encrypt("500.00", user_id, "expenses", "amount")
    parts = ciphertext.split(":")
    # Tamper with cipher byte string
    tampered = f"{parts[0]}:{parts[1]}:{parts[2]}:AAAA{parts[3][4:]}"

    with pytest.raises(Exception):
        CryptoService.decrypt(tampered, user_id, "expenses", "amount")

def test_blind_index_deterministic_and_normalized():
    email1 = "Test.User@Example.com"
    email2 = "  test.user@example.com  "
    idx1 = compute_blind_index(email1)
    idx2 = compute_blind_index(email2)
    assert idx1 == idx2
    assert len(idx1) == 64  # SHA256 hex string

def test_decimal_encryption_preserves_precision():
    user_id = "user_abc_123"
    amount = Decimal("123456.7890")
    cipher = CryptoService.encrypt_decimal(amount, user_id, "expenses", "amount")
    decrypted_amt = CryptoService.decrypt_decimal(cipher, user_id, "expenses", "amount")
    assert decrypted_amt == amount
