import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ } from "../_shared/appTimeZone.ts"
import { forwardCtSeatState } from '../_shared/ctBridge.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArchiveUserRequest {
  /** The users row's id — the one handle since v2.6528 (#264); a person with no login may have no address. */
  user_id?: string
  /** Kept for the words in the answer; no longer a lookup. */
  email?: string
  name?: string
  reassign_customers_to?: string  // Optional: UUID of master to reassign customers to
}

// GoTrue's admin update bans by `ban_duration`, a Go duration (100 years here); it silently
// drops a `banned_until`.
const BAN_DURATION_FOREVER = '876000h'

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

    // Person Desk PR 5 (v2.2713): controllers and pay-approved masters offboard too — the
    // same set that can end employment on the Desk. Role changes elsewhere stay dev-only.
    const callerRole = userData?.role as string | undefined
    let callerAllowed = callerRole === 'dev' || callerRole === 'controller'
    if (!callerAllowed && callerRole === 'master_technician') {
      const { data: pam } = await supabase.from('pay_approved_masters').select('master_id').eq('master_id', authUser.id).maybeSingle()
      callerAllowed = Boolean(pam)
    }
    if (userError || !userData || !callerAllowed) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only a dev, a controller, or a pay-approved master can archive users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, name, reassign_customers_to, user_id }: ArchiveUserRequest = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let userToArchive: { id: string; email: string | null; name: string | null } | null = null

    if (user_id) {
      const { data: userById, error: idError } = await supabase.from('users').select('id, email, name').eq('id', user_id).is('archived_at', null).maybeSingle()
      if (idError) {
        return new Response(JSON.stringify({ error: `Error finding user: ${idError.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (userById) userToArchive = userById
    }

    if (!userToArchive) {
      // The active-only lookups above can't see archived accounts — check for one so the
      // error says "already archived" instead of the misleading "User not found".
      const { data: archivedById } = await supabase
        .from('users')
        .select('email, name, archived_at')
        .eq('id', user_id)
        .not('archived_at', 'is', null)
        .maybeSingle()
      const archivedMatch = (archivedById as { email: string | null; name: string | null; archived_at: string | null } | null) ?? null
      if (archivedMatch) {
        let archivedOn = ''
        if (archivedMatch.archived_at) {
          try {
            archivedOn = ` (${new Date(archivedMatch.archived_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: APP_CALENDAR_TZ,
            })})`
          } catch {
            archivedOn = ''
          }
        }
        return new Response(
          JSON.stringify({ error: `That user is already archived${archivedOn}.` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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

    // v2.6519 (punch list #260): a row with no login behind it has no auth account to ban.
    const { data: archivedRow } = await adminClient.from('users').select('login_attached_at').eq('id', userToArchive.id).maybeSingle()
    const hasLogin = (archivedRow as { login_attached_at: string | null } | null)?.login_attached_at != null
    // The Away note (#256 PR 8, v2.6587): a note left for them keeps the sign-in open, and the seal of migration
    // *_archived_seal holds that sign-in to the one screen. No note, the ban as before.
    const { data: awayNote } = hasLogin ? await adminClient.from('away_notes').select('user_id').eq('user_id', userToArchive.id).maybeSingle() : { data: null }
    const awayNoteOn = awayNote != null
    const { error: banError } = hasLogin && !awayNoteOn
      ? await adminClient.auth.admin.updateUserById(userToArchive.id, {
          ban_duration: BAN_DURATION_FOREVER,
        })
      : { error: null }

    if (banError) {
      console.error('Auth ban failed after public.users updated:', banError)
      return new Response(
        JSON.stringify({ error: `Failed to ban user from auth: ${banError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CT bridge (v2.2435): mirror the retirement to CountTooling when a seat is linked.
    // Fail-soft — a CT-leg failure never blocks the archive; the audit catches drift.
    const ctBridge = await forwardCtSeatState(
      adminClient as unknown as Parameters<typeof forwardCtSeatState>[0],
      userToArchive.id,
      'deactivate',
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: reassign_customers_to
          ? `User ${userToArchive.email || userToArchive.name} archived and ${customerCount} customer${customerCount !== 1 ? 's' : ''} reassigned`
          : `User ${userToArchive.email || userToArchive.name} archived successfully`,
        customersReassigned: reassign_customers_to ? customerCount : 0,
        away_note_on: awayNoteOn,
        ct_bridge: ctBridge,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in archive-user function:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
