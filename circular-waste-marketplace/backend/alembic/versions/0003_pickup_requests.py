"""create pickup_requests table

Revision ID: 0003_pickup_requests
Revises: 0002_auth_refresh_tokens
Create Date: 2026-10-20 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003_pickup_requests'
down_revision: Union[str, None] = '0002_auth_refresh_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pickup_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('intake_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_driver_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_pickup_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), server_default='requested', nullable=False),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('request_id_correlation', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "status IN ('requested', 'accepted', 'en_route', 'arrived', 'picked_up', 'completed', 'cancelled', 'failed')",
            name='ck_pickup_requests_status',
        ),
        sa.ForeignKeyConstraint(['assigned_driver_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['intake_id'], ['waste_intakes.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_pickup_requests_intake_id', 'pickup_requests', ['intake_id'], unique=True)
    op.create_index('idx_pickup_requests_driver', 'pickup_requests', ['assigned_driver_user_id'], unique=False)
    op.create_index('idx_pickup_requests_status', 'pickup_requests', ['status'], unique=False)
    op.create_index('idx_pickup_requests_sched_start', 'pickup_requests', ['scheduled_start'], unique=False)
    op.create_index(
        'idx_pickup_requests_driver_status_start',
        'pickup_requests',
        ['assigned_driver_user_id', 'status', 'scheduled_start'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('idx_pickup_requests_driver_status_start', table_name='pickup_requests')
    op.drop_index('idx_pickup_requests_sched_start', table_name='pickup_requests')
    op.drop_index('idx_pickup_requests_status', table_name='pickup_requests')
    op.drop_index('idx_pickup_requests_driver', table_name='pickup_requests')
    op.drop_index('idx_pickup_requests_intake_id', table_name='pickup_requests')
    op.drop_table('pickup_requests')
