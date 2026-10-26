from __future__ import annotations

import hashlib
import logging
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.crud import (
    build_dashboard_summary,
    build_report_summary,
    create_budget,
    create_transaction,
    delete_budget,
    delete_transaction,
    get_budgets,
    get_or_create_user,
    get_savings_goals,
    get_transactions,
    update_budget,
    update_transaction,
)
from app.database import SessionLocal, create_db_and_tables, get_db, seed_demo_data
from app.models import Budget, SavingsGoal, Transaction, User
from app.schemas import (
    AuthResponse,
    BudgetCreate,
    BudgetRead,
    DashboardSummary,
    ReportSummary,
    SavingsGoalCreate,
    SavingsGoalRead,
    TransactionCreate,
    TransactionRead,
    UserCreate,
    UserLogin,
    UserRead,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ruveon-api")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.strip().encode("utf-8")).hexdigest()


app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    try:
        create_db_and_tables()
        seed_demo_data()
        logger.info("Database tables verified successfully.")
    except Exception as exc:  # pragma: no cover - depends on local Postgres availability
        logger.warning("Database is unavailable. Backend is ready for database setup: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.post(f"{settings.api_v1_prefix}/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    normalized_email = str(payload.email).lower()
    existing = db.execute(select(User).where(User.email == normalized_email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    user = User(
        email=normalized_email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post(f"{settings.api_v1_prefix}/users/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> dict:
    normalized_email = str(payload.email).lower()
    user = db.execute(select(User).where(User.email == normalized_email)).scalar_one_or_none()
    if user is None or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return {"user": user, "message": "Authenticated"}


@app.get(f"{settings.api_v1_prefix}/users/{{user_id}}", response_model=UserRead)
def read_user(user_id: int, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@app.get(f"{settings.api_v1_prefix}/transactions", response_model=list[TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    user_id: int = Query(default=1, description="Active demo user id"),
    limit: int = Query(default=100, gt=0),
):
    return get_transactions(db, user_id=user_id, limit=limit)


@app.post(f"{settings.api_v1_prefix}/transactions", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_new_transaction(payload: TransactionCreate, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> Transaction:
    record = create_transaction(
        db,
        user_id=user_id,
        payload={
            "type": payload.type,
            "category": payload.category,
            "description": payload.description,
            "merchant": payload.merchant,
            "amount": payload.amount,
            "date": payload.date,
            "payment_method": payload.payment_method,
            "notes": payload.notes,
        },
    )
    return record


@app.put(f"{settings.api_v1_prefix}/transactions/{{transaction_id}}", response_model=TransactionRead)
def update_existing_transaction(
    transaction_id: int,
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user_id: int = Query(default=1),
) -> Transaction:
    record = db.get(Transaction, transaction_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return update_transaction(
        db,
        record,
        {
            "type": payload.type,
            "category": payload.category,
            "description": payload.description,
            "merchant": payload.merchant,
            "amount": payload.amount,
            "date": payload.date,
            "payment_method": payload.payment_method,
            "notes": payload.notes,
        },
    )


@app.delete(f"{settings.api_v1_prefix}/transactions/{{transaction_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_transaction(transaction_id: int, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> Response:
    record = db.get(Transaction, transaction_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    delete_transaction(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/budgets", response_model=list[BudgetRead])
def list_budgets(db: Session = Depends(get_db), user_id: int = Query(default=1)) -> list[Budget]:
    return get_budgets(db, user_id=user_id)


@app.post(f"{settings.api_v1_prefix}/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_new_budget(payload: BudgetCreate, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> Budget:
    return create_budget(
        db,
        user_id=user_id,
        payload={
            "category": payload.category,
            "limit_amount": payload.limit_amount,
            "period": payload.period,
        },
    )


@app.put(f"{settings.api_v1_prefix}/budgets/{{budget_id}}", response_model=BudgetRead)
def update_existing_budget(
    budget_id: int,
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    user_id: int = Query(default=1),
) -> Budget:
    record = db.get(Budget, budget_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return update_budget(
        db,
        record,
        {
            "category": payload.category,
            "limit_amount": payload.limit_amount,
            "period": payload.period,
        },
    )


@app.delete(f"{settings.api_v1_prefix}/budgets/{{budget_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_budget(budget_id: int, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> Response:
    record = db.get(Budget, budget_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    delete_budget(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/goals", response_model=list[SavingsGoalRead])
def list_goals(db: Session = Depends(get_db), user_id: int = Query(default=1)) -> list[SavingsGoal]:
    return get_savings_goals(db, user_id=user_id)


@app.post(f"{settings.api_v1_prefix}/goals", response_model=SavingsGoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: SavingsGoalCreate, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> SavingsGoal:
    record = SavingsGoal(user_id=user_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.put(f"{settings.api_v1_prefix}/goals/{{goal_id}}", response_model=SavingsGoalRead)
def update_goal(goal_id: int, payload: SavingsGoalCreate, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> SavingsGoal:
    record = db.get(SavingsGoal, goal_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")

    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@app.delete(f"{settings.api_v1_prefix}/goals/{{goal_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_goal(goal_id: int, db: Session = Depends(get_db), user_id: int = Query(default=1)) -> Response:
    record = db.get(SavingsGoal, goal_id)
    if record is None or record.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/dashboard", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), user_id: int = Query(default=1)) -> dict:
    summary = build_dashboard_summary(db, user_id=user_id)
    return DashboardSummary(**summary)


@app.get(f"{settings.api_v1_prefix}/reports", response_model=ReportSummary)
def report_summary(
    db: Session = Depends(get_db),
    user_id: int = Query(default=1),
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> dict:
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    summary = build_report_summary(db, user_id=user_id, start_date=start_date, end_date=end_date)
    return ReportSummary(**summary)
