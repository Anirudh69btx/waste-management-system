"""extend reward_wallets, reward_transactions, eco_products, eco_orders for 3.3b

Revision ID: 3301_rewards_extend
Revises: 3205_intake_metadata
Create Date: 2026-10-26 08:05:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "3301_rewards_extend"
down_revision: Union[str, None] = "3205_intake_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend reward_wallets
    op.add_column(
        "reward_wallets",
        sa.Column("points_balance", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "reward_wallets",
        sa.Column("lifetime_points", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "reward_wallets",
        sa.Column("streak_days", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "reward_wallets",
        sa.Column("last_submission_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "reward_wallets",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        "UPDATE reward_wallets SET points_balance = available_points, lifetime_points = lifetime_earned"
    )

    # 2. Rebuild reward_transactions with UUID PK and reference tracking (table is empty)
    op.drop_table("reward_transactions")
    op.create_table(
        "reward_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "wallet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reward_wallets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "intake_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("waste_intakes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("points_delta", sa.Integer(), nullable=False),
        sa.Column("transaction_type", sa.String(length=64), nullable=False),
        sa.Column("reference_type", sa.String(length=32), nullable=True),
        sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_reward_tx_wallet", "reward_transactions", ["wallet_id", "created_at"])
    op.create_index("idx_reward_tx_user", "reward_transactions", ["user_id", "created_at"])

    # 3. Extend eco_products
    op.alter_column(
        "eco_products",
        "category",
        existing_type=sa.String(length=16),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    op.alter_column(
        "eco_products",
        "description",
        existing_type=sa.Text(),
        nullable=True,
    )
    op.add_column(
        "eco_products",
        sa.Column("unit", sa.String(length=32), server_default="piece", nullable=False),
    )
    op.add_column(
        "eco_products",
        sa.Column("weight_kg", sa.Numeric(precision=10, scale=3), nullable=True),
    )
    op.add_column(
        "eco_products",
        sa.Column("points_cost", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "eco_products",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # 4. Extend eco_orders
    op.add_column(
        "eco_orders",
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("eco_products.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.add_column(
        "eco_orders",
        sa.Column("product_title", sa.String(length=255), server_default="", nullable=False),
    )
    op.add_column(
        "eco_orders",
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("eco_orders", "status")
    op.drop_column("eco_orders", "product_title")
    op.drop_column("eco_orders", "product_id")
    op.drop_column("eco_products", "is_active")
    op.drop_column("eco_products", "points_cost")
    op.drop_column("eco_products", "weight_kg")
    op.drop_column("eco_products", "unit")
    op.drop_column("reward_wallets", "created_at")
    op.drop_column("reward_wallets", "last_submission_date")
    op.drop_column("reward_wallets", "streak_days")
    op.drop_column("reward_wallets", "lifetime_points")
    op.drop_column("reward_wallets", "points_balance")
