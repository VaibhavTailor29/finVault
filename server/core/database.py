"""
Database connection, AsyncSession factory, and startup schema initialization.
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from server.core.config import settings
from server.models.models import Base

# Async Engine for PostgreSQL
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for injecting async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    """Create database tables if they do not already exist and seed default user/categories."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS network VARCHAR(30) DEFAULT 'visa';"))
            await conn.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_recovery_codes_json TEXT;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username_hash VARCHAR(64);"))
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username_hash ON users (username_hash);"))
        except Exception:
            pass

    # Ensure default user exists
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from server.models.models import User, Category

        from server.core.security import get_password_hash
        from server.core.crypto import CryptoService, compute_blind_index

        res = await session.execute(select(User).where(User.id == "usr_demo_101"))
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                id="usr_demo_101",
                email_encrypted=CryptoService.encrypt("demo@finvault.local", "usr_demo_101", "users", "email"),
                name_encrypted=CryptoService.encrypt("Demo User", "usr_demo_101", "users", "name"),
                email_hash=compute_blind_index("demo@finvault.local"),
                username_hash=compute_blind_index("demo user"),
                password_hash=get_password_hash("Password123!"),
                currency="INR"
            )
            session.add(user)
            await session.commit()
        elif user.password_hash.startswith("$argon2id"):
            user.password_hash = get_password_hash("Password123!")
            user.email_encrypted = CryptoService.encrypt("demo@finvault.local", "usr_demo_101", "users", "email")
            user.name_encrypted = CryptoService.encrypt("Demo User", "usr_demo_101", "users", "name")
            user.email_hash = compute_blind_index("demo@finvault.local")
            user.username_hash = compute_blind_index("demo user")
            await session.commit()

        # Ensure all existing users have username_hash populated
        unhashed = await session.execute(select(User).where(User.username_hash.is_(None)))
        for u in unhashed.scalars().all():
            try:
                name = CryptoService.decrypt(u.name_encrypted, u.id, "users", "name")
                u.username_hash = compute_blind_index(name.strip().lower())
            except Exception:
                pass
        await session.commit()

        # Ensure standard categories exist for the user
        cat_res = await session.execute(select(Category).where(Category.user_id == "usr_demo_101"))
        existing_cats = cat_res.scalars().all()
        if not existing_cats:
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
                session.add(Category(
                    id=cid,
                    user_id="usr_demo_101",
                    name=cname,
                    icon=cicon,
                    color=ccolor,
                    budget_amount_encrypted="0.00"
                ))
            await session.commit()
