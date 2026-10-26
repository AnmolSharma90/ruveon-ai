import hashlib
from datetime import date, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)


def seed_demo_data() -> None:
    from app.models import Budget, SavingsGoal, Transaction, User

    db = SessionLocal()
    try:
        demo_user = db.execute(select(User).where(User.email == "demo@ruveon.ai")).scalar_one_or_none()
        if demo_user is None:
            if db.execute(select(User.id).limit(1)).first() is not None:
                return

            demo_user = User(
                email="demo@ruveon.ai",
                full_name="Demo User",
                password_hash=hashlib.sha256(b"demo123").hexdigest(),
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
        else:
            demo_user.password_hash = hashlib.sha256(b"demo123").hexdigest()
            db.commit()

        today = date.today()
        transactions = [
            Transaction(
                user_id=demo_user.id,
                type="income",
                category="Salary",
                description="Primary salary",
                merchant="Employer",
                amount=95000,
                date=today - timedelta(days=5),
                payment_method="Bank Transfer",
                notes="Monthly salary",
            ),
            Transaction(
                user_id=demo_user.id,
                type="expense",
                category="Housing",
                description="Rent payment",
                merchant="Urban Heights",
                amount=32000,
                date=today - timedelta(days=4),
                payment_method="UPI",
                notes="Apartment rent",
            ),
            Transaction(
                user_id=demo_user.id,
                type="expense",
                category="Food",
                description="Weekly groceries",
                merchant="Fresh Basket",
                amount=2400,
                date=today - timedelta(days=2),
                payment_method="UPI",
                notes="Groceries",
            ),
            Transaction(
                user_id=demo_user.id,
                type="expense",
                category="Transport",
                description="Fuel and commute",
                merchant="City Fuel",
                amount=1800,
                date=today - timedelta(days=1),
                payment_method="Card",
                notes="Travel and fuel",
            ),
        ]
        db.add_all(transactions)

        budgets = [
            Budget(user_id=demo_user.id, category="Food", limit_amount=8500, period=today.strftime("%Y-%m")),
            Budget(user_id=demo_user.id, category="Housing", limit_amount=35000, period=today.strftime("%Y-%m")),
            Budget(user_id=demo_user.id, category="Transport", limit_amount=5000, period=today.strftime("%Y-%m")),
        ]
        db.add_all(budgets)

        goals = [
            SavingsGoal(
                user_id=demo_user.id,
                title="Emergency fund",
                target_amount=200000,
                saved_amount=120000,
                color="#14b8a6",
            ),
            SavingsGoal(
                user_id=demo_user.id,
                title="Travel fund",
                target_amount=50000,
                saved_amount=21000,
                color="#f59e0b",
            ),
        ]
        db.add_all(goals)
        db.commit()
    finally:
        db.close()
