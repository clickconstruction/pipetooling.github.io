import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  role: string
  name?: string
  /** For estimator role: IDs of service types this estimator can access. Omit or empty = all. */
  service_type_ids?: string[]
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
        JSON.stringify({ error: 'Forbidden - Only devs can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, role, name, service_type_ids }: CreateUserRequest = await req.json()

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, and role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator', 'primary']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and resolve estimator_service_type_ids when role is estimator
    let estimatorServiceTypeIds: string[] | null = null
    if (role === 'estimator' && service_type_ids && service_type_ids.length > 0) {
      const { data: validTypes, error: typesError } = await supabase
        .from('service_types')
        .select('id')
        .in('id', service_type_ids)
      if (typesError) {
        return new Response(
          JSON.stringify({ error: `Error validating service types: ${typesError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const validIds = (validTypes ?? []).map((r: { id: string }) => r.id)
      const invalidIds = service_type_ids.filter((id) => !validIds.includes(id))
      if (invalidIds.length > 0) {
        return new Response(
          JSON.stringify({ error: `Invalid service type IDs: ${invalidIds.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      estimatorServiceTypeIds = validIds
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (checkError) {
      return new Response(
        JSON.stringify({ error: `Error checking for existing user: ${checkError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get service role key for admin operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ 
          error: 'SUPABASE_SERVICE_ROLE_KEY not configured. This is required for user creation.' 
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

    // Create user in auth.users (requires service role)
    const { data: newAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm email for manually created users
    })

    if (createAuthError || !newAuthUser.user) {
      return new Response(
        JSON.stringify({ error: `Failed to create user in auth: ${createAuthError?.message || 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create entry in public.users (trigger should handle this, but we'll do it explicitly to set name)
    const userRecord: Record<string, unknown> = {
      id: newAuthUser.user.id,
      email: email.trim().toLowerCase(),
      role: role,
      name: name?.trim() || null,
    }
    if (role === 'estimator' && estimatorServiceTypeIds !== null) {
      userRecord.estimator_service_type_ids = estimatorServiceTypeIds
    }
    const { error: createUserError } = await adminClient
      .from('users')
      .upsert(userRecord, {
        onConflict: 'id',
      })

    if (createUserError) {
      // If public.users creation fails, try to clean up auth user
      console.error('Error creating user in public.users:', createUserError)
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${createUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userResponse: Record<string, unknown> = {
      id: newAuthUser.user.id,
      email: newAuthUser.user.email,
      role: role,
      name: name?.trim() || null,
    }
    if (role === 'estimator' && estimatorServiceTypeIds !== null) {
      userResponse.estimator_service_type_ids = estimatorServiceTypeIds
    }
    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${email.trim()} created successfully`,
        user: userResponse,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
