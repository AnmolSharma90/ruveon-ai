"""Add budget kinds and revocable authentication sessions.

Revision ID: 20261030_000003
Revises: 20261026_000002
"""

from alembic import op
import sqlalchemy as sa


revision = "20261030_000003"
down_revision = "20261026_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "budgets",
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="category"),
    )
    op.execute(
        "UPDATE budgets SET kind = 'overall' "
        "WHERE lower(trim(category)) = 'overall'"
    )
    op.create_index(
        "uq_budget_user_category_period_kind",
        "budgets",
        ["user_id", sa.text("lower(trim(category))"), "period", "kind"],
        unique=True,
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("last_activity_at", sa.Integer(), nullable=False),
        sa.Column("revoked_at", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("uq_budget_user_category_period_kind", table_name="budgets")
    op.drop_column("budgets", "kind")
