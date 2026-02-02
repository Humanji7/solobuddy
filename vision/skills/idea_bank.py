"""
Idea Bank CLI — manage content ideas for Build in Public.

Usage:
    uv run python -m vision.skills.idea_bank add "My idea here"
    uv run python -m vision.skills.idea_bank list [--status new|used|archived]
    uv run python -m vision.skills.idea_bank get <id>
    uv run python -m vision.skills.idea_bank use <id>
    uv run python -m vision.skills.idea_bank archive <id>
    uv run python -m vision.skills.idea_bank delete <id>
    uv run python -m vision.skills.idea_bank search "keyword"
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from vision.data.database import Database

DB_PATH = Path(__file__).parent.parent.parent / "data" / "bip.db"


async def add_idea(db: Database, content: str, source: str = "manual", tags: list[str] | None = None) -> int:
    """Add new idea to the bank."""
    tags_json = json.dumps(tags) if tags else None
    idea_id = await db.insert("ideas", {
        "content": content,
        "source": source,
        "tags": tags_json,
    })
    return idea_id


async def list_ideas(db: Database, status: str | None = None, limit: int = 20) -> list[dict]:
    """List ideas with optional status filter."""
    if status:
        return await db.fetch_all(
            "SELECT id, content, status, source, created_at FROM ideas "
            "WHERE deleted_at IS NULL AND status = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (status, limit),
        )
    return await db.fetch_all(
        "SELECT id, content, status, source, created_at FROM ideas "
        "WHERE deleted_at IS NULL "
        "ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )


async def get_idea(db: Database, idea_id: int) -> dict | None:
    """Get single idea by ID."""
    return await db.fetch_one(
        "SELECT * FROM ideas WHERE id = ? AND deleted_at IS NULL",
        (idea_id,),
    )


async def update_status(db: Database, idea_id: int, status: str) -> bool:
    """Update idea status."""
    cursor = await db.execute(
        "UPDATE ideas SET status = ?, updated_at = datetime('now') "
        "WHERE id = ? AND deleted_at IS NULL",
        (status, idea_id),
    )
    return cursor.rowcount > 0


async def delete_idea(db: Database, idea_id: int) -> bool:
    """Soft delete idea."""
    cursor = await db.execute(
        "UPDATE ideas SET deleted_at = datetime('now') WHERE id = ?",
        (idea_id,),
    )
    return cursor.rowcount > 0


async def search_ideas(db: Database, query: str, limit: int = 10) -> list[dict]:
    """Search ideas by content."""
    return await db.fetch_all(
        "SELECT id, content, status, source, created_at FROM ideas "
        "WHERE deleted_at IS NULL AND content LIKE ? "
        "ORDER BY created_at DESC LIMIT ?",
        (f"%{query}%", limit),
    )


async def main():
    parser = argparse.ArgumentParser(description="Idea Bank CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # add
    add_parser = subparsers.add_parser("add", help="Add new idea")
    add_parser.add_argument("content", help="Idea content")
    add_parser.add_argument("--source", choices=["voice", "screenshot", "manual", "generated"], default="manual")
    add_parser.add_argument("--tags", nargs="*", help="Tags for the idea")

    # list
    list_parser = subparsers.add_parser("list", help="List ideas")
    list_parser.add_argument("--status", choices=["new", "used", "archived"])
    list_parser.add_argument("--limit", type=int, default=20)

    # get
    get_parser = subparsers.add_parser("get", help="Get idea by ID")
    get_parser.add_argument("id", type=int)

    # use
    use_parser = subparsers.add_parser("use", help="Mark idea as used")
    use_parser.add_argument("id", type=int)

    # archive
    archive_parser = subparsers.add_parser("archive", help="Archive idea")
    archive_parser.add_argument("id", type=int)

    # delete
    delete_parser = subparsers.add_parser("delete", help="Delete idea")
    delete_parser.add_argument("id", type=int)

    # search
    search_parser = subparsers.add_parser("search", help="Search ideas")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--limit", type=int, default=10)

    args = parser.parse_args()

    db = Database(DB_PATH)
    await db.connect()

    try:
        if args.command == "add":
            idea_id = await add_idea(db, args.content, args.source, args.tags)
            print(json.dumps({"id": idea_id, "status": "created"}))

        elif args.command == "list":
            ideas = await list_ideas(db, args.status, args.limit)
            print(json.dumps(ideas, ensure_ascii=False, indent=2))

        elif args.command == "get":
            idea = await get_idea(db, args.id)
            if idea:
                print(json.dumps(idea, ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"error": "not_found"}))
                sys.exit(1)

        elif args.command == "use":
            if await update_status(db, args.id, "used"):
                print(json.dumps({"id": args.id, "status": "used"}))
            else:
                print(json.dumps({"error": "not_found"}))
                sys.exit(1)

        elif args.command == "archive":
            if await update_status(db, args.id, "archived"):
                print(json.dumps({"id": args.id, "status": "archived"}))
            else:
                print(json.dumps({"error": "not_found"}))
                sys.exit(1)

        elif args.command == "delete":
            if await delete_idea(db, args.id):
                print(json.dumps({"id": args.id, "status": "deleted"}))
            else:
                print(json.dumps({"error": "not_found"}))
                sys.exit(1)

        elif args.command == "search":
            ideas = await search_ideas(db, args.query, args.limit)
            print(json.dumps(ideas, ensure_ascii=False, indent=2))

    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
