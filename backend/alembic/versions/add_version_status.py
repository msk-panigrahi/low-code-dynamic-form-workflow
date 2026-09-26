"""Add status and published_at to form_versions

Revision ID: add_version_status
Revises: 
Create Date: 2025-07-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_version_status'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status column with default 'draft'
    op.add_column('form_versions', sa.Column('status', sa.String(20), nullable=False, server_default='draft'))
    # Add published_at column
    op.add_column('form_versions', sa.Column('published_at', sa.DateTime(), nullable=True))
    # Migrate existing data: is_published=1 -> status='published', is_published=0 -> status='draft'
    op.execute("UPDATE form_versions SET status = 'published' WHERE is_published = 1")
    op.execute("UPDATE form_versions SET status = 'draft' WHERE is_published = 0 OR is_published IS NULL")
    # Drop old column
    op.drop_column('form_versions', 'is_published')


def downgrade() -> None:
    # Add back is_published column
    op.add_column('form_versions', sa.Column('is_published', sa.Integer(), nullable=False, server_default='0'))
    # Migrate data back
    op.execute("UPDATE form_versions SET is_published = 1 WHERE status = 'published'")
    op.execute("UPDATE form_versions SET is_published = 0 WHERE status = 'draft' OR status = 'archived'")
    # Drop new columns
    op.drop_column('form_versions', 'published_at')
    op.drop_column('form_versions', 'status')
