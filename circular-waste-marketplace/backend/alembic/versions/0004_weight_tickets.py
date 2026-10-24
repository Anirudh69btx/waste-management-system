"""create weight_tickets table

Revision ID: 0004_weight_tickets
Revises: 0003_pickup_requests
Create Date: 2026-10-20 12:01:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0004_weight_tickets'
down_revision: Union[str, None] = '0003_pickup_requests'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weight_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('intake_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pickup_request_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('weight_method', sa.String(length=32), nullable=False),
        sa.Column('gross_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('tare_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('net_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('scale_id', sa.String(length=64), nullable=True),
        sa.Column('scale_calibration_date', sa.Date(), nullable=True),
        sa.Column('photo_paths', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
        sa.Column('recorded_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('discrepancy_flag', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('discrepancy_notes', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('supplier_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('supplier_dispute_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "weight_method IN ('manual', 'demo', 'digital_scale', 'weighbridge')",
            name='ck_weight_tickets_method',
        ),
        sa.CheckConstraint('gross_weight_kg > 0', name='ck_weight_tickets_gross_positive'),
        sa.CheckConstraint('tare_weight_kg >= 0', name='ck_weight_tickets_tare_non_negative'),
        sa.CheckConstraint('net_weight_kg > 0', name='ck_weight_tickets_net_positive'),
        sa.CheckConstraint(
            'abs(net_weight_kg - (gross_weight_kg - tare_weight_kg)) < 0.001',
            name='ck_weight_tickets_net_calc',
        ),
        sa.ForeignKeyConstraint(['intake_id'], ['waste_intakes.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['pickup_request_id'], ['pickup_requests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_weight_tickets_intake_id', 'weight_tickets', ['intake_id'], unique=False)
    op.create_index(
        'idx_weight_tickets_recorded_at_desc',
        'weight_tickets',
        [sa.text('recorded_at DESC')],
        unique=False,
    )
    op.create_index('idx_weight_tickets_method', 'weight_tickets', ['weight_method'], unique=False)
    op.create_index(
        'idx_weight_tickets_intake_recorded',
        'weight_tickets',
        ['intake_id', sa.text('recorded_at DESC')],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('idx_weight_tickets_intake_recorded', table_name='weight_tickets')
    op.drop_index('idx_weight_tickets_method', table_name='weight_tickets')
    op.drop_index('idx_weight_tickets_recorded_at_desc', table_name='weight_tickets')
    op.drop_index('idx_weight_tickets_intake_id', table_name='weight_tickets')
    op.drop_table('weight_tickets')
