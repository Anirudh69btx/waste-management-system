"""add intake metadata

Revision ID: 3205_intake_metadata
Revises: 3204_traceability_events
Create Date: 2026-10-25 08:04:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3205_intake_metadata'
down_revision: Union[str, None] = '3204_traceability_events'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'waste_intakes',
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )
    op.execute("UPDATE waste_intakes SET metadata = '{}' WHERE metadata IS NULL")


def downgrade() -> None:
    op.drop_column('waste_intakes', 'metadata')
