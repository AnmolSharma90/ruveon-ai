from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

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
    source_message_id = payload.get("source_message_id")
    if source_message_id:
        existing = db.execute(
            select(Transaction).where(Transaction.source_message_id == source_message_id)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
    payload["category"] = normalize_category(db, user_id, payload["category"])
    record = Transaction(user_id=user_id, **payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_transactions(db: Session, user_id: int, limit: int = 100, offset: int = 0) -> list[Transaction]:
    return db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()


def update_transaction(db: Session, transaction: Transaction, payload: dict) -> Transaction:
    payload["category"] = normalize_category(db, transaction.user_id, payload["category"])
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
    payload["category"] = "Overall" if payload["kind"] == "overall" else " ".join(payload["category"].split())
    duplicate = db.execute(
        select(Budget.id).where(
            Budget.user_id == user_id,
            func.lower(func.trim(Budget.category)) == payload["category"].lower(),
            Budget.period == payload["period"],
            Budget.kind == payload["kind"],
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise ValueError("A budget already exists for this category and period")
    record = Budget(user_id=user_id, **payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_budget(db: Session, budget: Budget, payload: dict) -> Budget:
    payload["category"] = "Overall" if payload["kind"] == "overall" else " ".join(payload["category"].split())
    duplicate = db.execute(
        select(Budget.id).where(
            Budget.user_id == budget.user_id,
            func.lower(func.trim(Budget.category)) == payload["category"].lower(),
            Budget.period == payload["period"],
            Budget.kind == payload["kind"],
            Budget.id != budget.id,
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise ValueError("A budget already exists for this category and period")
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
    current_month = date.today().strftime("%Y-%m")
    month_start = date.today().replace(day=1)
    next_month = date(month_start.year + (month_start.month == 12), month_start.month % 12 + 1, 1)
    totals = db.execute(
        select(Transaction.type, func.sum(Transaction.amount), func.count(Transaction.id))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= month_start,
            Transaction.date < next_month,
        )
        .group_by(Transaction.type)
    ).all()
    totals_by_type = {kind: (Decimal(amount or 0), count) for kind, amount, count in totals}
    total_income = float(totals_by_type.get("income", (Decimal(0), 0))[0])
    total_expenses = float(totals_by_type.get("expense", (Decimal(0), 0))[0])
    transaction_count = sum(count for _, count in totals_by_type.values())
    category_rows = db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= month_start,
            Transaction.date < next_month,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()
    category_spending = [{"name": category, "value": float(amount)} for category, amount in category_rows]

    trend_start = month_start
    for _ in range(5):
        trend_start = date(trend_start.year - 1, 12, 1) if trend_start.month == 1 else date(trend_start.year, trend_start.month - 1, 1)
    daily_rows = db.execute(
        select(Transaction.date, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= trend_start,
            Transaction.date < next_month,
        )
        .group_by(Transaction.date)
    ).all()
    expenses_by_month: dict[str, float] = {}
    for transaction_date, amount in daily_rows:
        key = transaction_date.strftime("%Y-%m")
        expenses_by_month[key] = expenses_by_month.get(key, 0) + float(amount)
    expense_trend: list[dict] = []
    cursor = trend_start
    while cursor <= month_start:
        expense_trend.append({
            "name": cursor.strftime("%b %y"),
            "value": expenses_by_month.get(cursor.strftime("%Y-%m"), 0),
        })
        cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
    monthly_budget = float(db.execute(
        select(func.coalesce(func.sum(Budget.limit_amount), 0)).where(
            Budget.user_id == user_id,
            Budget.period == current_month,
            Budget.kind == "overall",
        )
    ).scalar_one())
    remaining_budget = monthly_budget - total_expenses
    savings_progress = (max(total_income - total_expenses, 0) / max(total_income, 1)) * 100 if total_income else 0

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_cash_flow": total_income - total_expenses,
        "monthly_budget": monthly_budget,
        "remaining_budget": remaining_budget,
        "savings_progress": round(savings_progress, 2),
        "transaction_count": transaction_count,
        "category_spending": category_spending,
        "expense_trend": expense_trend,
    }


def normalize_category(db: Session, user_id: int, category: str) -> str:
    normalized = " ".join(category.split())
    if not normalized:
        raise ValueError("Category cannot be empty")
    existing = db.execute(
        select(Transaction.category)
        .where(
            Transaction.user_id == user_id,
            func.lower(func.trim(Transaction.category)) == normalized.lower(),
        )
        .limit(1)
    ).scalar_one_or_none()
    return existing or normalized


def build_report_summary(db: Session, user_id: int, start_date: date, end_date: date) -> dict:
    filters = (
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
    )
    totals = db.execute(
        select(Transaction.type, func.sum(Transaction.amount))
        .where(*filters)
        .group_by(Transaction.type)
    ).all()
    totals_by_type = {kind: float(amount) for kind, amount in totals}
    income = totals_by_type.get("income", 0)
    expense = totals_by_type.get("expense", 0)
    net = income - expense
    savings_rate = (net / income) if income else 0
    category_rows = db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(*filters, Transaction.type == "expense")
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()
    category_spending = [{"name": category, "value": float(amount)} for category, amount in category_rows]
    daily_rows = db.execute(
        select(Transaction.date, Transaction.type, func.sum(Transaction.amount))
        .where(*filters)
        .group_by(Transaction.date, Transaction.type)
    ).all()
    monthly_totals: dict[str, dict[str, float]] = {}
    for transaction_date, kind, amount in daily_rows:
        key = transaction_date.strftime("%Y-%m")
        month_data = monthly_totals.setdefault(key, {"income": 0, "expense": 0})
        month_data[kind] += float(amount)
    monthly_trend = []
    cursor = start_date.replace(day=1)
    last_month = end_date.replace(day=1)
    while cursor <= last_month:
        key = cursor.strftime("%Y-%m")
        month_data = monthly_totals.get(key, {"income": 0, "expense": 0})
        monthly_trend.append({
            "month": cursor.strftime("%b %y"),
            "income": month_data["income"],
            "expense": month_data["expense"],
        })
        cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)

    return {
        "income": income,
        "expense": expense,
        "net": net,
        "savings_rate": round(savings_rate, 4),
        "category_spending": category_spending,
        "monthly_trend": monthly_trend,
    }
