from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class TransactionBase(BaseModel):
    type: str = Field(pattern="^(income|expense)$")
    category: str
    description: str
    merchant: str
    amount: float = Field(gt=0)
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
    category: str
    limit_amount: float = Field(gt=0)
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class BudgetCreate(BudgetBase):
    pass


class BudgetRead(BudgetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class SavingsGoalBase(BaseModel):
    title: str
    target_amount: float = Field(gt=0)
    saved_amount: float = Field(default=0, ge=0)
    color: str | None = None


class SavingsGoalCreate(SavingsGoalBase):
    pass


class SavingsGoalRead(SavingsGoalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


class DashboardSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_cash_flow: float
    monthly_budget: float
    remaining_budget: float
    savings_progress: float
    transaction_count: int


class ReportSummary(BaseModel):
    income: float
    expense: float
    net: float
    savings_rate: float
