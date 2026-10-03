"""
Tests for Multi-Tenant Isolation and Cryptographic Key Derivation.
"""
import pytest
from server.core.crypto import CryptoService, derive_user_data_key
from server.core.config import settings

def test_tenant_data_key_isolation():
    """Verify distinct users derive distinct 256-bit encryption keys."""
    master_key = b"1" * 32
    key_user_1 = derive_user_data_key(master_key, "user-alice-111")
    key_user_2 = derive_user_data_key(master_key, "user-bob-222")

    assert key_user_1 != key_user_2
    assert len(key_user_1) == 32
    assert len(key_user_2) == 32

def test_user_a_cannot_decrypt_user_b_data():
    ciphertext_alice = CryptoService.encrypt("10000.00", "alice-uuid", "expenses", "amount")
    
    # Bob attempts to decrypt Alice's ciphertext
    with pytest.raises(Exception):
        CryptoService.decrypt(ciphertext_alice, "bob-uuid", "expenses", "amount")
