"""drop grades, remove max_attempts, add completed_lesson_ids

Revision ID: d9d7858cff74
Revises: 78037b9bf06b
Create Date: 2026-09-29 14:49:44.786846

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9d7858cff74'
down_revision: Union[str, None] = '78037b9bf06b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Удаляем таблицу grades, если она ещё существует
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'grades' in inspector.get_table_names():
        op.drop_table('grades')

    # 2. Удаляем колонку max_attempts из tests, если она ещё есть
    if 'max_attempts' in [c['name'] for c in inspector.get_columns('tests')]:
        op.drop_column('tests', 'max_attempts')

    # 3. Переименовываем completed_lessons → completed_lesson_ids
    enroll_cols = [c['name'] for c in inspector.get_columns('enrollments')]
    if 'completed_lessons' in enroll_cols and 'completed_lesson_ids' not in enroll_cols:
        op.alter_column(
            'enrollments',
            'completed_lessons',
            new_column_name='completed_lesson_ids',
        )
    elif 'completed_lesson_ids' not in enroll_cols:
        # Если обеих нет — создаём с server_default
        op.add_column(
            'enrollments',
            sa.Column(
                'completed_lesson_ids',
                sa.Text(),
                nullable=False,
                server_default='',
            ),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    enroll_cols = [c['name'] for c in inspector.get_columns('enrollments')]
    if 'completed_lesson_ids' in enroll_cols and 'completed_lessons' not in enroll_cols:
        op.alter_column(
            'enrollments',
            'completed_lesson_ids',
            new_column_name='completed_lessons',
        )

    tests_cols = [c['name'] for c in inspector.get_columns('tests')]
    if 'max_attempts' not in tests_cols:
        op.add_column(
            'tests',
            sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='0'),
        )

    if 'grades' not in inspector.get_table_names():
        op.create_table(
            'grades',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('course_id', sa.Integer(), nullable=False),
            sa.Column('value', sa.Float(), nullable=False),
            sa.Column('comment', sa.Text(), nullable=False, server_default=''),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )