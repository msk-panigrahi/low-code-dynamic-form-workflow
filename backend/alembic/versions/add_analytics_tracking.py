"""Add form_sessions table and analytics columns to submissions

Revision ID: add_analytics_tracking
Revises: add_users_table
Create Date: 2026-08-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_analytics_tracking'
down_revision: Union[str, None] = 'add_users_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Started-session tracking table (Day 14) ──────────────────────
    op.create_table(
        'form_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('forms.id'), nullable=False),
        sa.Column('session_id', sa.String(64), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_form_sessions_id'), 'form_sessions', ['id'])
    op.create_index(op.f('ix_form_sessions_session_id'), 'form_sessions', ['session_id'])

    # ── Submission timing columns for average completion time ────────
    op.add_column('submissions', sa.Column('started_at', sa.DateTime(), nullable=True))
    op.add_column('submissions', sa.Column('session_id', sa.String(64), nullable=True))
    op.create_index(op.f('ix_submissions_session_id'), 'submissions', ['session_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_submissions_session_id'), table_name='submissions')
    op.drop_column('submissions', 'session_id')
    op.drop_column('submissions', 'started_at')
    op.drop_index(op.f('ix_form_sessions_session_id'), table_name='form_sessions')
    op.drop_index(op.f('ix_form_sessions_id'), table_name='form_sessions')
    op.drop_table('form_sessions')
