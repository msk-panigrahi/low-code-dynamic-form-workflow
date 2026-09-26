"""Add submissions and response_values tables

Revision ID: add_submissions
Revises: add_conditional_rules
Create Date: 2025-07-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_submissions'
down_revision: Union[str, None] = 'add_conditional_rules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('forms.id'), nullable=False),
        sa.Column('form_version_id', sa.Integer(), sa.ForeignKey('form_versions.id'), nullable=False),
        sa.Column('link_token', sa.String(64), nullable=False),
        sa.Column('response_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_submissions_id'), 'submissions', ['id'])
    op.create_index(op.f('ix_submissions_response_id'), 'submissions', ['response_id'], unique=True)

    op.create_table(
        'response_values',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), sa.ForeignKey('submissions.id'), nullable=False),
        sa.Column('field_id', sa.Integer(), sa.ForeignKey('fields.id'), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_response_values_id'), 'response_values', ['id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_response_values_id'), table_name='response_values')
    op.drop_table('response_values')
    op.drop_index(op.f('ix_submissions_response_id'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_id'), table_name='submissions')
    op.drop_table('submissions')
