import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    // FIXED: Get the pool that's actively being drained (has activity)
    // Priority: 1) Pool being drained (remaining < total), 2) Current week pool

    // First, try to find a pool that's being drained (remaining < total, not depleted)
    const { data: activePool, error: activeError } = await supabaseClient
      .from('weekly_pools')
      .select('*')
      .lt('remaining_amount_dollars', 250) // Has been drained some
      .gt('remaining_amount_dollars', 0)   // Not fully depleted
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no actively draining pool, get the current pool
    let pool = activePool;

    if (!pool) {
      const { data: currentPool, error: currentError } = await supabaseClient
        .from('weekly_pools')
        .select('*')
        .eq('is_current', true)
        .limit(1)
        .maybeSingle();

      pool = currentPool;

      // If still no pool, get the most recent one
      if (!pool) {
        const { data: recentPool } = await supabaseClient
          .from('weekly_pools')
          .select('*')
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        pool = recentPool;
      }
    }

    if (!pool) {
      console.log('No pool found, returning defaults');
      return new Response(JSON.stringify({
        success: true,
        pool: {
          remaining_dollars: '250',
          total_dollars: '250',
          spent_dollars: '0',
          progress_percentage: 0,
          is_depleted: false
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const totalDollars = pool.total_amount_dollars || 250;
    const remainingDollars = pool.remaining_amount_dollars ?? totalDollars;
    const spentDollars = totalDollars - remainingDollars;
    const progressPercentage = (spentDollars / totalDollars) * 100;
    const isDepleted = remainingDollars <= 0;

    const poolData = {
      remaining_dollars: remainingDollars.toString(),
      total_dollars: totalDollars.toString(),
      spent_dollars: spentDollars.toString(),
      progress_percentage: Math.round(progressPercentage),
      is_depleted: isDepleted,
      week_start: pool.week_start_date,
      week_end: pool.week_end_date,
      pool_id: pool.id,
      is_current: pool.is_current
    };

    console.log('Pool status:', poolData);

    return new Response(JSON.stringify({
      success: true,
      pool: poolData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in get-pool-status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
