#!/bin/bash

# RLS Policy Testing Script
# Run this after any migration that modifies RLS policies

echo "🧪 Testing RLS Policies..."
echo "=========================="

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables:"
    echo "   SUPABASE_URL"
    echo "   SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Please set these in your .env file or environment"
    exit 1
fi

# Function to run SQL and check result
run_test_sql() {
    local test_name="$1"
    local sql="$2"
    local expected_success="$3"
    
    echo "Testing: $test_name"
    
    # Run the SQL command using supabase CLI or curl
    if command -v supabase &> /dev/null; then
        # Use Supabase CLI if available
        result=$(supabase db query "$sql" 2>&1)
        exit_code=$?
    else
        # Fallback to curl
        result=$(curl -s -X POST \
            "$SUPABASE_URL/rest/v1/rpc/run_all_rls_tests" \
            -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json")
        exit_code=$?
    fi
    
    if [ $exit_code -eq 0 ] && [ "$expected_success" = "true" ]; then
        echo "✅ $test_name passed"
        return 0
    elif [ $exit_code -ne 0 ] && [ "$expected_success" = "false" ]; then
        echo "✅ $test_name passed (correctly blocked)"
        return 0
    else
        echo "❌ $test_name failed"
        echo "   Result: $result"
        return 1
    fi
}

# Quick RLS tests using SQL functions
echo ""
echo "Running comprehensive RLS tests..."

# Test using the RLS testing functions we created
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    
    # Run the comprehensive test
    supabase db query "SELECT * FROM run_all_rls_tests();"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "Getting detailed results..."
        supabase db query "SELECT test_name, table_name, operation, user_role, success, error_message FROM get_rls_test_details() ORDER BY success ASC;"
    fi
    
else
    echo "Supabase CLI not found. Using curl..."
    
    # Test using REST API
    response=$(curl -s -X POST \
        "$SUPABASE_URL/rest/v1/rpc/run_all_rls_tests" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json")
    
    echo "Test Results:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
fi

echo ""
echo "🎯 Manual Test Scenarios:"
echo "========================="

# Manual test scenarios you can run
cat << 'EOF'
To manually test your RLS policies, try these scenarios:

1. Test Profile Updates (as regular user):
   - Log into your app as a regular user
   - Try to update your profile settings
   - Should work ✅

2. Test Profile Updates (as different user):
   - Try to update another user's profile via API
   - Should be blocked ❌

3. Test Admin Access:
   - Log in as an admin user
   - Try to update any user's profile
   - Should work ✅

4. Test Submission Updates:
   - Submit a video as a regular user
   - Admin rejects it
   - Try to update the rejected submission
   - Should work ✅

5. Test Public Access:
   - Access leaderboard without authentication
   - Should show users with approved submissions ✅

EOF

echo ""
echo "🔧 Quick Manual Tests:"
echo "====================="

# Provide some quick manual test commands
echo "Run these SQL commands to test specific scenarios:"
echo ""
echo "-- Test if profiles UPDATE policy exists:"
echo "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE';"
echo ""
echo "-- Test if submissions UPDATE policy exists:"
echo "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'submissions' AND cmd = 'UPDATE';"
echo ""
echo "-- Run full RLS test suite:"
echo "SELECT * FROM run_all_rls_tests();"
echo ""
echo "-- Get detailed test results:"
echo "SELECT * FROM get_rls_test_details();"

echo ""
echo "✅ RLS testing complete!"
echo ""
echo "💡 Pro tip: Add this script to your migration workflow:"
echo "   1. Run migration: supabase db push"
echo "   2. Test RLS: ./scripts/test-rls.sh"
echo "   3. Deploy only if tests pass ✅"
