from __future__ import annotations

import base64
import json
import logging
import hashlib
import secrets
import time
from datetime import date
from decimal import Decimal
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.crud import (
    build_dashboard_summary,
    build_report_summary,
    create_budget,
    create_transaction,
    delete_budget,
    delete_transaction,
    get_budgets,
    get_savings_goals,
    get_transactions,
    update_budget,
    update_transaction,
)
from app.database import create_db_and_tables, get_db
from app.models import (
    AuthSession,
    Budget,
    LendingRecord,
    LoanRepayment,
    SavingsGoal,
    Transaction,
    User,
    WhatsAppLink,
    WhatsAppLinkChallenge,
    WhatsAppMessage,
)
from app.schemas import (
    AuthResponse,
    BudgetCreate,
    BudgetRead,
    DashboardSummary,
    LendingSummary,
    LoanCreate,
    LoanRead,
    ReportSummary,
    RepaymentCreate,
    SavingsGoalCreate,
    SavingsGoalRead,
    TransactionCreate,
    TransactionRead,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.ai import FinanceAction, generate_finance_action
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.whatsapp import send_whatsapp_message, verify_webhook_signature

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ruveon-api")
logout_bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_sensitive_response_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(settings.api_v1_prefix):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response


@app.on_event("startup")
def startup_event() -> None:
    if settings.app_env.lower() == "production":
        if (
            len(settings.auth_secret) < 32
            or settings.auth_secret.startswith(("replace-", "ruveon-development-"))
        ):
            raise RuntimeError("Production requires AUTH_SECRET to contain at least 32 characters")
        if settings.database_url.startswith("sqlite"):
            raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL")
        if not settings.allowed_origins or "*" in settings.allowed_origins:
            raise RuntimeError("Production requires CORS_ORIGINS to list the deployed website origin")
    create_db_and_tables()
    logger.info("Database tables verified successfully.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.post(f"{settings.api_v1_prefix}/users", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> dict:
    email = str(payload.email).lower()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "user": user,
        "access_token": create_access_token(db, user.id),
        "session_idle_timeout_seconds": settings.session_idle_timeout_minutes * 60,
    }


@app.post(f"{settings.api_v1_prefix}/users/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> dict:
    email = str(payload.email).lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    valid, replacement_hash = verify_password(payload.password, user.password_hash)
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if replacement_hash:
        user.password_hash = replacement_hash
        db.commit()
    return {
        "user": user,
        "access_token": create_access_token(db, user.id),
        "session_idle_timeout_seconds": settings.session_idle_timeout_minutes * 60,
    }


@app.get(f"{settings.api_v1_prefix}/users/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.post(f"{settings.api_v1_prefix}/users/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(logout_bearer_scheme),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    if credentials is not None:
        try:
            encoded_payload = credentials.credentials.split(".", 1)[0]
            payload = json.loads(
                base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
            )
            session = db.get(AuthSession, str(payload["jti"]))
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            session = None
        if session is not None and session.user_id == current_user.id:
            session.revoked_at = int(time.time())
            db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/users/{{user_id}}", response_model=UserRead)
def read_user(user_id: int, current_user: User = Depends(get_current_user)) -> User:
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return current_user


@app.get(f"{settings.api_v1_prefix}/transactions", response_model=list[TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, gt=0, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
):
    return get_transactions(db, user_id=current_user.id, limit=limit, offset=offset)


@app.post(f"{settings.api_v1_prefix}/transactions", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_new_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Transaction:
    record = create_transaction(
        db,
        user_id=current_user.id,
        payload={
            "type": payload.type,
            "category": payload.category.strip(),
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
    current_user: User = Depends(get_current_user),
) -> Transaction:
    record = db.get(Transaction, transaction_id)
    if record is None or record.user_id != current_user.id:
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
def remove_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    record = db.get(Transaction, transaction_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    delete_transaction(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/budgets", response_model=list[BudgetRead])
def list_budgets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    budgets = get_budgets(db, user_id=current_user.id)
    if not budgets:
        return []
    starts = [date.fromisoformat(f"{budget.period}-01") for budget in budgets]
    start_date = min(starts)
    last_start = max(starts)
    end_date = date(last_start.year + (last_start.month == 12), last_start.month % 12 + 1, 1)
    expense_rows = db.execute(
        select(Transaction.category, Transaction.date, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.date >= start_date,
            Transaction.date < end_date,
        )
        .group_by(Transaction.category, Transaction.date)
    ).all()
    spending: dict[tuple[str, str], Decimal] = {}
    for category, transaction_date, amount in expense_rows:
        key = (category.strip().lower(), transaction_date.strftime("%Y-%m"))
        spending[key] = spending.get(key, Decimal("0")) + amount
    return [
        {
            "id": budget.id,
            "user_id": budget.user_id,
            "category": budget.category,
            "limit_amount": budget.limit_amount,
            "period": budget.period,
            "kind": budget.kind,
            "spent_amount": spending.get((budget.category.strip().lower(), budget.period), Decimal("0"))
            if budget.kind == "category"
            else sum(
                amount for (category, period), amount in spending.items()
                if period == budget.period
            ),
            "remaining_amount": budget.limit_amount - (
                spending.get((budget.category.strip().lower(), budget.period), Decimal("0"))
                if budget.kind == "category"
                else sum(amount for (category, period), amount in spending.items() if period == budget.period)
            ),
            "created_at": budget.created_at,
            "updated_at": budget.updated_at,
        }
        for budget in budgets
    ]


@app.post(f"{settings.api_v1_prefix}/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_new_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    try:
        return create_budget(
            db,
            user_id=current_user.id,
            payload={
                "category": payload.category,
                "limit_amount": payload.limit_amount,
                "period": payload.period,
                "kind": payload.kind,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@app.put(f"{settings.api_v1_prefix}/budgets/{{budget_id}}", response_model=BudgetRead)
def update_existing_budget(
    budget_id: int,
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    record = db.get(Budget, budget_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    try:
        return update_budget(
            db,
            record,
            {
                "category": payload.category,
                "limit_amount": payload.limit_amount,
                "period": payload.period,
                "kind": payload.kind,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@app.delete(f"{settings.api_v1_prefix}/budgets/{{budget_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    record = db.get(Budget, budget_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    delete_budget(db, record)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/goals", response_model=list[SavingsGoalRead])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[SavingsGoal]:
    return get_savings_goals(db, user_id=current_user.id)


@app.post(f"{settings.api_v1_prefix}/goals", response_model=SavingsGoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavingsGoal:
    record = SavingsGoal(user_id=current_user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.put(f"{settings.api_v1_prefix}/goals/{{goal_id}}", response_model=SavingsGoalRead)
def update_goal(
    goal_id: int,
    payload: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavingsGoal:
    record = db.get(SavingsGoal, goal_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")
    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@app.delete(f"{settings.api_v1_prefix}/goals/{{goal_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    record = db.get(SavingsGoal, goal_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{settings.api_v1_prefix}/loans", response_model=list[LoanRead])
def list_loans(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[LendingRecord]:
    return db.execute(
        select(LendingRecord)
        .options(selectinload(LendingRecord.repayments))
        .where(LendingRecord.user_id == current_user.id)
        .order_by(LendingRecord.date_lent.desc(), LendingRecord.id.desc())
    ).scalars().all()


@app.post(f"{settings.api_v1_prefix}/loans", response_model=LoanRead, status_code=status.HTTP_201_CREATED)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LendingRecord:
    if payload.expected_repayment_date and payload.expected_repayment_date < payload.date_lent:
        raise HTTPException(status_code=422, detail="Expected repayment cannot be before the date lent")
    record = LendingRecord(
        user_id=current_user.id,
        borrower_name=payload.borrower_name.strip(),
        principal=payload.principal,
        date_lent=payload.date_lent,
        expected_repayment_date=payload.expected_repayment_date,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    return db.execute(
        select(LendingRecord)
        .options(selectinload(LendingRecord.repayments))
        .where(LendingRecord.id == record.id, LendingRecord.user_id == current_user.id)
    ).scalar_one()


@app.get(f"{settings.api_v1_prefix}/loans/summary", response_model=LendingSummary)
def lending_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> LendingSummary:
    records = db.execute(
        select(
            func.coalesce(func.sum(LendingRecord.principal), 0),
            func.coalesce(func.sum(LendingRecord.repaid_amount), 0),
            func.count(LendingRecord.id),
        ).where(LendingRecord.user_id == current_user.id)
    ).one()
    outstanding = db.execute(
        select(func.count(LendingRecord.id)).where(
            LendingRecord.user_id == current_user.id,
            LendingRecord.status != "repaid",
        )
    ).scalar_one()
    overdue = db.execute(
        select(func.count(LendingRecord.id)).where(
            LendingRecord.user_id == current_user.id,
            LendingRecord.status != "repaid",
            LendingRecord.expected_repayment_date < date.today(),
        )
    ).scalar_one()
    return LendingSummary(
        total_lent=records[0],
        total_recovered=records[1],
        outstanding=records[0] - records[1],
        pending_count=outstanding,
        overdue_count=overdue,
    )


@app.post(
    f"{settings.api_v1_prefix}/loans/{{loan_id}}/repayments",
    response_model=LoanRead,
)
def record_loan_repayment(
    loan_id: int,
    payload: RepaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LendingRecord:
    loan = db.execute(
        select(LendingRecord).where(
            LendingRecord.id == loan_id,
            LendingRecord.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if loan is None:
        raise HTTPException(status_code=404, detail="Lending record not found")
    outstanding = loan.principal - loan.repaid_amount
    if payload.amount > outstanding:
        raise HTTPException(status_code=422, detail="Repayment cannot exceed the outstanding amount")
    repayment = LoanRepayment(
        loan_id=loan.id,
        user_id=current_user.id,
        amount=payload.amount,
        paid_at=payload.paid_at,
        notes=payload.notes,
    )
    loan.repaid_amount += payload.amount
    loan.status = "repaid" if loan.repaid_amount == loan.principal else "partially_repaid"
    db.add(repayment)
    db.commit()
    return db.execute(
        select(LendingRecord)
        .options(selectinload(LendingRecord.repayments))
        .where(LendingRecord.id == loan.id, LendingRecord.user_id == current_user.id)
    ).scalar_one()


@app.get(f"{settings.api_v1_prefix}/dashboard", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    summary = build_dashboard_summary(db, user_id=current_user.id)
    return DashboardSummary(**summary)


@app.get(f"{settings.api_v1_prefix}/reports", response_model=ReportSummary)
def report_summary(
    db: Session = Depends(get_db),
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    summary = build_report_summary(db, user_id=current_user.id, start_date=start_date, end_date=end_date)
    return ReportSummary(**summary)


@app.post(f"{settings.api_v1_prefix}/whatsapp/link-code")
def create_whatsapp_link_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    whatsapp_configuration = (
        settings.whatsapp_display_number,
        settings.whatsapp_phone_number_id,
        settings.whatsapp_access_token,
        settings.whatsapp_app_secret,
        settings.whatsapp_verify_token,
    )
    if not all(whatsapp_configuration):
        raise HTTPException(status_code=503, detail="WhatsApp is not configured yet")

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.merge(WhatsAppLinkChallenge(
        user_id=current_user.id,
        code_hash=hashlib.sha256(code.encode()).hexdigest(),
        expires_at=int(time.time()) + 600,
    ))
    db.commit()
    number = "".join(character for character in settings.whatsapp_display_number if character.isdigit())
    return {
        "whatsapp_url": f"https://wa.me/{number}?text={quote(f'LINK {code}')}",
        "expires_in_seconds": 600,
    }


@app.get(f"{settings.api_v1_prefix}/whatsapp/status")
def whatsapp_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    configured = all((
        settings.whatsapp_display_number,
        settings.whatsapp_phone_number_id,
        settings.whatsapp_access_token,
        settings.whatsapp_app_secret,
        settings.whatsapp_verify_token,
    ))
    linked = db.execute(
        select(WhatsAppLink.whatsapp_id).where(WhatsAppLink.user_id == current_user.id)
    ).scalar_one_or_none() is not None
    return {
        "configured": configured,
        "linked": linked,
        "assistant_available": configured and bool(settings.gemini_api_key),
    }


@app.get(f"{settings.api_v1_prefix}/webhooks/whatsapp")
def verify_whatsapp_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    if (
        mode == "subscribe"
        and settings.whatsapp_verify_token
        and secrets.compare_digest(verify_token or "", settings.whatsapp_verify_token)
        and challenge
    ):
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


def _account_context(db: Session, user_id: int) -> str:
    summary = build_dashboard_summary(db, user_id=user_id)
    goals = get_savings_goals(db, user_id=user_id)
    loans = db.execute(
        select(LendingRecord).where(LendingRecord.user_id == user_id, LendingRecord.status != "repaid")
    ).scalars().all()
    goal_text = "; ".join(
        f"{goal.title}: saved {float(goal.saved_amount):.2f} of {float(goal.target_amount):.2f}"
        for goal in goals
    ) or "No savings goals"
    loan_text = "; ".join(
        f"{loan.borrower_name}: outstanding {loan.principal - loan.repaid_amount:.2f}"
        for loan in loans
    ) or "No outstanding loans"
    return (
        f"Current-month income {summary['total_income']:.2f}; "
        f"expenses {summary['total_expenses']:.2f}; "
        f"net cash flow {summary['net_cash_flow']:.2f}; "
        f"remaining budget {summary['remaining_budget']:.2f}; "
        f"transactions {summary['transaction_count']}; goals: {goal_text}; "
        f"outstanding lending: {loan_text}."
    )


def _format_money(amount: Decimal | float | int) -> str:
    return f"₹{amount:,.2f}"


def _handle_whatsapp_message(db: Session, whatsapp_id: str, message_id: str, text: str) -> str:
    normalized_text = text.strip()
    if normalized_text.upper().startswith("LINK "):
        code = normalized_text[5:].strip()
        if len(code) != 6 or not code.isdigit():
            return "That link code is invalid. Please log in again on Ruveon to get a fresh code."
        digest = hashlib.sha256(code.encode()).hexdigest()
        challenge = db.execute(
            select(WhatsAppLinkChallenge).where(WhatsAppLinkChallenge.code_hash == digest)
        ).scalar_one_or_none()
        if challenge is None or challenge.expires_at < int(time.time()):
            return "That link code has expired or was already used. Log in again on Ruveon to get a new one."
        existing = db.get(WhatsAppLink, whatsapp_id)
        if existing is not None and existing.user_id != challenge.user_id:
            return "This WhatsApp number is already linked to another Ruveon account. Contact support to change it."
        if existing is None:
            db.add(WhatsAppLink(whatsapp_id=whatsapp_id, user_id=challenge.user_id))
        db.delete(challenge)
        db.commit()
        return "You're connected to Ruveon. I'm Ruvi—ask me about your spending, budget, savings goals, or money lent."

    account = db.get(WhatsAppLink, whatsapp_id)
    if account is None:
        return "To connect your finances, sign in to Ruveon and use the WhatsApp link button first."
    if normalized_text.lower() in {"/unlink", "unlink"}:
        db.delete(account)
        db.commit()
        return "Your Ruveon account has been unlinked from this WhatsApp number."

    try:
        action = generate_finance_action(normalized_text, _account_context(db, account.user_id))
    except RuntimeError:
        logger.exception("Ruvi could not generate a WhatsApp reply")
        return "Ruvi is temporarily unavailable because the AI service is not configured or could not be reached. Please try again later."

    if action.confidence < 0.75:
        return action.reply or "I’m not certain what you mean. Could you clarify the amount, category, or person?"
    if action.intent == "clarify":
        return action.reply or "Could you share a little more detail so I can help accurately?"
    if action.intent == "query_spending":
        today = date.today()
        start = today.replace(day=1)
        total = db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == account.user_id,
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= today,
                *(
                    [func.lower(Transaction.category) == action.category.strip().lower()]
                    if action.category
                    else []
                ),
            )
        ).scalar_one()
        label = f" in {action.category}" if action.category else ""
        return f"You have spent {_format_money(total)}{label} so far this month."

    if action.intent == "query_budget":
        if not action.category:
            return "Which category budget would you like to check?"
        month = date.today().strftime("%Y-%m")
        budget = db.execute(
            select(Budget).where(
                Budget.user_id == account.user_id,
                Budget.kind == "category",
                Budget.period == month,
                func.lower(Budget.category) == action.category.strip().lower(),
            )
        ).scalar_one_or_none()
        if budget is None:
            return f"You do not have a {action.category} budget for this month."
        spent = db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == account.user_id,
                Transaction.type == "expense",
                func.lower(Transaction.category) == budget.category.lower(),
                Transaction.date >= date.today().replace(day=1),
                Transaction.date <= date.today(),
            )
        ).scalar_one()
        return (
            f"{budget.category} budget: {_format_money(budget.limit_amount)}. "
            f"Spent {_format_money(spent)}; {_format_money(budget.limit_amount - spent)} remaining."
        )

    if action.intent == "record_transaction":
        if not action.amount or not action.transaction_type or not action.category:
            return "Please tell me the amount and category, and whether it was money spent or received."
        existing = db.execute(
            select(Transaction).where(Transaction.source_message_id == message_id)
        ).scalar_one_or_none()
        if existing is not None:
            return f"That transaction is already saved: {_format_money(existing.amount)} for {existing.category}."
        description = (action.description or action.category).strip()
        create_transaction(
            db,
            user_id=account.user_id,
            payload={
                "type": action.transaction_type,
                "category": action.category,
                "description": description,
                "merchant": (action.merchant or description).strip(),
                "amount": action.amount,
                "date": action.date or date.today(),
                "payment_method": "WhatsApp",
                "notes": "Recorded via Ruvi",
                "source_message_id": message_id,
            },
        )
        verb = "spent" if action.transaction_type == "expense" else "received"
        return f"Saved: {verb} {_format_money(action.amount)} for {action.category}."

    if action.intent == "lend_money":
        if not action.amount or not action.borrower_name:
            return "Please tell me who you lent money to and the amount."
        existing = db.execute(
            select(LendingRecord).where(LendingRecord.source_message_id == message_id)
        ).scalar_one_or_none()
        if existing is not None:
            return f"Your loan to {existing.borrower_name} is already saved."
        person = action.borrower_name.strip()
        if not person:
            return "Who did you lend the money to?"
        date_lent = action.date or date.today()
        if action.expected_repayment_date and action.expected_repayment_date < date_lent:
            return "The expected repayment date is before the date lent. Please clarify the dates."
        record = LendingRecord(
            user_id=account.user_id,
            borrower_name=person,
            principal=action.amount,
            date_lent=date_lent,
            expected_repayment_date=action.expected_repayment_date,
            status="pending",
            notes="Recorded via Ruvi",
            source_message_id=message_id,
        )
        db.add(record)
        db.commit()
        due = f", expected back by {record.expected_repayment_date}" if record.expected_repayment_date else ""
        return f"Saved: {_format_money(record.principal)} lent to {person}{due}. It is tracked as money owed, not an expense."

    if action.intent == "record_repayment":
        if not action.amount or not action.borrower_name:
            return "Please tell me whose repayment you received and the amount."
        person = action.borrower_name.strip()
        loans = db.execute(
            select(LendingRecord).where(
                LendingRecord.user_id == account.user_id,
                LendingRecord.status != "repaid",
                func.lower(LendingRecord.borrower_name) == person.lower(),
            )
        ).scalars().all()
        matching = [loan for loan in loans if action.amount <= loan.principal - loan.repaid_amount]
        if not matching:
            return f"I couldn’t find a pending loan from {person} that matches this repayment."
        if len(matching) > 1:
            options = "; ".join(
                f"{_format_money(loan.principal - loan.repaid_amount)} outstanding since {loan.date_lent}"
                for loan in matching
            )
            return f"You have more than one matching loan to {person}: {options}. Which one was repaid?"
        loan = matching[0]
        existing_repayment = db.execute(
            select(LoanRepayment).where(LoanRepayment.source_message_id == message_id)
        ).scalar_one_or_none()
        if existing_repayment is not None:
            return f"That repayment is already saved for {person}."
        repayment = LoanRepayment(
            loan_id=loan.id,
            user_id=account.user_id,
            amount=action.amount,
            paid_at=action.date or date.today(),
            notes="Recorded via Ruvi",
            source_message_id=message_id,
        )
        loan.repaid_amount += action.amount
        loan.status = "repaid" if loan.repaid_amount == loan.principal else "partially_repaid"
        db.add(repayment)
        db.commit()
        outstanding = loan.principal - loan.repaid_amount
        return (
            f"Saved {_format_money(action.amount)} repayment from {person}. "
            f"{_format_money(outstanding)} remains outstanding."
            if outstanding
            else f"Saved the final repayment from {person}. This loan is now fully repaid."
        )

    if action.intent == "edit_transaction":
        if not action.old_amount or not action.amount:
            return "Please tell me the original amount and the correct amount."
        conditions = [
            Transaction.user_id == account.user_id,
            Transaction.amount == action.old_amount,
        ]
        if action.transaction_type:
            conditions.append(Transaction.type == action.transaction_type)
        if action.category:
            conditions.append(func.lower(Transaction.category) == action.category.strip().lower())
        if action.date:
            conditions.append(Transaction.date == action.date)
        matches = db.execute(select(Transaction).where(*conditions).limit(3)).scalars().all()
        if len(matches) != 1:
            return "I found no unique matching transaction. Please include its date, category, and original amount."
        matches[0].amount = action.amount
        db.commit()
        return f"Updated the {matches[0].category} transaction to {_format_money(matches[0].amount)}."

    return action.reply or "I can help track expenses, income, budgets, savings, and money lent. What would you like to do?"


@app.post(f"{settings.api_v1_prefix}/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    body = await request.body()
    if not verify_webhook_signature(body, request.headers.get("x-hub-signature-256")):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                message_id = message.get("id")
                whatsapp_id = message.get("from")
                text = message.get("text", {}).get("body")
                if not message_id or not whatsapp_id or not isinstance(text, str):
                    continue
                message_record = db.get(WhatsAppMessage, message_id)
                if message_record is None:
                    message_record = WhatsAppMessage(message_id=message_id, status="processing")
                    db.add(message_record)
                    try:
                        db.commit()
                    except IntegrityError:
                        db.rollback()
                        message_record = db.get(WhatsAppMessage, message_id)
                        if message_record is None:
                            raise
                elif message_record.status == "processed":
                    if message_record.reply_text:
                        try:
                            send_whatsapp_message(whatsapp_id, message_record.reply_text)
                        except RuntimeError as exc:
                            raise HTTPException(status_code=503, detail="WhatsApp reply delivery failed") from exc
                    continue

                reply = _handle_whatsapp_message(db, whatsapp_id, message_id, text)
                message_record = db.get(WhatsAppMessage, message_id)
                if message_record is None:
                    raise RuntimeError("WhatsApp message idempotency record disappeared during processing")
                message_record.status = "processed"
                message_record.reply_text = reply
                db.commit()
                try:
                    send_whatsapp_message(whatsapp_id, reply)
                except RuntimeError as exc:
                    raise HTTPException(status_code=503, detail="WhatsApp reply delivery failed") from exc

    return {"status": "ok"}
