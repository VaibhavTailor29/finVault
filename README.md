# FinVault - Personal Finance & Expense Tracker

A production-grade, multi-tenant personal finance and portfolio management system featuring **Confidential-Only Selective Encryption (AES-256-GCM + HKDF + Argon2id)**, **RFC 6238 TOTP Two-Factor Authentication with Argon2id Recovery Codes**, bank accounts & wallets, credit card billing and EMI management, people debt ledger, investment tracking with FIFO cost-basis accounting, and privacy mode.

---

## 1. Architecture Overview

### Selective Encryption at Rest (Confidential-Only Model)
By default, **only confidential and strictly necessary data** is encrypted to balance bulletproof data security with lightning-fast database performance:
- **Confidential & Sensitive Items (Encrypted at Rest with AES-256-GCM / Argon2id)**:
  - **Two-Factor Secrets**: TOTP seeds (`two_factor_secret_encrypted`) encrypted with AES-256-GCM.
  - **Passwords & Recovery Codes**: One-way Argon2id hashes with per-code salt.
  - **Confidential Memos & Notes**: Private personal notes (`notes_encrypted`).
  - **Backup Archives**: Complete database exports encrypted via Scrypt key derivation + AES-256-GCM envelope.
- **Extra Encryption Removed (Performance & Native SQL Operations)**:
  - **Amounts & Balances**: Transaction amounts, category budgets, bank balances, credit limits, investment prices, and EMI installments are stored as high-precision `Numeric` types (`ENCRYPT_AMOUNTS=false`). This eliminates decryption bottlenecks and enables native SQL aggregations (`SUM`, `AVG`, `GROUP BY`) and indexing.
  - **Card Last 4 Digits & Identifiers**: Stored directly as masked 4-character strings without unnecessary encryption overhead.
  - **User Lookups**: Clean, fast lookups with standard indexing.

### Two-Factor Authentication (Section 1A)
- **TOTP (RFC 6238)**: Works with Aegis, Google Authenticator, Authy, FreeOTP.
- **State Machine**: Primary password verification returns single-purpose `mfa_token`. Real access and refresh tokens are ONLY issued after TOTP code or recovery code verification passes.
- **Replay Protection**: Rejects previously used time steps (`last_used_step`).
- **Recovery Codes**: 10 single-use codes stored strictly as Argon2id hashes.
- **Step-Up Verification**: High-risk operations (revealing recovery codes, deleting account, disabling 2FA, unmasked data export) require a fresh 2FA code.

---

## 2. Key Generation & Rotation

### Generate Cryptographic Keys
```bash
python -m server.scripts.generate_keys
```

### Key Rotation & Encryption Mode Migration
To re-encrypt existing records from key version `v1` to `v2`:
```bash
python -m server.scripts.rotate_keys --from-key v1 --to-key v2
```

To migrate between ciphertext and plaintext storage (`ENCRYPT_AMOUNTS` true/false):
```bash
python -m server.scripts.migrate_encryption_mode --mode encrypted --batch-size 500
# or preview with dry-run:
python -m server.scripts.migrate_encryption_mode --mode plaintext --dry-run
```

#### Performance vs. Security Trade-Off:
- **`ENCRYPT_AMOUNTS=true` (Maximum Security)**: Financial values are protected by AES-256-GCM at rest. Aggregations (P&L, category totals, net worth) run decrypt-then-aggregate in Python Decimal memory. Best for zero-trust DB environments.
- **`ENCRYPT_AMOUNTS=false` (Maximum Query Performance)**: Sensitive PII (emails, names, phone numbers, notes, card last4, 2FA secrets) remain strictly encrypted. Amounts and quantities are stored as Numeric types, allowing native PostgreSQL aggregations (`SUM`, `GROUP BY`, window functions) across hundreds of thousands of transactions.

---

## 3. Quickstart with Docker Compose

```bash
# 1. Clone repository and set environment variables
cp .env.example .env

# 2. Run with Docker Compose
docker compose up -d --build

# 3. Access API docs
open http://localhost:8000/docs
```

