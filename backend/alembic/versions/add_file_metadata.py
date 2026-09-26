"""Add file_metadata table for uploaded file tracking

Revision ID: add_file_metadata
Revises: add_submissions
Create Date: 2025-07-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_file_metadata'
down_revision: Union[str, None] = 'add_submissions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'file_metadata',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), sa.ForeignKey('submissions.id'), nullable=False),
        sa.Column('field_id', sa.Integer(), sa.ForeignKey('fields.id'), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('stored_filename', sa.String(255), nullable=False),
        sa.Column('content_type', sa.String(127), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('relative_path', sa.String(512), nullable=False),
        sa.Column('upload_timestamp', sa.DateTime(), nullable=False),
        sa.Column('download_token', sa.String(64), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_file_metadata_id'), 'file_metadata', ['id'])
    op.create_index(op.f('ix_file_metadata_stored_filename'), 'file_metadata', ['stored_filename'])
    op.create_index(op.f('ix_file_metadata_download_token'), 'file_metadata', ['download_token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_file_metadata_download_token'), table_name='file_metadata')
    op.drop_index(op.f('ix_file_metadata_stored_filename'), table_name='file_metadata')
    op.drop_index(op.f('ix_file_metadata_id'), table_name='file_metadata')
    op.drop_table('file_metadata')
