from __future__ import annotations

import logging
import hashlib
import secrets
import time
from datetime import date
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
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
    get_savings_goals,
    get_transactions,
    update_budget,
    update_transaction,
)
from app.database import create_db_and_tables, get_db
from app.models import (
    Budget,
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
    ReportSummary,
    SavingsGoalCreate,
    SavingsGoalRead,
    TransactionCreate,
    TransactionRead,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.ai import generate_finance_reply
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.whatsapp import send_whatsapp_message, verify_webhook_signature

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ruveon-api")

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"user": user, "access_token": create_access_token(user.id)}


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
    return {"user": user, "access_token": create_access_token(user.id)}


@app.get(f"{settings.api_v1_prefix}/users/{{user_id}}", response_model=UserRead)
def read_user(user_id: int, current_user: User = Depends(get_current_user)) -> User:
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return current_user


@app.get(f"{settings.api_v1_prefix}/transactions", response_model=list[TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, gt=0),
    current_user: User = Depends(get_current_user),
):
    return get_transactions(db, user_id=current_user.id, limit=limit)


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
def list_budgets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Budget]:
    return get_budgets(db, user_id=current_user.id)


@app.post(f"{settings.api_v1_prefix}/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def create_new_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Budget:
    return create_budget(
        db,
        user_id=current_user.id,
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
    current_user: User = Depends(get_current_user),
) -> Budget:
    record = db.get(Budget, budget_id)
    if record is None or record.user_id != current_user.id:
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
        settings.gemini_api_key,
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
    goal_text = "; ".join(
        f"{goal.title}: saved {float(goal.saved_amount):.2f} of {float(goal.target_amount):.2f}"
        for goal in goals
    ) or "No savings goals"
    return (
        f"Current-month income {summary['total_income']:.2f}; "
        f"expenses {summary['total_expenses']:.2f}; "
        f"net cash flow {summary['net_cash_flow']:.2f}; "
        f"remaining budget {summary['remaining_budget']:.2f}; "
        f"transactions {summary['transaction_count']}; goals: {goal_text}."
    )


def _handle_whatsapp_message(db: Session, whatsapp_id: str, message_id: str, text: str) -> None:
    normalized_text = text.strip()
    if normalized_text.upper().startswith("LINK "):
        code = normalized_text[5:].strip()
        if len(code) != 6 or not code.isdigit():
            send_whatsapp_message(whatsapp_id, "That link code is invalid. Please log in again on Ruveon to get a fresh code.")
            return
        digest = hashlib.sha256(code.encode()).hexdigest()
        challenge = db.execute(
            select(WhatsAppLinkChallenge).where(WhatsAppLinkChallenge.code_hash == digest)
        ).scalar_one_or_none()
        if challenge is None or challenge.expires_at < int(time.time()):
            send_whatsapp_message(whatsapp_id, "That link code has expired or was already used. Log in again on Ruveon to get a new one.")
            return
        existing = db.get(WhatsAppLink, whatsapp_id)
        if existing is not None and existing.user_id != challenge.user_id:
            send_whatsapp_message(whatsapp_id, "This WhatsApp number is already linked to another Ruveon account. Contact support to change it.")
            return
        if existing is None:
            db.add(WhatsAppLink(whatsapp_id=whatsapp_id, user_id=challenge.user_id))
        db.delete(challenge)
        db.commit()
        send_whatsapp_message(whatsapp_id, "You're connected to Ruveon. I'm Ruvi—ask me about your monthly spending, budget, or savings goals.")
        return

    account = db.get(WhatsAppLink, whatsapp_id)
    if account is None:
        send_whatsapp_message(whatsapp_id, "To connect your finances, sign in to Ruveon and use the WhatsApp link button first.")
        return
    if normalized_text.lower() in {"/unlink", "unlink"}:
        db.delete(account)
        db.commit()
        send_whatsapp_message(whatsapp_id, "Your Ruveon account has been unlinked from this WhatsApp number.")
        return

    try:
        reply = generate_finance_reply(normalized_text, _account_context(db, account.user_id))
    except RuntimeError:
        logger.exception("Ruvi could not generate a WhatsApp reply")
        send_whatsapp_message(whatsapp_id, "Ruvi is temporarily unavailable. Please try again later.")
        return
    send_whatsapp_message(whatsapp_id, reply)


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
                if db.get(WhatsAppMessage, message_id):
                    continue
                _handle_whatsapp_message(db, whatsapp_id, message_id, text)
                db.add(WhatsAppMessage(message_id=message_id))
                db.commit()

    return {"status": "ok"}
