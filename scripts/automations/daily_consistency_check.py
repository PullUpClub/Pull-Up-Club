"""
Pull-Up Club Daily Consistency Check

Runs daily to catch any earnings/payout issues that slip through DB triggers.
This is a SAFETY NET - triggers should handle most cases, this catches edge cases.

Usage:
    python daily_consistency_check.py

Environment variables required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key (not anon key)

Optional:
    ALERT_EMAIL - Email to send alerts to (requires Resend setup)
    DRY_RUN - Set to "true" to only report issues without fixing
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Optional
import json

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://yqnikgupiaghgjtsaypr.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"


def get_client() -> Client:
    """Create Supabase client with service role key."""
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def check_missing_earnings(supabase: Client) -> list:
    """Find approved submissions without weekly_earnings records."""

    # Get approved submissions from the last 60 days without earnings
    result = supabase.rpc("get_submissions_missing_earnings").execute()

    if result.data:
        return result.data
    return []


def check_payout_mismatches(supabase: Client) -> list:
    """Find payout_requests with incorrect amounts."""

    result = supabase.rpc("get_payout_mismatches").execute()

    if result.data:
        return result.data
    return []


def check_pool_balance_issues(supabase: Client) -> list:
    """Find weekly_pools where remaining doesn't match actual earnings."""

    result = supabase.rpc("get_pool_balance_issues").execute()

    if result.data:
        return result.data
    return []


def fix_missing_earnings(supabase: Client, submissions: list) -> dict:
    """Reprocess submissions that are missing earnings."""

    fixed = 0
    failed = 0

    for sub in submissions:
        try:
            result = supabase.rpc("process_submission_earnings", {
                "p_submission_id": sub["submission_id"],
                "p_user_id": sub["user_id"],
                "p_pull_up_count": sub["actual_pull_up_count"]
            }).execute()

            if result.data and result.data.get("success"):
                fixed += 1
                print(f"  ✓ Fixed: {sub['full_name']} - ${result.data.get('dollars_earned', 0)}")
            else:
                failed += 1
                print(f"  ✗ Failed: {sub['full_name']} - {result.data}")

        except Exception as e:
            failed += 1
            print(f"  ✗ Error: {sub['full_name']} - {e}")

    return {"fixed": fixed, "failed": failed}


def fix_payout_mismatches(supabase: Client, mismatches: list) -> dict:
    """Update payout_requests with correct amounts."""

    fixed = 0
    failed = 0

    for m in mismatches:
        try:
            supabase.table("payout_requests").update({
                "amount_dollars": m["correct_amount"],
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", m["payout_id"]).execute()

            fixed += 1
            print(f"  ✓ Fixed: {m['full_name']} ${m['current_amount']} → ${m['correct_amount']}")

        except Exception as e:
            failed += 1
            print(f"  ✗ Error: {m['full_name']} - {e}")

    return {"fixed": fixed, "failed": failed}


def log_check_result(supabase: Client, issues_found: int, issues_fixed: int, details: dict):
    """Log the check result to monitoring table."""

    try:
        supabase.from_("monitoring.system_errors").insert({
            "error_type": "DAILY_CONSISTENCY_CHECK",
            "error_message": f"Found {issues_found} issues, fixed {issues_fixed}",
            "context": json.dumps(details)
        }).execute()
    except Exception as e:
        print(f"Warning: Could not log to monitoring table: {e}")


def main():
    print("=" * 60)
    print("Pull-Up Club Daily Consistency Check")
    print(f"Time: {datetime.utcnow().isoformat()}Z")
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print("=" * 60)

    supabase = get_client()

    total_issues = 0
    total_fixed = 0
    details = {}

    # Check 1: Missing earnings
    print("\n[1/3] Checking for approved submissions without earnings...")
    try:
        missing = check_missing_earnings(supabase)
        if missing:
            print(f"  Found {len(missing)} submissions missing earnings")
            total_issues += len(missing)
            details["missing_earnings"] = len(missing)

            if not DRY_RUN:
                result = fix_missing_earnings(supabase, missing)
                total_fixed += result["fixed"]
                details["earnings_fixed"] = result["fixed"]
        else:
            print("  ✓ No issues found")
    except Exception as e:
        print(f"  ✗ Check failed: {e}")
        details["missing_earnings_error"] = str(e)

    # Check 2: Payout mismatches
    print("\n[2/3] Checking for payout amount mismatches...")
    try:
        mismatches = check_payout_mismatches(supabase)
        if mismatches:
            print(f"  Found {len(mismatches)} payout mismatches")
            total_issues += len(mismatches)
            details["payout_mismatches"] = len(mismatches)

            if not DRY_RUN:
                result = fix_payout_mismatches(supabase, mismatches)
                total_fixed += result["fixed"]
                details["payouts_fixed"] = result["fixed"]
        else:
            print("  ✓ No issues found")
    except Exception as e:
        print(f"  ✗ Check failed: {e}")
        details["payout_mismatch_error"] = str(e)

    # Check 3: Pool balance issues
    print("\n[3/3] Checking for pool balance discrepancies...")
    try:
        pool_issues = check_pool_balance_issues(supabase)
        if pool_issues:
            print(f"  Found {len(pool_issues)} pool balance issues")
            for p in pool_issues:
                print(f"    - {p['week_start']} to {p['week_end']}: "
                      f"shows ${p['remaining']} but should be ${p['calculated']}")
            total_issues += len(pool_issues)
            details["pool_issues"] = len(pool_issues)
        else:
            print("  ✓ No issues found")
    except Exception as e:
        print(f"  ✗ Check failed: {e}")
        details["pool_balance_error"] = str(e)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total issues found: {total_issues}")
    print(f"Total issues fixed: {total_fixed}")

    if total_issues > 0 and not DRY_RUN:
        log_check_result(supabase, total_issues, total_fixed, details)

    if total_issues > 0:
        print("\n⚠️  Issues were found. Review the output above.")
        return 1
    else:
        print("\n✅ All checks passed!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
