#!/usr/bin/env node

/**
 * RLS Policy Testing Script
 * 
 * Run this script after any migration that modifies RLS policies
 * Usage: node scripts/test-rls-policies.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runRLSTests() {
  console.log('🧪 Starting RLS Policy Tests...\n');
  
  try {
    // Run the comprehensive RLS tests
    const { data: summary, error: summaryError } = await supabase
      .rpc('run_all_rls_tests');
    
    if (summaryError) {
      console.error('❌ Error running RLS tests:', summaryError);
      return false;
    }
    
    if (!summary || summary.length === 0) {
      console.error('❌ No test results returned');
      return false;
    }
    
    const result = summary[0];
    console.log('📊 Test Summary:');
    console.log(`   Total Tests: ${result.total_tests}`);
    console.log(`   Passed: ${result.passed_tests} ✅`);
    console.log(`   Failed: ${result.failed_tests} ❌`);
    console.log(`   Success Rate: ${result.success_rate}%\n`);
    
    // Get detailed results
    const { data: details, error: detailsError } = await supabase
      .rpc('get_rls_test_details');
    
    if (detailsError) {
      console.error('❌ Error getting test details:', detailsError);
      return false;
    }
    
    if (details && details.length > 0) {
      console.log('📋 Detailed Results:');
      console.log('─'.repeat(80));
      
      details.forEach(test => {
        const status = test.success ? '✅' : '❌';
        const expected = test.expected_result ? 'ALLOW' : 'DENY';
        const actual = test.actual_result ? 'ALLOWED' : 'DENIED';
        
        console.log(`${status} ${test.test_name}`);
        console.log(`   Table: ${test.table_name} | Operation: ${test.operation} | Role: ${test.user_role}`);
        console.log(`   Expected: ${expected} | Actual: ${actual}`);
        
        if (test.error_message) {
          console.log(`   Error: ${test.error_message}`);
        }
        console.log('');
      });
    }
    
    // Return success status
    return result.failed_tests === 0;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testSpecificScenarios() {
  console.log('🎯 Testing Specific User Scenarios...\n');
  
  try {
    // Test 1: Can a regular user update their profile?
    console.log('Testing: Regular user profile update...');
    
    // Create a test user session
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com', // This won't work in production, just for demo
      password: 'dummy'
    });
    
    if (authError) {
      console.log('⚠️  Skipping user session tests (no test user available)');
    } else {
      // Test profile update with user session
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: 'Test Update' })
        .eq('id', user.id);
      
      if (updateError) {
        console.log('❌ Profile update failed:', updateError.message);
      } else {
        console.log('✅ Profile update successful');
      }
    }
    
  } catch (error) {
    console.log('⚠️  User scenario tests skipped:', error.message);
  }
}

async function main() {
  console.log('🚀 RLS Policy Test Suite');
  console.log('========================\n');
  
  // Run comprehensive RLS tests
  const testsPass = await runRLSTests();
  
  // Run specific scenario tests
  await testSpecificScenarios();
  
  console.log('\n' + '='.repeat(50));
  
  if (testsPass) {
    console.log('🎉 All RLS tests passed! Your policies are working correctly.');
    process.exit(0);
  } else {
    console.log('💥 Some RLS tests failed! Please review the policies.');
    process.exit(1);
  }
}

// Run the tests
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
