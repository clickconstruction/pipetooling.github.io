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
    const { email, name }: DeleteUserRequest = await req.json()

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

    // Delete from auth.users (requires service role)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userToDelete.id)

    if (deleteAuthError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete user from auth: ${deleteAuthError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete from public.users (cascade should handle related records, but we'll delete explicitly)
    // Note: The trigger should handle deleting from public.users when auth.users is deleted,
    // but we'll delete it explicitly to be safe
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userToDelete.id)

    if (deleteUserError) {
      // Log but don't fail - auth user is already deleted
      console.error('Error deleting from public.users:', deleteUserError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${userToDelete.email || userToDelete.name} deleted successfully`,
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
