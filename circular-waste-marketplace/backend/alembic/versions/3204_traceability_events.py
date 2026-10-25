"""add traceability_events

Revision ID: 3204_traceability_events
Revises: 3203_purchase_orders
Create Date: 2026-10-25 08:03:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3204_traceability_events'
down_revision: Union[str, None] = '3203_purchase_orders'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'traceability_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('from_status', sa.String(length=32), nullable=True),
        sa.Column('to_status', sa.String(length=32), nullable=True),
        sa.Column('actor_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('actor_role', sa.String(length=32), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('request_id', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['batch_id'], ['waste_intakes.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_traceability_events_batch_id'), 'traceability_events', ['batch_id'], unique=False)
    op.create_index(op.f('ix_traceability_events_created_at'), 'traceability_events', ['created_at'], unique=False)
    op.create_index(op.f('ix_traceability_events_event_type'), 'traceability_events', ['event_type'], unique=False)
    op.create_index('ix_traceability_batch_created', 'traceability_events', ['batch_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_traceability_batch_created', table_name='traceability_events')
    op.drop_index(op.f('ix_traceability_events_event_type'), table_name='traceability_events')
    op.drop_index(op.f('ix_traceability_events_created_at'), table_name='traceability_events')
    op.drop_index(op.f('ix_traceability_events_batch_id'), table_name='traceability_events')
    op.drop_table('traceability_events')
