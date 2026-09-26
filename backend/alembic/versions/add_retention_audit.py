"""Add retention policies, audit logs and archive job tracking (Day 19)

Revision ID: add_retention_audit
Revises: add_forms_user_id
Create Date: 2026-08-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_retention_audit'
down_revision: Union[str, None] = 'add_forms_user_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Submission archival timestamp (data preserved, never deleted) ──
    op.add_column('submissions', sa.Column('archived_at', sa.DateTime(), nullable=True))

    # ── Per-form retention policies (Day 19) ───────────────────────────
    op.create_table(
        'retention_policies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('forms.id'), nullable=False),
        sa.Column('retention_days', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(20), nullable=False, server_default='archive'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_retention_policies_id'), 'retention_policies', ['id'])
    op.create_index(op.f('ix_retention_policies_form_id'), 'retention_policies', ['form_id'], unique=True)

    # ── Append-only audit trail (Day 19) ──────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('actor_type', sa.String(20), nullable=False, server_default='user'),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('form_id', sa.Integer(), sa.ForeignKey('forms.id'), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('records_affected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'])
    op.create_index(op.f('ix_audit_logs_form_id'), 'audit_logs', ['form_id'])

    # ── Scheduler run tracking (Day 19) ───────────────────────────────
    op.create_table(
        'archive_job_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('archived_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('policies_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='running'),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_archive_job_runs_id'), 'archive_job_runs', ['id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_archive_job_runs_id'), table_name='archive_job_runs')
    op.drop_table('archive_job_runs')
    op.drop_index(op.f('ix_audit_logs_form_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_retention_policies_form_id'), table_name='retention_policies')
    op.drop_index(op.f('ix_retention_policies_id'), table_name='retention_policies')
    op.drop_table('retention_policies')
    op.drop_column('submissions', 'archived_at')
