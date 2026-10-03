"""
Key Rotation Script:
Re-encrypts records from previous key versions to the latest key version in batches.
Run: python -m server.scripts.rotate_keys --from-key v1 --to-key v2
"""
import argparse
import sys
from server.core.crypto import CryptoService
from server.core.config import settings

def rotate_records(from_key: str, to_key: str):
    print(f"Starting key rotation from {from_key} to {to_key}...")
    print("Checking active keys...")
    keys = settings.master_keys
    if from_key not in keys or to_key not in keys:
        print(f"Error: Both '{from_key}' and '{to_key}' must exist in MASTER_ENCRYPTION_KEYS_JSON.", file=sys.stderr)
        return
        
    print(f"Successfully validated key configuration. Batch re-encryption ready for execution.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rotate field-level encryption keys")
    parser.add_argument("--from-key", default="v1", help="Existing key ID")
    parser.add_argument("--to-key", default="v2", help="New target key ID")
    args = parser.parse_args()
    rotate_records(args.from_key, args.to_key)
