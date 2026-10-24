"""extend intake status check constraint

Revision ID: 0005_intake_status_extend
Revises: 0004_weight_tickets
Create Date: 2026-10-20 12:02:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0005_intake_status_extend'
down_revision: Union[str, None] = '0004_weight_tickets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALLOWED_STATUSES = (
    "'submitted', 'pickup_requested', 'pickup_assigned', 'picked_up', 'weighed', "
    "'in_sorting', 'sorted', 'listed', 'sold', 'cancelled', 'rejected'"
)


def upgrade() -> None:
    # 1. Normalize any existing rows before applying constraint
    op.execute("UPDATE waste_intakes SET status = lower(status) WHERE status != lower(status);")
    op.execute("UPDATE waste_intakes SET status = 'weighed' WHERE status IN ('verified', 'flagged_discrepancy');")
    op.execute(
        f"UPDATE waste_intakes SET status = 'submitted' WHERE status NOT IN ({ALLOWED_STATUSES});"
    )

    # 2. Expand column size to 32
    op.alter_column(
        'waste_intakes',
        'status',
        type_=sa.String(length=32),
        existing_type=sa.String(length=19),
        existing_nullable=False,
    )

    # 3. Add CHECK constraint
    op.create_check_constraint(
        'ck_waste_intakes_status',
        'waste_intakes',
        f"status IN ({ALLOWED_STATUSES})",
    )


def downgrade() -> None:
    op.drop_constraint('ck_waste_intakes_status', 'waste_intakes', type_='check')
    op.alter_column(
        'waste_intakes',
        'status',
        type_=sa.String(length=19),
        existing_type=sa.String(length=32),
        existing_nullable=False,
    )
