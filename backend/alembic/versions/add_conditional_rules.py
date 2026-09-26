"""Add conditional_rules table

Revision ID: add_conditional_rules
Revises: add_version_status
Create Date: 2025-07-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_conditional_rules'
down_revision: Union[str, None] = 'add_version_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'conditional_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('forms.id'), nullable=False),
        sa.Column('trigger_field_id', sa.Integer(), sa.ForeignKey('fields.id'), nullable=False),
        sa.Column('operator', sa.String(50), nullable=False),
        sa.Column('compare_value', sa.String(255), nullable=True),
        sa.Column('target_field_id', sa.Integer(), sa.ForeignKey('fields.id'), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_conditional_rules_id'), 'conditional_rules', ['id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_conditional_rules_id'), table_name='conditional_rules')
    op.drop_table('conditional_rules')
