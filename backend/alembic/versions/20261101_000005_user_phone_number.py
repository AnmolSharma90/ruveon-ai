"""Add optional user phone numbers.

Revision ID: 20261101_000005
Revises: 20261030_000004
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101_000005"
down_revision = "20261030_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(length=16), nullable=True))
    op.create_index("ix_users_phone_number", "users", ["phone_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_phone_number", table_name="users")
    op.drop_column("users", "phone_number")
