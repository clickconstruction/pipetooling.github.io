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
  /** For estimator/subcontractor/helpers/superintendent role: IDs of service types to restrict. Omit or empty = all. */
  service_type_ids?: string[]
  /** Start the account in training mode (`users.read_only = true`): they browse everything their role sees, every write is blocked. Default false. */
  read_only?: boolean
  /** v2.3606 View as: a sample account — hidden from rosters and notifications like a twin; a dev imitates it to see the app as its role. Default false. */
  is_sample?: boolean
  /**
   * v2.3627 Hiring → Try out: make a trial helper's login from a Hiring card. The one door that is
   * not dev-only — a Hiring-board holder may call it, and the function then ignores `email`,
   * `name`, `role`, `read_only` and `is_sample` from the body: the account is a `helpers` login
   * built from the card the caller can see, linked both ways, and the card moves to `trial`.
   */
  trial_prospect_id?: string
}

/** A password nobody is told: the helper signs in by emailed link (send-sign-in-email) or resets it. */
function unguessablePassword(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'aA1!'
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

    // Parse request body
    const body: CreateUserRequest = await req.json()
    const trialProspectId = typeof body.trial_prospect_id === 'string' && body.trial_prospect_id.trim() ? body.trial_prospect_id.trim() : null

    // v2.3627: the Try-out door. Everything else stays dev-only.
    let trialCard: { id: string; name: string; email: string } | null = null
    if (trialProspectId) {
      const { data: hasBoard, error: boardError } = await supabase.rpc('user_has_team_prospects_access')
      if (userError || !userData || boardError || (userData.role !== 'dev' && hasBoard !== true)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden - Only the Hiring board can start a try-out' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      // Read the card as the caller, so RLS decides whether they may see it at all.
      const { data: card, error: cardError } = await supabase
        .from('team_prospects')
        .select('id, name, email, status, trial_user_id')
        .eq('id', trialProspectId)
        .maybeSingle()
      if (cardError || !card) {
        return new Response(
          JSON.stringify({ error: 'That candidate was not found on your Hiring board' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (card.trial_user_id || (card.status !== 'active' && card.status !== 'calling')) {
        return new Response(
          JSON.stringify({ error: 'This candidate is already on a try-out, hired or passed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const cardEmail = typeof card.email === 'string' ? card.email.trim().toLowerCase() : ''
      if (!cardEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardEmail)) {
        return new Response(
          JSON.stringify({ error: 'Add an email to the card first — the helper signs in with it to clock in' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      trialCard = { id: card.id, name: String(card.name ?? '').trim(), email: cardEmail }
    } else if (userError || !userData || userData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only devs can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // On the Try-out door the card decides who is made; the body only says which column's trades.
    const email = trialCard ? trialCard.email : body.email
    const password = trialCard ? unguessablePassword() : body.password
    const role = trialCard ? 'helpers' : body.role
    const name = trialCard ? trialCard.name : body.name
    const service_type_ids = body.service_type_ids
    const read_only = trialCard ? undefined : body.read_only
    const is_sample = trialCard ? undefined : body.is_sample

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, and role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['dev', 'master_technician', 'assistant', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (read_only !== undefined && typeof read_only !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'read_only must be true or false' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const startInTraining = read_only === true
    if (is_sample !== undefined && typeof is_sample !== 'boolean') {
      return new Response(JSON.stringify({ error: 'is_sample must be true or false' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const isSample = is_sample === true

    // Validate and resolve service_type_ids when role is estimator, subcontractor, or superintendent
    let estimatorServiceTypeIds: string[] | null = null
    let subcontractorServiceTypeIds: string[] | null = null
    let helpersServiceTypeIds: string[] | null = null
    let superintendentServiceTypeIds: string[] | null = null
    if ((role === 'estimator' || role === 'subcontractor' || role === 'helpers' || role === 'superintendent') && service_type_ids && service_type_ids.length > 0) {
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
      if (role === 'estimator') estimatorServiceTypeIds = validIds
      if (role === 'subcontractor') subcontractorServiceTypeIds = validIds
      if (role === 'helpers') helpersServiceTypeIds = validIds
      if (role === 'superintendent') superintendentServiceTypeIds = validIds
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

    // Create entry in public.users (trigger should handle this, but we'll do it explicitly to set
    // name and the training-mode flag). Service-role writes pass users_guard_privileged_columns.
    const userRecord: Record<string, unknown> = {
      id: newAuthUser.user.id,
      email: email.trim().toLowerCase(),
      role: role,
      name: name?.trim() || null,
      read_only: startInTraining,
      is_sample: isSample,
    }
    if (trialCard) userRecord.trial_prospect_id = trialCard.id
    if (role === 'estimator' && estimatorServiceTypeIds !== null) {
      userRecord.estimator_service_type_ids = estimatorServiceTypeIds
    }
    if (role === 'subcontractor' && subcontractorServiceTypeIds !== null) {
      userRecord.subcontractor_service_type_ids = subcontractorServiceTypeIds
    }
    if (role === 'helpers' && helpersServiceTypeIds !== null) {
      userRecord.helpers_service_type_ids = helpersServiceTypeIds
    }
    if (role === 'superintendent' && superintendentServiceTypeIds !== null) {
      userRecord.superintendent_service_type_ids = superintendentServiceTypeIds
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

    // The card moves to Try-out and points at the account. Guarded on the status it was read in, so
    // two presses cannot both win; the loser's account is taken back out.
    if (trialCard) {
      const { data: moved, error: moveError } = await adminClient
        .from('team_prospects')
        .update({ status: 'trial', trial_user_id: newAuthUser.user.id, trial_started_at: new Date().toISOString() })
        .eq('id', trialCard.id)
        .is('trial_user_id', null)
        .in('status', ['active', 'calling'])
        .select('id')
      if (moveError || !moved || moved.length === 0) {
        console.error('Error moving the card to trial:', moveError)
        await adminClient.from('users').delete().eq('id', newAuthUser.user.id)
        await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
        return new Response(
          JSON.stringify({ error: `Could not start the try-out: ${moveError?.message || 'the card changed while this ran'}` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const userResponse: Record<string, unknown> = {
      id: newAuthUser.user.id,
      email: newAuthUser.user.email,
      role: role,
      name: name?.trim() || null,
      read_only: startInTraining,
      is_sample: isSample,
    }
    if (trialCard) userResponse.trial_prospect_id = trialCard.id
    if (role === 'estimator' && estimatorServiceTypeIds !== null) {
      userResponse.estimator_service_type_ids = estimatorServiceTypeIds
    }
    if (role === 'subcontractor' && subcontractorServiceTypeIds !== null) {
      userResponse.subcontractor_service_type_ids = subcontractorServiceTypeIds
    }
    if (role === 'helpers' && helpersServiceTypeIds !== null) {
      userResponse.helpers_service_type_ids = helpersServiceTypeIds
    }
    if (role === 'superintendent' && superintendentServiceTypeIds !== null) {
      userResponse.superintendent_service_type_ids = superintendentServiceTypeIds
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
