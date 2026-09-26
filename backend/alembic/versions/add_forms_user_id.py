"""Add user_id ownership column to forms table

Revision ID: add_forms_user_id
Revises: add_analytics_tracking
Create Date: 2026-08-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_forms_user_id'
down_revision: Union[str, None] = 'add_analytics_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Form ownership (Day 15 export security) ─────────────────────
    # Nullable so legacy forms (created before ownership tracking) keep
    # working — they remain exportable by any authenticated user.
    op.add_column('forms', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.create_index(op.f('ix_forms_user_id'), 'forms', ['user_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_forms_user_id'), table_name='forms')
    op.drop_column('forms', 'user_id')
