"""
Field-Level Encryption Module (AES-256-GCM, HKDF-SHA256, AAD, Blind Index, Scrypt Backup)
Supports Phase 0 configurable ENCRYPT_AMOUNTS mode.
"""
import base64
import os
import hmac
import hashlib
from typing import Optional, Tuple
from decimal import Decimal
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives import hashes
from server.core.config import settings

FORMAT_VERSION = "v1"

def derive_user_data_key(master_kek: bytes, user_id: str) -> bytes:
    """
    Derive a 256-bit AES-GCM data key scoped strictly to a user_id via HKDF-SHA256.
    Ensures user A's key cannot decrypt user B's records.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"finvault-user-data-key-salt-v1",
        info=f"user-key:{user_id}".encode("utf-8")
    )
    return hkdf.derive(master_kek)

def derive_household_data_key(master_kek: bytes, household_id: str) -> bytes:
    """
    Derives shared household encryption key via HKDF with household_id context.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"finvault-household-data-key-salt-v1",
        info=f"household-key:{household_id}".encode("utf-8")
    )
    return hkdf.derive(master_kek)

def compute_blind_index(value: str) -> str:
    """Computes deterministic HMAC-SHA256 blind index for exact-match searches."""
    if not value:
        return ""
    normalized = value.strip().lower().encode("utf-8")
    key = settings.BLIND_INDEX_KEY.encode("utf-8")
    return hmac.new(key, normalized, hashlib.sha256).hexdigest()

class CryptoService:
    @classmethod
    def _get_master_key(cls, key_id: str) -> bytes:
        keys = settings.master_keys
        if key_id not in keys:
            raise ValueError(f"Encryption key_id '{key_id}' not found in active master keys.")
        raw = keys[key_id]
        try:
            decoded = base64.b64decode(raw)
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass
        return hashlib.sha256(raw.encode("utf-8")).digest()

    @classmethod
    def encrypt(cls, plaintext: str, user_id: str, table: str, column: str, key_id: Optional[str] = None) -> str:
        if plaintext is None:
            return ""
        
        active_key_id = key_id or settings.CURRENT_KEY_ID
        master_kek = cls._get_master_key(active_key_id)
        user_dek = derive_user_data_key(master_kek, user_id)
        
        aesgcm = AESGCM(user_dek)
        nonce = os.urandom(12)  # 96-bit nonce
        aad = f"{user_id}:{table}:{column}".encode("utf-8")
        
        ciphertext_and_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)
        return f"{FORMAT_VERSION}:{active_key_id}:{base64.b64encode(nonce).decode('ascii')}:{base64.b64encode(ciphertext_and_tag).decode('ascii')}"

    @classmethod
    def decrypt(cls, encrypted_payload: str, user_id: str, table: str, column: str) -> str:
        if not encrypted_payload:
            return ""
            
        parts = encrypted_payload.split(":")
        if len(parts) != 4:
            # Fallback if plaintext stored (in unencrypted mode)
            return encrypted_payload
            
        version, key_id, nonce_b64, cipher_b64 = parts
        master_kek = cls._get_master_key(key_id)
        user_dek = derive_user_data_key(master_kek, user_id)
        
        nonce = base64.b64decode(nonce_b64)
        ciphertext_and_tag = base64.b64decode(cipher_b64)
        aad = f"{user_id}:{table}:{column}".encode("utf-8")
        
        aesgcm = AESGCM(user_dek)
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext_and_tag, aad)
        return decrypted_bytes.decode("utf-8")

    @classmethod
    def encrypt_decimal(cls, amount: Decimal, user_id: str, table: str, column: str) -> str:
        """
        Phase 0: If ENCRYPT_AMOUNTS is True, encrypts as canonical decimal string.
        If False, returns canonical string directly for Numeric column persistence.
        """
        canonical_str = f"{amount:.4f}"
        if not settings.ENCRYPT_AMOUNTS:
            return canonical_str
        return cls.encrypt(canonical_str, user_id, table, column)

    @classmethod
    def decrypt_decimal(cls, payload: str, user_id: str, table: str, column: str) -> Decimal:
        """Decrypts decimal value or parses canonical string."""
        if not payload:
            return Decimal("0.0000")
        if not settings.ENCRYPT_AMOUNTS and not payload.startswith("v1:"):
            return Decimal(payload)
        val = cls.decrypt(payload, user_id, table, column)
        return Decimal(val) if val else Decimal("0.0000")

    @classmethod
    def encrypt_backup_with_passphrase(cls, data_json: str, passphrase: str) -> str:
        salt = os.urandom(16)
        kdf = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1)
        key = kdf.derive(passphrase.encode("utf-8"))
        
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, data_json.encode("utf-8"), b"finvault-backup-export")
        
        envelope = {
            "v": "backup_v2",
            "salt": base64.b64encode(salt).decode("ascii"),
            "nonce": base64.b64encode(nonce).decode("ascii"),
            "data": base64.b64encode(ciphertext).decode("ascii")
        }
        import json
        return json.dumps(envelope)

    @classmethod
    def decrypt_backup_with_passphrase(cls, encrypted_json: str, passphrase: str) -> str:
        import json
        envelope = json.loads(encrypted_json)
        salt = base64.b64decode(envelope["salt"])
        nonce = base64.b64decode(envelope["nonce"])
        ciphertext = base64.b64decode(envelope["data"])
        
        kdf = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1)
        key = kdf.derive(passphrase.encode("utf-8"))
        
        aesgcm = AESGCM(key)
        try:
            data = aesgcm.decrypt(nonce, ciphertext, b"finvault-backup-export")
        except Exception:
            # Fallback for backups created prior to rename
            data = aesgcm.decrypt(nonce, ciphertext, b"kuber-backup-export")
        return data.decode("utf-8")
