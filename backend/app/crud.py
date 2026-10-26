from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Budget, SavingsGoal, Transaction, User


def get_or_create_user(db: Session, email: str, full_name: str, password_hash: str) -> User:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is not None:
        return user

    user = User(email=email, full_name=full_name, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_transaction(db: Session, user_id: int, payload: dict) -> Transaction:
    record = Transaction(user_id=user_id, **payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_transactions(db: Session, user_id: int, limit: int = 100) -> list[Transaction]:
    return db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
    ).scalars().all()


def update_transaction(db: Session, transaction: Transaction, payload: dict) -> Transaction:
    for key, value in payload.items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, transaction: Transaction) -> None:
    db.delete(transaction)
    db.commit()


def get_budgets(db: Session, user_id: int) -> list[Budget]:
    return db.execute(select(Budget).where(Budget.user_id == user_id).order_by(Budget.period.desc())).scalars().all()


def create_budget(db: Session, user_id: int, payload: dict) -> Budget:
    record = Budget(user_id=user_id, **payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_budget(db: Session, budget: Budget, payload: dict) -> Budget:
    for key, value in payload.items():
        setattr(budget, key, value)
    db.commit()
    db.refresh(budget)
    return budget


def delete_budget(db: Session, budget: Budget) -> None:
    db.delete(budget)
    db.commit()


def get_savings_goals(db: Session, user_id: int) -> list[SavingsGoal]:
    return db.execute(select(SavingsGoal).where(SavingsGoal.user_id == user_id)).scalars().all()


def build_dashboard_summary(db: Session, user_id: int, period: str = "current_month") -> dict:
    current_month = datetime.now().strftime("%Y-%m")
    transactions = db.execute(select(Transaction).where(Transaction.user_id == user_id)).scalars().all()

    filtered = transactions
    if period == "current_month":
        filtered = [item for item in transactions if item.date.strftime("%Y-%m") == current_month]

    total_income = sum(float(item.amount) for item in filtered if item.type == "income")
    total_expenses = sum(float(item.amount) for item in filtered if item.type == "expense")
    monthly_budget = sum(float(item.limit_amount) for item in db.execute(select(Budget).where(Budget.user_id == user_id, Budget.period == current_month)).scalars().all())
    remaining_budget = monthly_budget - total_expenses
    savings_progress = (max(total_income - total_expenses, 0) / max(total_income, 1)) * 100 if total_income else 0
    transaction_count = len(filtered)

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_cash_flow": total_income - total_expenses,
        "monthly_budget": monthly_budget,
        "remaining_budget": remaining_budget,
        "savings_progress": round(savings_progress, 2),
        "transaction_count": transaction_count,
    }


def build_report_summary(db: Session, user_id: int, start_date: date, end_date: date) -> dict:
    rows = db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= end_date,
        )
    ).scalars().all()

    income = sum(float(item.amount) for item in rows if item.type == "income")
    expense = sum(float(item.amount) for item in rows if item.type == "expense")
    net = income - expense
    savings_rate = (net / income) if income else 0

    return {
        "income": income,
        "expense": expense,
        "net": net,
        "savings_rate": round(savings_rate, 4),
    }
