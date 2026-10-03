"""
Generate cryptographically secure keys for FinVault Personal Finance.
Run: python -m server.scripts.generate_keys
"""
import os
import base64
import secrets

def main():
    kek = os.urandom(32)
    kek_b64 = base64.b64encode(kek).decode("ascii")
    blind_index_key = secrets.token_hex(32)
    jwt_secret = secrets.token_urlsafe(48)
    jwt_refresh = secrets.token_urlsafe(48)

    print("=================================================================")
    print(" FINVAULT FINANCE - CRYPTOGRAPHIC KEY GENERATOR")
    print("=================================================================\n")
    print(f'MASTER_ENCRYPTION_KEYS_JSON={{"v1": "{kek_b64}"}}')
    print(f"CURRENT_KEY_ID=v1")
    print(f"BLIND_INDEX_KEY={blind_index_key}")
    print(f"JWT_SECRET_KEY={jwt_secret}")
    print(f"JWT_REFRESH_SECRET_KEY={jwt_refresh}\n")
    print("Store these in your .env file or production secret manager.")

if __name__ == "__main__":
    main()
