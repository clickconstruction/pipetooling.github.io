import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { loadModelKey, type ModelKeyDb } from '../_shared/modelKey.ts'
import { DRAFT_SCHEMA, DRAFT_SYSTEM, costCents, draftFromAnswer, draftUserMessage, readDraftRequest } from '../_shared/reportDraft.ts'

/**
 * report-draft (punch list #186, item 1, PR 2, v2.5916): the words a tech said on the job, drafted into the field
 * report's fields by a language model, for the tech to read and save. The machine drafts, a person presses: this
 * function writes nothing. It reads the transcript, the job's lines with their last percent and the report's fields
 * from the body (`readDraftRequest`), asks Claude Opus 5.5 for one JSON object held to `DRAFT_SCHEMA` (structured
 * output, low effort, Anthropic's default fallback on a refusal), checks the answer against the job's lines
 * (`readDraft`), and answers the draft with what the call cost. The audio never reaches here: the phone's own speech
 * made the words.
 *
 * The caller: anyone who may leave a field report (`canLeaveJobFieldReport`'s roles), a real account, not read-only,
 * since a draft costs money. The key: Vault first (`model_secret_get`, the Model keys card), then ANTHROPIC_API_KEY.
 * With neither the answer is 409 `noKey`, and the form puts the words into Notes as they were said.
 *
 *   POST { transcript, lang, jobName, lines: [{ id, name, pct }], fields: [label] }
 *   200  { ok: true, draft: { notes: { done, parts, next }, lines: [{ id, pct, from }], language }, model, cents }
 *   409  { ok: false, error: "noKey", words }   400 a bad body   403 not allowed   502 the model did not answer
 *
 * Gateway verify_jwt = false: the function checks the bearer itself.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Who may ask for a draft: the roles that may leave a field report (`src/lib/canLeaveJobFieldReport.ts`). */
const REPORT_ROLES = new Set(['subcontractor', 'helpers', 'dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator'])

const MODEL = 'claude-opus-5-5'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'badRequest', words: 'Ask for the draft with POST.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'failed', words: 'The draft is not set up yet.' }, 503)

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ ok: false, error: 'signIn', words: 'Sign in first.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt)
    if (authError || !user) return json({ ok: false, error: 'signIn', words: 'Sign in first.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: who } = await admin.from('users').select('id, role, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
    const row = who as { role?: string; read_only?: boolean } | null
    if (!row || row.read_only || !REPORT_ROLES.has(String(row.role ?? ''))) return json({ ok: false, error: 'notAllowed', words: 'This account cannot ask for a draft.' }, 403)

    const read = readDraftRequest(await req.json().catch(() => null))
    if (!read.ok) return json({ ok: false, error: 'badRequest', words: read.why }, 400)
    const request = read.request

    const { key } = await loadModelKey(admin as unknown as ModelKeyDb, (k) => Deno.env.get(k), 'anthropic')
    if (!key) return json({ ok: false, error: 'noKey', words: 'No model key yet. The words are in Notes as you said them.' }, 409)

    const client = new Anthropic({ apiKey: key })
    const answer = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: DRAFT_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      messages: [{ role: 'user', content: draftUserMessage(request) }],
    })
    if (answer.stop_reason === 'refusal') return json({ ok: false, error: 'refused', words: 'The model would not draft this one. The words are in Notes as you said them.' }, 502)
    const draft = draftFromAnswer(answer.content as ReadonlyArray<{ type: string; text?: string }>, request.lines)
    if (!draft) return json({ ok: false, error: 'failed', words: 'The draft did not come back whole. The words are in Notes as you said them.' }, 502)
    return json({ ok: true, draft, model: answer.model, cents: costCents(answer.usage) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[report-draft]', message)
    return json({ ok: false, error: 'failed', words: 'The draft could not be made. The words are in Notes as you said them.' }, 502)
  }
})
