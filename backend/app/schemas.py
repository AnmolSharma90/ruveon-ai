from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from typing import Annotated
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

CategoryName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2)
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
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
