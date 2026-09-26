"""Merge add_file_metadata and add_retention_audit branches

Revision ID: 79549c691f1d
Revises: add_file_metadata, add_retention_audit
Create Date: 2026-09-26 19:37:49.945581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79549c691f1d'
down_revision: Union[str, Sequence[str], None] = ('add_file_metadata', 'add_retention_audit')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
