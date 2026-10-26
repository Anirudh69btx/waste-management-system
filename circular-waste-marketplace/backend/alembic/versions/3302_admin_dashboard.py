"""admin dashboard model extensions

Revision ID: 3302_admin_dashboard
Revises: 3301_rewards_extend
Create Date: 2026-10-26 11:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "3302_admin_dashboard"
down_revision: Union[str, None] = "3301_rewards_extend"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend users (4 audit columns)
    op.add_column(
        "users",
        sa.Column(
            "last_role_change_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("last_role_change_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "deactivated_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("deactivation_reason", sa.String(length=500), nullable=True),
    )

    # 2. Extend weight_tickets (4 dispute resolution columns)
    op.add_column(
        "weight_tickets",
        sa.Column("dispute_resolution", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "weight_tickets",
        sa.Column(
            "dispute_resolved_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "weight_tickets",
        sa.Column("dispute_resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "weight_tickets",
        sa.Column("dispute_resolution_note", sa.String(length=1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("weight_tickets", "dispute_resolution_note")
    op.drop_column("weight_tickets", "dispute_resolved_at")
    op.drop_column("weight_tickets", "dispute_resolved_by_user_id")
    op.drop_column("weight_tickets", "dispute_resolution")

    op.drop_column("users", "deactivation_reason")
    op.drop_column("users", "deactivated_by_user_id")
    op.drop_column("users", "last_role_change_at")
    op.drop_column("users", "last_role_change_by_user_id")
