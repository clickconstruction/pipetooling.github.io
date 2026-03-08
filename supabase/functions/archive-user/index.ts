import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArchiveUserRequest {
  email?: string
  name?: string
  reassign_customers_to?: string  // Optional: UUID of master to reassign customers to
}

const BAN_UNTIL_FAR_FUTURE = '9999-12-31T23:59:59.999Z'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData || userData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only devs can archive users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, name, reassign_customers_to }: ArchiveUserRequest = await req.json()

    if (!email && !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email or name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userToArchive: { id: string; email: string | null; name: string | null } | null = null

    if (email) {
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email.trim())
        .is('archived_at', null)
        .maybeSingle()

      if (emailError) {
        return new Response(
          JSON.stringify({ error: `Error finding user: ${emailError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userByEmail) {
        userToArchive = userByEmail
      }
    }

    if (!userToArchive && name) {
      const { data: userByName, error: nameError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('name', name.trim())
        .is('archived_at', null)
        .maybeSingle()

      if (nameError) {
        return new Response(
          JSON.stringify({ error: `Error finding user: ${nameError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (userByName) {
        userToArchive = userByName
      }
    }

    if (!userToArchive) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (userToArchive.id === authUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot archive your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: 'SUPABASE_SERVICE_ROLE_KEY not configured. This is required for user archival.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    let customerCount = 0
    if (reassign_customers_to) {
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

      const { count, error: countError } = await adminClient
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('master_user_id', userToArchive.id)

      if (countError) {
        return new Response(
          JSON.stringify({ error: `Failed to count customers: ${countError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      customerCount = count || 0

      if (customerCount > 0) {
        const { error: reassignError } = await adminClient
          .from('customers')
          .update({ master_user_id: reassign_customers_to })
          .eq('master_user_id', userToArchive.id)

        if (reassignError) {
          return new Response(
            JSON.stringify({
              error: `Failed to reassign customers: ${reassignError.message}`,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    const { error: updateUserError } = await adminClient
      .from('users')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', userToArchive.id)

    if (updateUserError) {
      return new Response(
        JSON.stringify({
          error: `Failed to archive user record: ${updateUserError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: banError } = await adminClient.auth.admin.updateUserById(userToArchive.id, {
      banned_until: BAN_UNTIL_FAR_FUTURE,
    })

    if (banError) {
      console.error('Auth ban failed after public.users updated:', banError)
      return new Response(
        JSON.stringify({ error: `Failed to ban user from auth: ${banError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: reassign_customers_to
          ? `User ${userToArchive.email || userToArchive.name} archived and ${customerCount} customer${customerCount !== 1 ? 's' : ''} reassigned`
          : `User ${userToArchive.email || userToArchive.name} archived successfully`,
        customersReassigned: reassign_customers_to ? customerCount : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in archive-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
