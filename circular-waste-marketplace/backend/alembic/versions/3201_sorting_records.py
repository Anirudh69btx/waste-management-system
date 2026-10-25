"""add sorting_records

Revision ID: 3201_sorting_records
Revises: 820071da378d
Create Date: 2026-10-25 08:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3201_sorting_records'
down_revision: Union[str, None] = '820071da378d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sorting_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('intake_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sorter_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('input_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('sorted_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('rejected_weight_kg', sa.Numeric(precision=10, scale=3), nullable=False, server_default='0'),
        sa.Column('contamination_percent', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'),
        sa.Column('sort_grade', sa.String(length=16), nullable=False),
        sa.Column('moisture_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('notes', sa.String(length=1000), nullable=True),
        sa.Column('photos', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('request_id_correlation', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['intake_id'], ['waste_intakes.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sorter_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sorting_records_intake_id'), 'sorting_records', ['intake_id'], unique=False)
    op.create_index(op.f('ix_sorting_records_sorter_user_id'), 'sorting_records', ['sorter_user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sorting_records_sorter_user_id'), table_name='sorting_records')
    op.drop_index(op.f('ix_sorting_records_intake_id'), table_name='sorting_records')
    op.drop_table('sorting_records')
