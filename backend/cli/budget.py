"""Command-line utility for managing EpoClaim's persistent Tavily credit budget."""
import argparse
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.integrations.tavily_ledger import tavily_ledger


def main():
    parser = argparse.ArgumentParser(description="EpoClaim Tavily Budget CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Status command
    subparsers.add_parser("status", help="Show current budget cap, usage, and availability")

    # Increase command
    inc_parser = subparsers.add_parser("increase", help="Manually bump budget cap with audit log")
    inc_parser.add_argument("--new-cap", type=int, required=True, help="New budget cap (e.g. 600, 700)")
    inc_parser.add_argument("--reason", type=str, required=True, help="Justification for budget change")

    # Audit command
    subparsers.add_parser("audit", help="Show budget audit log")

    args = parser.parse_args()

    if args.command == "status" or not args.command:
        status = tavily_ledger.get_ledger_status()
        print("\n=== EpoClaim Tavily Budget Ledger Status ===")
        print(f"Budget Cap:        {status['budget_cap']} credits")
        print(f"Consumed Credits:  {status['consumed_credits']} credits")
        print(f"Reserved Credits:  {status['reserved_credits']} credits")
        print(f"Available Budget:  {status['available_credits']} credits")
        print("===========================================\n")

    elif args.command == "increase":
        success, message = tavily_ledger.manual_increase_budget(args.new_cap, args.reason)
        if success:
            print(f"\n[SUCCESS] {message}\n")
        else:
            print(f"\n[ERROR] {message}\n")
            sys.exit(1)

    elif args.command == "audit":
        logs = tavily_ledger.get_audit_logs()
        print("\n=== Tavily Budget Audit Log ===")
        for entry in logs:
            print(f"[{entry['created_at']}] {entry['previous_cap']} -> {entry['new_cap']} | Reason: {entry['change_reason']}")
        print("===============================\n")


if __name__ == "__main__":
    main()

