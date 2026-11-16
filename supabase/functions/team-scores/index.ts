/**
 * team-scores (punch list #360, PR 4): the People → Review → Scores read, made on the server.
 *
 * The Scores tab's two numbers are built from wages: every paid field hour is priced at the person's wage, and the
 * hurdle's break-even is the overhead pool, which is office time at the office wage. Until now the tab made those
 * reads in the browser, so the wages travelled to whoever the gate admitted. This function makes the same reads as
 * the service role and answers with the scores alone: hours and dollars by job, never a person's wage.
 *
 * It runs the app's own code, not a copy of its arithmetic: `readScorecard` (the reads) and the scorecard kernels
 * come from the kernel copy (`_shared/gcKernels`, generated from `src`), as the Bridge's weekly sheet runs the
 * Bridge's. The overhead scan's own header says why: no SQL re-implementation, no second kernel to drift.
 *
 * POST { windowDays: 28 | 56 | 90 }, signed in. Answers { ok: true, scores } where `scores` is `ScorecardWire`
 * (`scorecardWire.ts`), or { ok: false, error } with 401 (not signed in), 403 (not the scoreboard's gate), 400 (a
 * window the tab does not offer) or 500. Test jobs are left out, as on the Bridge. Nothing is written.
 *
 * Who it answers: the scoreboard's gate, read here and not taken from the caller: a dev, the owner, or anyone the
 * database says has payroll access (`has_payroll_access()`, asked as the caller). A sample account, a digital twin,
 * the walk tester and an archived account are refused.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { isArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
// The copy's slim database types: the deploy uploads a type import too. The generator reads this file for the names
// it keeps.
import type { Database } from '../_shared/gcKernels/types/database.ts'
// The kernels straight from the copy, not its index.
import { readScorecard } from '../_shared/gcKernels/lib/scorecard/scorecardReads.ts'
import { mayReadTeamScores, scorecardToWire, teamScoresWindowDays } from '../_shared/gcKernels/lib/scorecard/scorecardWire.ts'
import { readZzTestJobRows } from '../_shared/gcKernels/lib/jobs/zzTestJobReads.ts'
import { todayYmdInAppTz } from '../_shared/gcKernels/utils/dateUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Admin = SupabaseClient<Database>

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ ok: false, error: 'Not set up' }, 503)

    // Who is asking, from their own token.
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ ok: false, error: 'Sign in to read the scores.' }, 401)
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return json({ ok: false, error: 'Sign in to read the scores.' }, 401)

    const admin: Admin = createClient<Database>(supabaseUrl, serviceRoleKey, { db: { schema: 'public' } })
    if (await isArchivedCaller(admin, u.user.id)) return json({ ok: false, error: 'This account is archived.' }, 403)
    const { data: who } = await admin.from('users').select('role, archived_at').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
    if (!who || who.archived_at) return json({ ok: false, error: 'The scores are for the office.' }, 403)
    // Payroll access is the database's own answer for this person, asked as them.
    const { data: payroll } = await caller.rpc('has_payroll_access')
    if (!mayReadTeamScores({ role: who.role, payrollAccess: payroll === true })) return json({ ok: false, error: 'The scores are for the owner, a dev and whoever has payroll access.' }, 403)

    const body = (await req.json().catch(() => null)) as { windowDays?: unknown } | null
    const windowDays = teamScoresWindowDays(body?.windowDays)
    if (windowDays == null) return json({ ok: false, error: 'Ask for the last 28, 56 or 90 days.' }, 400)

    const zzTestJobIds = new Set((await readZzTestJobRows(admin)).map((r) => r.id))
    const read = await readScorecard(admin, { windowDays, todayYmd: todayYmdInAppTz(new Date()), zzTestJobIds })
    return json({ ok: true, scores: scorecardToWire(read) })
  } catch (e) {
    console.error('[team-scores]', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'The scores could not be read.' }, 500)
  }
})
