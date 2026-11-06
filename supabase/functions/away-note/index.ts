import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

/**
 * The Away note (punch list #256 PR 8, v2.6587): the one screen a teammate who left sees when they sign in. The office
 * writes it person by person; this function is the one writer of `away_notes`, because a note on an archived account
 * also opens the sign-in (the ban archive-user put on the login comes off, and the seal of migration *_archived_seal
 * holds them to /rpc/my_away_note), and taking the note down puts the ban back. The same people archive-user admits:
 * a dev, a controller or a pay-approved master.
 *
 * Body: { action: 'save', user_id, note: { words, countdown_ymd, show_where, show_call, alert_on_day } }
 *   or  { action: 'clear', user_id }
 * Answers { success, sealed }: `sealed` is true when the account is archived, has a login and now opens to the note.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** archive-user's ban, a Go duration GoTrue takes as `ban_duration`; 'none' lifts it. */
const BAN_DURATION_FOREVER = '876000h'
const WORDS_MAX = 600

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type NoteBody = { words?: unknown; countdown_ymd?: unknown; show_where?: unknown; show_call?: unknown; alert_on_day?: unknown }
type Note = { words: string; countdown_ymd: string | null; show_where: boolean; show_call: boolean; alert_on_day: boolean }

/** The note as the row takes it, or the reason it cannot be saved: the kernel's rules (awayNoteProblem) in the function's own words. */
export function readNote(body: NoteBody | null | undefined, todayYmd: string): { note: Note } | { error: string } {
  const words = typeof body?.words === 'string' ? body.words : ''
  if (words.length > WORDS_MAX) return { error: `The note is over ${WORDS_MAX} characters. Keep it to a few lines.` }
  const countdown = body?.countdown_ymd == null || body.countdown_ymd === '' ? null : body.countdown_ymd
  if (countdown != null && (typeof countdown !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(countdown))) return { error: 'The day back is not a date.' }
  if (countdown != null && countdown <= todayYmd) return { error: 'The day back has to be after today.' }
  const alert = body?.alert_on_day === true
  if (alert && countdown == null) return { error: 'Tell me when the countdown ends needs a day back to count to.' }
  return { note: { words, countdown_ymd: countdown, show_where: body?.show_where !== false, show_call: body?.show_call !== false, alert_on_day: alert } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized - No authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user: authUser },
      error: authError,
    } = await caller.auth.getUser(token)
    if (authError || !authUser) return json({ error: 'Unauthorized - Invalid or expired session. Please sign out and sign in again.' }, 401)

    // The gate archive-user keeps (v2.2713): a dev, a controller or a pay-approved master.
    const { data: callerRow } = await caller.from('users').select('role').eq('id', authUser.id).single()
    const callerRole = (callerRow as { role?: string } | null)?.role
    let callerAllowed = callerRole === 'dev' || callerRole === 'controller'
    if (!callerAllowed && callerRole === 'master_technician') {
      const { data: pam } = await caller.from('pay_approved_masters').select('master_id').eq('master_id', authUser.id).maybeSingle()
      callerAllowed = Boolean(pam)
    }
    if (!callerAllowed) return json({ error: 'Forbidden - Only a dev, a controller, or a pay-approved master can leave an Away note' }, 403)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const archivedRefusal = await refuseArchivedCaller(admin, authUser.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    const body = (await req.json()) as { action?: unknown; user_id?: unknown; note?: NoteBody }
    const action = body.action
    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
    if (action !== 'save' && action !== 'clear') return json({ error: "action must be 'save' or 'clear'" }, 400)
    if (!userId) return json({ error: 'Missing required field: user_id' }, 400)
    if (userId === authUser.id) return json({ error: 'An Away note is for someone else.' }, 400)

    const { data: target, error: targetError } = await admin.from('users').select('id, name, archived_at, login_attached_at').eq('id', userId).maybeSingle()
    if (targetError) return json({ error: `Could not read the person: ${targetError.message}` }, 500)
    const row = target as { id: string; name: string | null; archived_at: string | null; login_attached_at: string | null } | null
    if (!row) return json({ error: 'No person with that id' }, 404)
    const archivedWithLogin = row.archived_at != null && row.login_attached_at != null

    if (action === 'save') {
      const read = readNote(body.note, todayYmdInAppTz())
      if ('error' in read) return json({ error: read.error }, 400)
      const { error: upsertError } = await admin
        .from('away_notes')
        .upsert({ user_id: userId, ...read.note, created_by: authUser.id }, { onConflict: 'user_id' })
      if (upsertError) return json({ error: `The note did not save: ${upsertError.message}` }, 500)
      // A note on an archived login opens the sign-in: the seal holds them to the note (migration *_archived_seal).
      if (archivedWithLogin) {
        const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
        if (unbanError) return json({ error: `The note saved, but their sign-in did not open: ${unbanError.message}` }, 500)
      }
      return json({ success: true, sealed: archivedWithLogin, note: read.note })
    }

    const { error: deleteError } = await admin.from('away_notes').delete().eq('user_id', userId)
    if (deleteError) return json({ error: `The note did not come down: ${deleteError.message}` }, 500)
    // No note, no screen: an archived login is banned again, as archive-user leaves it.
    if (archivedWithLogin) {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION_FOREVER })
      if (banError) return json({ error: `The note came down, but their sign-in did not close: ${banError.message}` }, 500)
    }
    return json({ success: true, sealed: false })
  } catch (error) {
    console.error('Error in away-note function:', error)
    return json({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
