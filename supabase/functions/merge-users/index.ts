import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MergeUsersRequest {
  survivor_user_id?: string
  absorbed_user_id?: string
  dry_run?: boolean
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

    const { data: callerData, error: callerError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (callerError || !callerData || callerData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only devs can merge users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { survivor_user_id, absorbed_user_id, dry_run }: MergeUsersRequest = await req.json()

    if (!survivor_user_id || !absorbed_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: survivor_user_id and absorbed_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // The RPC re-validates everything (dev caller, same role, absorbed archived-or-never-used,
    // survivor-must-be-live, salary overlap) inside one transaction.
    const { data: rpcData, error: rpcError } = await supabase.rpc('merge_user_accounts', {
      p_survivor_user_id: survivor_user_id,
      p_absorbed_user_id: absorbed_user_id,
      p_dry_run: dry_run === true,
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Merge failed: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = rpcData as {
      ok: boolean
      code?: string
      error?: string
      dry_run?: boolean
      moved?: Record<string, number>
      warnings?: string[]
    } | null

    if (!result || result.ok !== true) {
      const status =
        result?.code === 'forbidden' ? 403 :
        result?.code === 'survivor_not_found' || result?.code === 'absorbed_not_found' ? 404 :
        result?.code === 'role_mismatch' || result?.code === 'absorbed_in_use' ||
        result?.code === 'survivor_must_be_live' || result?.code === 'same_account' ||
        result?.code === 'self_absorb' || result?.code === 'salary_schedule_overlap' ? 409 :
        500
      return new Response(
        JSON.stringify({ error: result?.error || 'Merge failed', code: result?.code }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Committed merge: make sure the absorbed login is banned (it may have been a live,
    // never-signed-in account — the RPC tombstones public.users but can't touch auth).
    if (result.dry_run !== true) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!serviceRoleKey) {
        return new Response(
          JSON.stringify({
            error: 'Merge committed, but SUPABASE_SERVICE_ROLE_KEY is not configured so the absorbed login was not banned.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error: banError } = await adminClient.auth.admin.updateUserById(absorbed_user_id, {
        banned_until: BAN_UNTIL_FAR_FUTURE,
      })
      if (banError) {
        console.error('merge-users: auth ban failed after data merge committed:', banError)
        return new Response(
          JSON.stringify({
            error: `Merge committed, but banning the absorbed login failed: ${banError.message}. Archive it manually.`,
            moved: result.moved ?? {},
            warnings: result.warnings ?? [],
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: result.dry_run === true,
        moved: result.moved ?? {},
        warnings: result.warnings ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in merge-users function:', error)
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
