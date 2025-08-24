import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0';

declare global {
  interface Window {
    Deno: {
      env: {
        get(key: string): string | undefined;
      };
    };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
  message: string;
}

interface UsersResponse {
  users: any[];
}

type ApiResponse = ErrorResponse | SuccessResponse | UsersResponse;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' } as ErrorResponse), 
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the JWT token from the authorization header
    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' } as ErrorResponse), 
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' } as ErrorResponse), 
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user is in admin_roles table
    const { data: adminRole } = await supabaseClient
      .from('admin_roles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile.role !== 'admin' && !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Admin access required.' } as ErrorResponse), 
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For POST requests, delete the user
    if (req.method === 'POST') {
      const { user_id } = await req.json();
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' } as ErrorResponse), 
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Call the delete_user procedure
      const { error: deleteError } = await supabaseClient.rpc('delete_user', {
        user_id_to_delete: user_id
      });

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message } as ErrorResponse), 
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User deleted successfully'
        } as SuccessResponse), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else if (req.method === 'GET') {
      const { data: users, error: listError } = await supabaseClient.rpc('list_users');
      
      if (listError) {
        return new Response(
          JSON.stringify({ error: listError.message } as ErrorResponse), 
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({ users } as UsersResponse), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' } as ErrorResponse), 
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage } as ErrorResponse), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}); 