"""Add WhatsApp account linking and webhook idempotency tables.

Revision ID: 20261026_000002
Revises: 20261026_000001
"""

from alembic import op
import sqlalchemy as sa


revision = "20261026_000002"
down_revision = "20261026_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_link_challenges",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_table(
        "whatsapp_links",
        sa.Column("whatsapp_id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("whatsapp_id"),
    )
    op.create_index(op.f("ix_whatsapp_links_user_id"), "whatsapp_links", ["user_id"], unique=False)
    op.create_table(
        "whatsapp_messages",
        sa.Column("message_id", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("message_id"),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_messages")
    op.drop_index(op.f("ix_whatsapp_links_user_id"), table_name="whatsapp_links")
    op.drop_table("whatsapp_links")
    op.drop_table("whatsapp_link_challenges")
