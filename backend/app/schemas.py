from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, TypeAdapter, field_validator

CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
PHONE_NUMBER_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


def normalize_phone_number(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Enter a phone number in international format, such as +919876543210.")
    normalized = re.sub(r"[\s().-]", "", value)
    if not PHONE_NUMBER_PATTERN.fullmatch(normalized):
        raise ValueError("Enter a phone number in international format, such as +919876543210.")
    return normalized


class UserCreate(BaseModel):
    email: EmailStr
    phone_number: str
    full_name: str = Field(min_length=2)
    password: str = Field(min_length=8)

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone_number(cls, value: object) -> str:
        return normalize_phone_number(value)


class UserLogin(BaseModel):
    email_or_phone: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8)

    @field_validator("email_or_phone")
    @classmethod
    def validate_email_or_phone(cls, value: str) -> str:
        value = value.strip()
        if "@" in value:
            return str(TypeAdapter(EmailStr).validate_python(value)).lower()
        return normalize_phone_number(value)


class AccountDeletionRequest(BaseModel):
    password: str = Field(min_length=8)
    confirmation: Literal["DELETE"]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    phone_number: str | None = None
    full_name: str
    created_at: datetime
    updated_at: datetime


class AuthResponse(BaseModel):
    user: UserRead
    access_token: str
    token_type: str = "bearer"
    session_idle_timeout_seconds: int


class TransactionBase(BaseModel):
    type: str = Field(pattern="^(income|expense)$")
    category: CategoryName
    description: str = Field(min_length=1, max_length=255)
    merchant: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: date
    payment_method: str = "UPI"
    notes: str | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class BudgetBase(BaseModel):
    category: CategoryName
    limit_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    kind: Literal["overall", "category"] = "category"


class BudgetCreate(BudgetBase):
    pass


class BudgetRead(BudgetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    spent_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


class SavingsGoalBase(BaseModel):
    title: str
    target_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    saved_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    color: str | None = None


class SavingsGoalCreate(SavingsGoalBase):
    pass


class SavingsGoalRead(SavingsGoalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class LoanCreate(BaseModel):
    borrower_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    principal: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date_lent: date
    expected_repayment_date: date | None = None
    notes: str | None = None


class RepaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    paid_at: date = Field(default_factory=date.today)
    notes: str | None = None


class RepaymentRead(RepaymentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    user_id: int


class LoanRead(LoanCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    repaid_amount: Decimal
    status: str
    repayments: list[RepaymentRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class LendingSummary(BaseModel):
    total_lent: Decimal
    total_recovered: Decimal
    outstanding: Decimal
    pending_count: int
    overdue_count: int


class NamedAmount(BaseModel):
    name: str
    value: float


class MonthlyTotals(BaseModel):
    month: str
    income: float
    expense: float


class DashboardSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_cash_flow: float
    monthly_budget: float
    remaining_budget: float
    savings_progress: float
    transaction_count: int
    category_spending: list[NamedAmount] = Field(default_factory=list)
    expense_trend: list[NamedAmount] = Field(default_factory=list)


class ReportSummary(BaseModel):
    income: float
    expense: float
    net: float
    savings_rate: float
    category_spending: list[NamedAmount] = Field(default_factory=list)
    monthly_trend: list[MonthlyTotals] = Field(default_factory=list)
