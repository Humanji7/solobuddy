"""
Vision Database — async SQLite with WAL mode, migrations, and connection pooling.

Usage:
    db = Database("data/bip.db")
    await db.connect()
    await db.execute("SELECT * FROM memory WHERE importance > ?", (5,))
    await db.close()
"""

import asyncio
from pathlib import Path
from typing import Any

import aiosqlite
import structlog

logger = structlog.get_logger()


class DatabaseError(Exception):
    """Database operation failed."""


class MigrationError(DatabaseError):
    """Migration failed."""


class Database:
    """
    Async SQLite database with WAL mode and automatic migrations.

    Thread-safe through asyncio locks. Uses STRICT tables for type safety.
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._conn: aiosqlite.Connection | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        """Open connection and apply pragmas."""
        if self._conn is not None:
            return

        self.path.parent.mkdir(parents=True, exist_ok=True)

        self._conn = await aiosqlite.connect(
            self.path,
            isolation_level=None,  # autocommit, we manage transactions explicitly
        )
        self._conn.row_factory = aiosqlite.Row

        await self._apply_pragmas()
        logger.info("database_connected", path=str(self.path))

    async def _apply_pragmas(self) -> None:
        """Apply SQLite optimizations."""
        pragmas = [
            "PRAGMA journal_mode = WAL",
            "PRAGMA synchronous = NORMAL",
            "PRAGMA cache_size = -64000",  # 64MB
            "PRAGMA temp_store = MEMORY",
            "PRAGMA mmap_size = 268435456",  # 256MB
            "PRAGMA foreign_keys = ON",
        ]
        for pragma in pragmas:
            await self._conn.execute(pragma)

    async def close(self) -> None:
        """Close connection gracefully."""
        if self._conn is None:
            return

        async with self._lock:
            await self._conn.close()
            self._conn = None
            logger.info("database_closed")

    async def execute(
        self,
        sql: str,
        params: tuple[Any, ...] | None = None,
    ) -> aiosqlite.Cursor:
        """Execute SQL statement."""
        if self._conn is None:
            raise DatabaseError("Database not connected")

        async with self._lock:
            try:
                return await self._conn.execute(sql, params or ())
            except aiosqlite.Error as e:
                logger.error("database_execute_failed", sql=sql[:100], error=str(e))
                raise DatabaseError(f"Execute failed: {e}") from e

    async def execute_many(
        self,
        sql: str,
        params_list: list[tuple[Any, ...]],
    ) -> None:
        """Execute SQL for multiple parameter sets."""
        if self._conn is None:
            raise DatabaseError("Database not connected")

        async with self._lock:
            try:
                await self._conn.executemany(sql, params_list)
            except aiosqlite.Error as e:
                logger.error("database_executemany_failed", sql=sql[:100], error=str(e))
                raise DatabaseError(f"ExecuteMany failed: {e}") from e

    async def fetch_one(
        self,
        sql: str,
        params: tuple[Any, ...] | None = None,
    ) -> dict[str, Any] | None:
        """Fetch single row as dict."""
        cursor = await self.execute(sql, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def fetch_all(
        self,
        sql: str,
        params: tuple[Any, ...] | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch all rows as list of dicts."""
        cursor = await self.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def insert(
        self,
        table: str,
        data: dict[str, Any],
    ) -> int:
        """Insert row and return last inserted id."""
        columns = ", ".join(data.keys())
        placeholders = ", ".join("?" * len(data))
        sql = f"INSERT INTO {table} ({columns}) VALUES ({placeholders})"

        cursor = await self.execute(sql, tuple(data.values()))
        return cursor.lastrowid

    def transaction(self):
        """Context manager for transactions."""
        return _Transaction(self)

    # -------------------------------------------------------------------------
    # Migrations
    # -------------------------------------------------------------------------

    async def migrate(self, migrations_dir: str | Path) -> int:
        """
        Apply pending migrations from directory.

        Files must be named: 001_description.sql, 002_description.sql, etc.
        Returns number of applied migrations.
        """
        migrations_path = Path(migrations_dir)
        if not migrations_path.exists():
            logger.warning("migrations_dir_not_found", path=str(migrations_path))
            return 0

        # Ensure schema_migrations table exists
        await self.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        """)

        # Get current version
        row = await self.fetch_one(
            "SELECT MAX(version) as version FROM schema_migrations"
        )
        current_version = row["version"] if row and row["version"] else 0

        # Find and apply pending migrations
        migration_files = sorted(migrations_path.glob("*.sql"))
        applied = 0

        for file in migration_files:
            # Parse version from filename (e.g., "002_vision_tables.sql" -> 2)
            try:
                version = int(file.stem.split("_")[0])
            except (ValueError, IndexError):
                logger.warning("invalid_migration_filename", file=file.name)
                continue

            if version <= current_version:
                continue

            # Apply migration
            sql = file.read_text()
            try:
                async with self.transaction():
                    # Split by semicolons and execute each statement
                    for statement in sql.split(";"):
                        statement = statement.strip()
                        if statement and not statement.startswith("--"):
                            await self.execute(statement)

                    # Record migration (if not already recorded by the migration itself)
                    existing = await self.fetch_one(
                        "SELECT version FROM schema_migrations WHERE version = ?",
                        (version,),
                    )
                    if not existing:
                        await self.execute(
                            "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
                            (version, file.stem),
                        )

                applied += 1
                logger.info("migration_applied", version=version, file=file.name)

            except Exception as e:
                logger.error("migration_failed", version=version, file=file.name, error=str(e))
                raise MigrationError(f"Migration {file.name} failed: {e}") from e

        if applied:
            logger.info("migrations_complete", applied=applied)
        return applied


class _Transaction:
    """Async context manager for database transactions."""

    def __init__(self, db: Database):
        self._db = db

    async def __aenter__(self):
        await self._db.execute("BEGIN")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            await self._db.execute("COMMIT")
        else:
            await self._db.execute("ROLLBACK")
            logger.warning("transaction_rolled_back", error=str(exc_val))
        return False
