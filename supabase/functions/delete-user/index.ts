import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  email: string
  name: string
  reassign_customers_to?: string  // Optional: UUID of master to reassign customers to
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with anon key for user validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify user is authenticated
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired session. Please sign out and sign in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is dev
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData || userData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only devs can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, name, reassign_customers_to }: DeleteUserRequest = await req.json()

    if (!email && !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email or name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the user to delete
    let userToDelete: { id: string; email: string | null; name: string | null } | null = null

    if (email) {
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email.trim())
        .maybeSingle()

      if (emailError) {
        return new Response(
          JSON.stringify({ error: `Error finding user: ${emailError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userByEmail) {
        userToDelete = userByEmail
      }
    }

    // If not found by email, try by name
    if (!userToDelete && name) {
      const { data: userByName, error: nameError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('name', name.trim())
        .maybeSingle()

      if (nameError) {
        return new Response(
          JSON.stringify({ error: `Error finding user: ${nameError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userByName) {
        userToDelete = userByName
      }
    }

    if (!userToDelete) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent deleting yourself
    if (userToDelete.id === authUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get service role key for admin operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ 
          error: 'SUPABASE_SERVICE_ROLE_KEY not configured. This is required for user deletion.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // If reassigning customers, do it before deleting the user
    let customerCount = 0
    if (reassign_customers_to) {
      // Validate new master exists and is a master/dev
      const { data: newMaster, error: newMasterError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', reassign_customers_to)
        .single()
      
      if (newMasterError || !newMaster) {
        return new Response(
          JSON.stringify({ error: 'New master user not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!['dev', 'master_technician'].includes(newMaster.role)) {
        return new Response(
          JSON.stringify({ error: 'New master must be a dev or master_technician' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Count customers to reassign
      const { count, error: countError } = await adminClient
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('master_user_id', userToDelete.id)
      
      if (countError) {
        return new Response(
          JSON.stringify({ error: `Failed to count customers: ${countError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      customerCount = count || 0
      
      // Reassign all customers to new master
      if (customerCount > 0) {
        const { error: reassignError } = await adminClient
          .from('customers')
          .update({ master_user_id: reassign_customers_to })
          .eq('master_user_id', userToDelete.id)
        
        if (reassignError) {
          return new Response(
            JSON.stringify({ 
              error: `Failed to reassign customers: ${reassignError.message}` 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Delete from public.users FIRST, then auth.users.
    // If public.users references auth.users (or vice versa via triggers), deleting auth first
    // causes "Database error deleting user" due to FK constraints. Deleting public.users first
    // lets cascades run, then auth.users can be deleted cleanly.
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userToDelete.id)

    if (deleteUserError) {
      return new Response(
        JSON.stringify({
          error: `Failed to delete user record: ${deleteUserError.message}. Check for related data (customers, reports, etc.) that may need reassignment.`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete from auth.users (requires service role)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userToDelete.id)

    if (deleteAuthError) {
      // public.users is already deleted; auth delete failed (e.g. trigger, permission).
      // Log and return - caller may need to retry or use Supabase Dashboard.
      console.error('Auth delete failed after public.users removed:', deleteAuthError)
      return new Response(
        JSON.stringify({ error: `Failed to delete user from auth: ${deleteAuthError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: reassign_customers_to 
          ? `User ${userToDelete.email || userToDelete.name} deleted and ${customerCount} customer${customerCount !== 1 ? 's' : ''} reassigned`
          : `User ${userToDelete.email || userToDelete.name} deleted successfully`,
        customersReassigned: reassign_customers_to ? customerCount : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
