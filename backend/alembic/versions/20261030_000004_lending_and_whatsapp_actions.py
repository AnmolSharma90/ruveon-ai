"""Add lending records and idempotent WhatsApp action references.

Revision ID: 20261030_000004
Revises: 20261030_000003
"""

from alembic import op
import sqlalchemy as sa


revision = "20261030_000004"
down_revision = "20261030_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_transactions_user_date",
        "transactions",
        ["user_id", "date", "id"],
        unique=False,
    )
    op.add_column(
        "transactions",
        sa.Column("source_message_id", sa.String(length=255), nullable=True),
    )
    op.create_index("uq_transactions_source_message_id", "transactions", ["source_message_id"], unique=True)
    op.add_column(
        "whatsapp_messages",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="processed"),
    )
    op.add_column(
        "whatsapp_messages",
        sa.Column("reply_text", sa.Text(), nullable=True),
    )
    op.create_table(
        "lending_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("borrower_name", sa.String(length=255), nullable=False),
        sa.Column("principal", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("repaid_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("date_lent", sa.Date(), nullable=False),
        sa.Column("expected_repayment_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_message_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lending_records_id"), "lending_records", ["id"], unique=False)
    op.create_index(op.f("ix_lending_records_user_id"), "lending_records", ["user_id"], unique=False)
    op.create_table(
        "loan_repayments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("loan_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("paid_at", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_message_id", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["loan_id"], ["lending_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_loan_repayments_id"), "loan_repayments", ["id"], unique=False)
    op.create_index(op.f("ix_loan_repayments_loan_id"), "loan_repayments", ["loan_id"], unique=False)
    op.create_index(op.f("ix_loan_repayments_user_id"), "loan_repayments", ["user_id"], unique=False)
    op.create_index(
        "uq_lending_records_source_message_id",
        "lending_records",
        ["source_message_id"],
        unique=True,
    )
    op.create_index(
        "uq_loan_repayments_source_message_id",
        "loan_repayments",
        ["source_message_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_loan_repayments_source_message_id", table_name="loan_repayments")
    op.drop_index("uq_lending_records_source_message_id", table_name="lending_records")
    op.drop_index(op.f("ix_loan_repayments_user_id"), table_name="loan_repayments")
    op.drop_index(op.f("ix_loan_repayments_loan_id"), table_name="loan_repayments")
    op.drop_index(op.f("ix_loan_repayments_id"), table_name="loan_repayments")
    op.drop_table("loan_repayments")
    op.drop_index(op.f("ix_lending_records_user_id"), table_name="lending_records")
    op.drop_index(op.f("ix_lending_records_id"), table_name="lending_records")
    op.drop_table("lending_records")
    op.drop_column("whatsapp_messages", "reply_text")
    op.drop_column("whatsapp_messages", "status")
    op.drop_index("uq_transactions_source_message_id", table_name="transactions")
    op.drop_column("transactions", "source_message_id")
    op.drop_index("ix_transactions_user_date", table_name="transactions")
