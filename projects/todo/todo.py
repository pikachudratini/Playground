"""A tiny command-line to-do tracker.

Usage:
    python todo.py add "Buy milk"
    python todo.py list
    python todo.py done 2
    python todo.py rm 2
    python todo.py clear
"""

import argparse
import json
import sys
from pathlib import Path

DATA_FILE = Path(__file__).with_name("todos.json")


def load_tasks():
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open() as f:
        return json.load(f)


def save_tasks(tasks):
    with DATA_FILE.open("w") as f:
        json.dump(tasks, f, indent=2)


def cmd_add(args):
    tasks = load_tasks()
    next_id = max((t["id"] for t in tasks), default=0) + 1
    tasks.append({"id": next_id, "text": args.text, "done": False})
    save_tasks(tasks)
    print(f"Added #{next_id}: {args.text}")


def cmd_list(args):
    tasks = load_tasks()
    if not tasks:
        print("No tasks yet. Add one with: python todo.py add \"...\"")
        return
    for t in tasks:
        mark = "x" if t["done"] else " "
        print(f"[{mark}] {t['id']:>3}  {t['text']}")


def cmd_done(args):
    tasks = load_tasks()
    for t in tasks:
        if t["id"] == args.id:
            t["done"] = True
            save_tasks(tasks)
            print(f"Marked #{args.id} done.")
            return
    print(f"No task with id {args.id}.", file=sys.stderr)
    sys.exit(1)


def cmd_rm(args):
    tasks = load_tasks()
    new_tasks = [t for t in tasks if t["id"] != args.id]
    if len(new_tasks) == len(tasks):
        print(f"No task with id {args.id}.", file=sys.stderr)
        sys.exit(1)
    save_tasks(new_tasks)
    print(f"Removed #{args.id}.")


def cmd_clear(args):
    save_tasks([])
    print("All tasks cleared.")


def build_parser():
    parser = argparse.ArgumentParser(description="Tiny to-do tracker.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Add a task")
    p_add.add_argument("text", help="Task description")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list", help="List all tasks")
    p_list.set_defaults(func=cmd_list)

    p_done = sub.add_parser("done", help="Mark a task done by id")
    p_done.add_argument("id", type=int)
    p_done.set_defaults(func=cmd_done)

    p_rm = sub.add_parser("rm", help="Remove a task by id")
    p_rm.add_argument("id", type=int)
    p_rm.set_defaults(func=cmd_rm)

    p_clear = sub.add_parser("clear", help="Delete all tasks")
    p_clear.set_defaults(func=cmd_clear)

    return parser


def main():
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
