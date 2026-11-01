"""Associate WhatsApp reply cache with accounts for data deletion.

Revision ID: 20261101_000006
Revises: 20261101_000005
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101_000006"
down_revision = "20261101_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("whatsapp_messages") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_whatsapp_messages_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index("ix_whatsapp_messages_user_id", ["user_id"])

    op.execute(
        "UPDATE whatsapp_messages "
        "SET user_id = (SELECT transactions.user_id FROM transactions "
        "WHERE transactions.source_message_id = whatsapp_messages.message_id) "
        "WHERE EXISTS (SELECT 1 FROM transactions "
        "WHERE transactions.source_message_id = whatsapp_messages.message_id)"
    )
    op.execute(
        "UPDATE whatsapp_messages "
        "SET user_id = (SELECT lending_records.user_id FROM lending_records "
        "WHERE lending_records.source_message_id = whatsapp_messages.message_id) "
        "WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM lending_records "
        "WHERE lending_records.source_message_id = whatsapp_messages.message_id)"
    )
    op.execute(
        "UPDATE whatsapp_messages "
        "SET user_id = (SELECT loan_repayments.user_id FROM loan_repayments "
        "WHERE loan_repayments.source_message_id = whatsapp_messages.message_id) "
        "WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM loan_repayments "
        "WHERE loan_repayments.source_message_id = whatsapp_messages.message_id)"
    )
    op.execute(
        "UPDATE whatsapp_messages SET reply_text = NULL WHERE user_id IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("whatsapp_messages") as batch_op:
        batch_op.drop_index("ix_whatsapp_messages_user_id")
        batch_op.drop_constraint(
            "fk_whatsapp_messages_user_id_users",
            type_="foreignkey",
        )
        batch_op.drop_column("user_id")
