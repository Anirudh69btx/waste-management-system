"""add purchase_orders

Revision ID: 3203_purchase_orders
Revises: 3202_inventory_lots
Create Date: 2026-10-25 08:02:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3203_purchase_orders'
down_revision: Union[str, None] = '3202_inventory_lots'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'purchase_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_code', sa.String(length=32), nullable=False),
        sa.Column('listing_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('buyer_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('seller_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=8), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending_payment'),
        sa.Column('escrow_held_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancellation_reason', sa.String(length=500), nullable=True),
        sa.Column('request_id_correlation', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['buyer_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['listing_id'], ['marketplace_listings.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['seller_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_orders_buyer_user_id'), 'purchase_orders', ['buyer_user_id'], unique=False)
    op.create_index(op.f('ix_purchase_orders_listing_id'), 'purchase_orders', ['listing_id'], unique=False)
    op.create_index(op.f('ix_purchase_orders_order_code'), 'purchase_orders', ['order_code'], unique=True)
    op.create_index(op.f('ix_purchase_orders_status'), 'purchase_orders', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_purchase_orders_status'), table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_order_code'), table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_listing_id'), table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_buyer_user_id'), table_name='purchase_orders')
    op.drop_table('purchase_orders')