---

## 4. Design Decisions & Threat Model

| Decision | Implementation | Rationale |
|---|---|---|
| **Transfers Excluded from Spending** | Card payments, loan settlements, and investment funding are flagged as transfers. | Prevents double-counting: paying off a ₹10,000 credit card bill is a balance transfer, not an additional ₹10,000 expense. |
| **Net Worth Formula** | `Cash + Investments + Lent (Receivables) - Card Dues - Borrowed (Payables)` | Accurate true net worth reflecting assets and liabilities. |
| **Encrypted Decimal Strings** | Encrypted as `f"{amount:.4f}"` | Avoids IEEE 754 binary floating-point rounding errors on currency values. |
| **Plaintext Columns** | `id`, `user_id`, `date`, `category_id`, `is_deleted` | Necessary for relational integrity, indexes, B-tree date range queries, and joins. |

### Threat Model
- **Protects Against**: Database dumps leaked or stolen at rest, rogue DB administrators, cross-tenant data sniffing, replay attacks on 2FA codes.
- **Does NOT Protect Against**: A fully compromised application server memory holding active master keys, or client-side compromise (keyloggers).

---

## 5. Requirements Mapping Checklist

| Requirement | Implementation Files |
|---|---|
| **Field-Level Encryption (AES-GCM, HKDF, AAD, Blind Index)** | `server/core/crypto.py`, `src/utils/crypto.ts`, `server/tests/test_crypto.py` |
| **Configurable Encryption Mode (`ENCRYPT_AMOUNTS`) & Migration Script** | `server/core/config.py`, `server/scripts/migrate_encryption_mode.py` |
| **TOTP 2FA, Argon2id Recovery Codes, Step-Up Verification** | `server/core/two_factor.py`, `server/api/routes/two_factor.py`, `src/utils/totp.ts`, `src/components/security/TwoFactorSetupModal.tsx`, `src/components/security/StepUpModal.tsx` |
| **Bank Accounts & Wallets, Double-Entry Transfers & Reconciliation** | `server/api/routes/accounts.py`, `src/pages/AccountsPage.tsx`, `src/store/useFinanceStore.ts` |
| **Credit Card Management, Utilization Warnings (>30%, >70%) & EMI Tracker** | `server/services/card_service.py`, `server/api/routes/cards.py`, `src/pages/CreditCardsPage.tsx` |
| **People Ledger (Lend, Borrow, Settle Up, Shared Spent-On-People)** | `server/services/ledger_service.py`, `server/api/routes/people.py`, `src/pages/PeopleLedgerPage.tsx` |
| **Investments, FIFO Realized P&L, Splits, Dividends & Asset Allocation** | `server/services/investment_service.py`, `server/api/routes/investments.py`, `src/pages/InvestmentsPage.tsx` |
| **Monthly Reports (Decimal math, PDF with auto-table, Excel, CSV export)** | `server/services/report_service.py`, `server/api/routes/reports.py`, `src/pages/ReportsPage.tsx`, `src/utils/exports.ts` |
| **CSV & Statement Import with Header Auto-Detection & Batch Undo** | `src/pages/ImportPage.tsx` |
| **Background Scheduler (APScheduler: Recurring, Due Reminders, Purge)** | `server/jobs/scheduler.py` |
| **Privacy Mode & Multi-Currency Switcher (USD, EUR, GBP, INR, JPY, CAD, AUD)** | `src/store/useSettingsStore.ts`, `src/utils/formatters.ts`, `src/components/layout/Header.tsx` |
| **Multi-Tenant Isolation & Test Suite** | `server/tests/test_tenant_isolation.py`, `server/tests/test_crypto.py`, `server/tests/test_two_factor.py`, `server/tests/test_reports.py` |
| **Docker & Docker-Compose (FastAPI, Postgres, Vite)** | `Dockerfile`, `docker-compose.yml`, `server/requirements.txt` |
