"""add inventory_lots

Revision ID: 3202_inventory_lots
Revises: 3201_sorting_records
Create Date: 2026-10-25 08:01:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3202_inventory_lots'
down_revision: Union[str, None] = '3201_sorting_records'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inventory_lots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lot_code', sa.String(length=32), nullable=False),
        sa.Column('intake_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sorting_record_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('quantity_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('available_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('grade', sa.String(length=16), nullable=False),
        sa.Column('contamination_percent', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'),
        sa.Column('moisture_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='available'),
        sa.Column('hub_location', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['waste_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['intake_id'], ['waste_intakes.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sorting_record_id'], ['sorting_records.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_lots_category_id'), 'inventory_lots', ['category_id'], unique=False)
    op.create_index(op.f('ix_inventory_lots_intake_id'), 'inventory_lots', ['intake_id'], unique=False)
    op.create_index(op.f('ix_inventory_lots_lot_code'), 'inventory_lots', ['lot_code'], unique=True)
    op.create_index(op.f('ix_inventory_lots_status'), 'inventory_lots', ['status'], unique=False)

    # Recreate marketplace_listings and bids
    op.create_table(
        'marketplace_listings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('listing_code', sa.String(length=50), nullable=False),
        sa.Column('seller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inventory_lot_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('purity_grade', sa.String(length=12), nullable=False, server_default='GRADE_A'),
        sa.Column('listing_type', sa.String(length=15), nullable=False, server_default='FIXED_PRICE'),
        sa.Column('available_quantity_kg', sa.Float(), nullable=False),
        sa.Column('min_order_quantity_kg', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('unit_price_per_kg', sa.Float(), nullable=False),
        sa.Column('calculated_floor_price', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('estimated_co2_offset_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('auction_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['waste_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['inventory_lot_id'], ['inventory_lots.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('listing_code')
    )
    op.create_index('idx_listings_catalog_search', 'marketplace_listings', ['category_id', 'status', 'unit_price_per_kg'])
    op.create_index('idx_listings_seller', 'marketplace_listings', ['seller_id', 'status'])

    op.create_table(
        'bids',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('listing_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('buyer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('bid_price_per_kg', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('quantity_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('message', sa.String(length=500), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['listing_id'], ['marketplace_listings.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('bids')
    op.drop_table('marketplace_listings')
    op.drop_index(op.f('ix_inventory_lots_status'), table_name='inventory_lots')
    op.drop_index(op.f('ix_inventory_lots_lot_code'), table_name='inventory_lots')
    op.drop_index(op.f('ix_inventory_lots_intake_id'), table_name='inventory_lots')
    op.drop_index(op.f('ix_inventory_lots_category_id'), table_name='inventory_lots')
    op.drop_table('inventory_lots')
