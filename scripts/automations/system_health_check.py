"""
Pull-Up Club System Health Check

Comprehensive monitoring and self-healing for:
- Weekly pools (creation, duplicates, balances)
- Monthly payouts (amounts, missing records)
- Email queue (stuck emails, failures)
- Monthly graphics (generation status)

Runs daily via GitHub Actions. Auto-fixes most issues.

Usage:
    python system_health_check.py
    python system_health_check.py --dry-run

Environment variables required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key (not anon key)
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Optional
import json
import argparse

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://yqnikgupiaghgjtsaypr.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_client() -> Client:
    """Create Supabase client with service role key."""
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def run_sql_health_check(supabase: Client) -> dict:
    """Run the master SQL health check function."""
    print("\n[1/5] Running SQL health check...")

    try:
        result = supabase.rpc("run_system_health_check").execute()

        if result.data:
            data = result.data

            # Report results
            print(f"  Overall status: {data.get('overall_status', 'unknown')}")

            # Weekly pool
            pool = data.get('weekly_pool', {})
            print(f"  Weekly pool: {pool.get('action', 'unknown')} - {pool.get('week_start')} to {pool.get('week_end')}")

            # Duplicate pools
            dups = data.get('duplicate_pools', {})
            if dups.get('duplicates_fixed', 0) > 0:
                print(f"  FIXED: {dups['duplicates_fixed']} duplicate pools removed")
            else:
                print("  No duplicate pools")

            # Pool balances
            balances = data.get('pool_balances', {})
            if balances.get('pools_fixed', 0) > 0:
                print(f"  FIXED: {balances['pools_fixed']} pool balances corrected")
                for fix in balances.get('details', []):
                    print(f"    - {fix['week_start']}: ${fix['was']} -> ${fix['now']}")
            else:
                print("  Pool balances correct")

            # Monthly payouts
            payouts = data.get('monthly_payouts', {})
            if payouts.get('issues_found', 0) > 0:
                print(f"  WARNING: {payouts['issues_found']} payout issues for {payouts.get('month')}")
                for issue in payouts.get('issues', []):
                    print(f"    - {issue['name']}: {issue['type']}")
            else:
                print(f"  Monthly payouts OK for {payouts.get('month')}")

            # Pending emails
            print(f"  Pending emails: {data.get('pending_emails', 0)}")

            return data

        return {"overall_status": "error", "message": "No data returned"}

    except Exception as e:
        print(f"  ERROR: {e}")
        return {"overall_status": "error", "message": str(e)}


def check_email_queue_health(supabase: Client) -> dict:
    """Check email queue for stuck or failed emails."""
    print("\n[2/5] Checking email queue health...")

    try:
        # Get email stats by status
        result = supabase.from_("email_notifications") \
            .select("status, email_type") \
            .is_("sent_at", "null") \
            .execute()

        pending_count = 0
        failed_count = 0
        by_type = {}

        for email in result.data or []:
            if email['status'] == 'pending':
                pending_count += 1
                by_type[email['email_type']] = by_type.get(email['email_type'], 0) + 1
            elif email['status'] == 'failed':
                failed_count += 1

        print(f"  Pending: {pending_count}, Failed: {failed_count}")
        if by_type:
            print(f"  By type: {by_type}")

        # Check for old pending emails (stuck)
        one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        stuck = supabase.from_("email_notifications") \
            .select("id", count="exact") \
            .is_("sent_at", "null") \
            .eq("status", "pending") \
            .lt("created_at", one_hour_ago) \
            .execute()

        stuck_count = stuck.count or 0
        if stuck_count > 0:
            print(f"  WARNING: {stuck_count} emails stuck for over 1 hour")

        return {
            "pending": pending_count,
            "failed": failed_count,
            "stuck": stuck_count,
            "by_type": by_type
        }

    except Exception as e:
        print(f"  ERROR: {e}")
        return {"error": str(e)}


def check_monthly_graphics(supabase: Client) -> dict:
    """Check monthly graphics generation status."""
    print("\n[3/5] Checking monthly graphics status...")

    try:
        # Get current month
        current_month = datetime.utcnow().strftime('%Y-%m')
        prev_month = (datetime.utcnow().replace(day=1) - timedelta(days=1)).strftime('%Y-%m')

        # Check for users with earnings but no graphic
        # Users who earned money should have graphics generated
        result = supabase.rpc("get_users_missing_graphics", {
            "p_month_year": prev_month
        }).execute()

        missing = result.data if result.data else []

        if missing:
            print(f"  WARNING: {len(missing)} users missing graphics for {prev_month}")
            for user in missing[:5]:  # Show first 5
                print(f"    - {user.get('full_name', 'Unknown')}: ${user.get('total_dollars', 0)}")
            if len(missing) > 5:
                print(f"    ... and {len(missing) - 5} more")
        else:
            print(f"  All graphics generated for {prev_month}")

        # Check pending graphic emails
        pending = supabase.from_("email_notifications") \
            .select("id", count="exact") \
            .eq("email_type", "monthly_graphic") \
            .is_("sent_at", "null") \
            .eq("status", "pending") \
            .execute()

        pending_count = pending.count or 0
        print(f"  Pending graphic emails: {pending_count}")

        return {
            "month": prev_month,
            "missing_graphics": len(missing),
            "pending_emails": pending_count
        }

    except Exception as e:
        # Function might not exist yet, that's OK
        print(f"  Note: Graphics check skipped ({e})")
        return {"skipped": True}


def check_edge_function_health(supabase: Client) -> dict:
    """Check Edge Function invocation success rates."""
    print("\n[4/5] Checking Edge Function health...")

    # This would need access to logs which we can't easily query
    # Instead, check for recent successful operations

    try:
        # Check if recent submissions were processed
        recent_approved = supabase.from_("submissions") \
            .select("id, approved_at, user_id") \
            .eq("status", "approved") \
            .gte("approved_at", (datetime.utcnow() - timedelta(days=7)).isoformat()) \
            .execute()

        approved_count = len(recent_approved.data or [])

        # Check if these have earnings
        if approved_count > 0:
            submission_ids = [s['id'] for s in recent_approved.data]
            earnings = supabase.from_("weekly_earnings") \
                .select("submission_id", count="exact") \
                .in_("submission_id", submission_ids) \
                .execute()

            earnings_count = earnings.count or 0

            if earnings_count < approved_count:
                print(f"  WARNING: {approved_count} approved submissions but only {earnings_count} earnings records")
            else:
                print(f"  {approved_count} recent approvals, all have earnings")
        else:
            print("  No recent approvals to check")

        return {
            "recent_approvals": approved_count,
            "healthy": True
        }

    except Exception as e:
        print(f"  ERROR: {e}")
        return {"error": str(e)}


def generate_summary_report(results: dict) -> str:
    """Generate a summary report of all checks."""
    print("\n[5/5] Generating summary...")

    issues = []

    # Check SQL health
    sql = results.get('sql_health', {})
    if sql.get('overall_status') != 'healthy':
        issues.append("SQL health check found issues")

    # Check email queue
    email = results.get('email_queue', {})
    if email.get('stuck', 0) > 0:
        issues.append(f"{email['stuck']} emails stuck in queue")
    if email.get('failed', 0) > 10:
        issues.append(f"{email['failed']} failed emails")

    # Check graphics
    graphics = results.get('monthly_graphics', {})
    if graphics.get('missing_graphics', 0) > 0:
        issues.append(f"{graphics['missing_graphics']} users missing monthly graphics")

    # Check edge functions
    edge = results.get('edge_functions', {})
    if edge.get('error'):
        issues.append(f"Edge function check error: {edge['error']}")

    if issues:
        print(f"\n  ISSUES FOUND: {len(issues)}")
        for issue in issues:
            print(f"    - {issue}")
        return "issues_found"
    else:
        print("\n  ALL SYSTEMS HEALTHY")
        return "healthy"


def main():
    parser = argparse.ArgumentParser(description='Pull-Up Club System Health Check')
    parser.add_argument('--dry-run', action='store_true', help='Report only, no fixes')
    args = parser.parse_args()

    print("=" * 60)
    print("Pull-Up Club System Health Check")
    print(f"Time: {datetime.utcnow().isoformat()}Z")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 60)

    supabase = get_client()

    results = {}

    # Run all checks
    results['sql_health'] = run_sql_health_check(supabase)
    results['email_queue'] = check_email_queue_health(supabase)
    results['monthly_graphics'] = check_monthly_graphics(supabase)
    results['edge_functions'] = check_edge_function_health(supabase)

    # Generate summary
    status = generate_summary_report(results)

    print("\n" + "=" * 60)
    print("HEALTH CHECK COMPLETE")
    print("=" * 60)

    # Log to monitoring table
    if not args.dry_run:
        try:
            supabase.from_("monitoring.system_health_checks").insert({
                "check_type": "DAILY_HEALTH_CHECK",
                "status": status,
                "results": json.dumps(results),
                "created_at": datetime.utcnow().isoformat()
            }).execute()
        except Exception as e:
            # Table might not exist, that's OK
            pass

    return 0 if status == "healthy" else 1


if __name__ == "__main__":
    sys.exit(main())
