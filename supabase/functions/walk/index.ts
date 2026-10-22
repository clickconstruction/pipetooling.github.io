import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findAuthUserByEmail } from '../_shared/authUserByEmail.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { GMAIL_SCOPES, gmailMessage, gmailSearch, gmailSend } from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { QUO_API_BASE, loadQuoApiKey } from '../_shared/quoKey.ts'
import { loadWalkKit } from '../_shared/walkKit.ts'
import { parseAddress, readGmailMessage, type EmailIn } from '../_shared/gcKernels/lib/emailIn/gmailMessage.ts'
import { BOXES_SETTINGS_KEY, parseBoxSettings } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { toE164 } from '../_shared/gcKernels/lib/quo/events.ts'
import { sentQuoId } from '../_shared/gcKernels/lib/quo/send.ts'
import type { WalkKit } from '../_shared/gcKernels/lib/walk/kit.ts'
import {
  BROWSER_USER_AGENT,
  TESTER_EMAIL,
  TESTER_NAME,
  acceptLinkIn,
  estimateMailQuery,
  isEstimateMail,
  lastFour,
  leakedSecret,
  parseWalkAsk,
  replyMessageId,
  replyRaw,
  seedOldColumns,
  type WalkAsk,
} from '../_shared/gcKernels/lib/walk/walkFunction.ts'

/**
 * walk — the walk kit's server half (punch list #142 PR 7; `to-dos/walk-kit/README.md`, `BUILD_PLAN.md` § PR 7). A
 * session's driver (`npm run walk`) runs the Messages loop on prod end to end, on the company's own inbox and number,
 * and this is the one place that needs a server secret: making the hidden tester account, reading and sending as
 * bids@ through the Google service account, texting from the bids number through Quo, and the kit's rows through
 * `walk_setup` / `walk_cleanup` (PR 4). The tester's own three sends (the estimate email, the estimate text, a reply)
 * go through the app's doors with the tester's session, never through here.
 *
 * POST `{ action, … }`, gated by `X-Dev-Login-Secret` equal to `DEV_LOGIN_SECRET`, the secret dev-login already
 * holds (401 otherwise; verify_jwt is off in config.toml). Every answer carries ids, times and words, never a token,
 * a key or a whole link (a link shows as its last four characters): `leakedSecret` holds back any answer that would.
 *
 *   setup        the tester when missing, then `walk_setup`; `fallback: true` takes the owner's own phone (§ 4)
 *   open         as bids@: the estimate email found, its link opened with a browser's user agent (the 👀 line)
 *   reply-email  as bids@: `words` to the team box, in the estimate email's thread
 *   text         `words` from the bids number to the team box's number, through Quo (refused in the fallback walk)
 *   seed-old     one three-day-old out text on the kit's contact, so Waiting on them can be read the same day
 *   cleanup      `walk_cleanup`: the counts, or its refusal
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dev-login-secret',
}

// deno-lint-ignore no-explicit-any
type Admin = any

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const refuse = (error: string, words: string, status: number) => json({ ok: false, error, words }, status)

/** The environment, read once per request. */
function readEnv(): Record<string, string | undefined> {
  const names = ['DEV_LOGIN_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'QUO_API_KEY']
  const out: Record<string, string | undefined> = {}
  for (const n of names) out[n] = Deno.env.get(n) ?? undefined
  return out
}

/** The values no answer may carry: the environment's secrets, and the ones minted or loaded while answering. */
type Secrets = Record<string, string | undefined>

function secretsOf(env: Record<string, string | undefined>): Secrets {
  const { DEV_LOGIN_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, QUO_API_KEY } = env
  return { DEV_LOGIN_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, QUO_API_KEY }
}

/** The tester's `users` row, made once: the auth user (found on any page, else created), then the row with its flags. */
async function ensureTester(admin: Admin): Promise<{ id: string; email: string; made: boolean }> {
  const { data: row } = await admin.from('users').select('id, email').eq('email', TESTER_EMAIL).maybeSingle()
  if (row?.id) return { id: row.id as string, email: TESTER_EMAIL, made: false }
  const found = await findAuthUserByEmail((page, perPage) => admin.auth.admin.listUsers({ page, perPage }), TESTER_EMAIL)
  if (found.error) throw new Error(`auth users: ${found.error}`)
  let id = found.user?.id as string | undefined
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TESTER_EMAIL,
      email_confirm: true,
      user_metadata: { invited_role: 'assistant', name: TESTER_NAME },
    })
    if (error || !data?.user?.id) throw new Error(`auth createUser: ${error?.message ?? 'no user'}`)
    id = data.user.id as string
  }
  // As create-user does: the row with its flags, as the service role (the guard's no-JWT branch lets it through).
  const { error: upsertError } = await admin
    .from('users')
    .upsert({ id, email: TESTER_EMAIL, name: TESTER_NAME, role: 'assistant', read_only: true, is_sample: false, is_digital_twin: false, is_walk_tester: true }, { onConflict: 'id' })
  if (upsertError) throw new Error(`users upsert: ${upsertError.message}`)
  return { id, email: TESTER_EMAIL, made: true }
}

async function loadBoxes(admin: Admin) {
  const { data } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
  return parseBoxSettings((data as { value_text: string | null } | null)?.value_text)
}

const appFromAddress = () => parseAddress(EMAIL_FROM)?.address.trim().toLowerCase() ?? ''

/** A kit, or the refusal every action but setup gives without one. */
async function needKit(admin: Admin): Promise<{ kit: WalkKit } | { response: Response }> {
  const kit = await loadWalkKit(admin)
  if (!kit) return { response: refuse('noKit', 'No walk kit is set up. Run setup first.', 409) }
  return { kit }
}

/** bids@'s token, as the reader mints it: the service account impersonating the kit's address. Kept with the secrets. */
async function bidsToken(env: Record<string, string | undefined>, secrets: Secrets, kit: WalkKit): Promise<string> {
  const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set.')
  const token = await googleServiceToken(saJson, GMAIL_SCOPES, kit.email)
  secrets.GOOGLE_TOKEN = token
  return token
}

interface EstimateMail {
  mail: EmailIn
  estimateNumber: number
}

/** The estimate email in bids@'s inbox, or null while it has not arrived. */
async function findEstimateMail(admin: Admin, token: string, kit: WalkKit): Promise<{ found: EstimateMail | null; query: string; checked: number }> {
  if (!kit.estimateId) throw new Error('The kit has no estimate.')
  const { data: est } = await admin.from('estimates').select('estimate_number').eq('id', kit.estimateId).maybeSingle()
  const estimateNumber = Number((est as { estimate_number?: number | null } | null)?.estimate_number ?? 0)
  const query = estimateMailQuery(appFromAddress(), estimateNumber)
  const list = await gmailSearch(token, query)
  let checked = 0
  for (const m of list.messages ?? []) {
    checked += 1
    const mail = readGmailMessage(await gmailMessage(token, m.id))
    if (isEstimateMail(mail, appFromAddress(), estimateNumber)) return { found: { mail, estimateNumber }, query, checked }
  }
  return { found: null, query, checked }
}

async function setup(admin: Admin, ask: WalkAsk): Promise<Response> {
  const tester = await ensureTester(admin)
  let phone: string | null = null
  if (ask.fallback) {
    if (!ask.ownerEmail) return refuse('badRequest', 'The fallback walk names the owner by email.', 400)
    const { data: owner } = await admin.from('users').select('id, phone').eq('email', ask.ownerEmail).maybeSingle()
    phone = ((owner as { phone?: string | null } | null)?.phone ?? '').trim() || null
    if (!phone) return refuse('noPhone', 'The fallback walk needs the owner’s own number on their account, and it has none.', 409)
  }
  const { data, error } = await admin.rpc('walk_setup', {
    p_tester: tester.id,
    p_app_from: appFromAddress(),
    p_phone: phone,
    p_shared_phone_ok: ask.fallback,
  })
  if (error) return refuse('setupRefused', String(error.message ?? error), 409)
  return json({ ok: true, kit: data, tester: { id: tester.id, email: tester.email, made: tester.made }, at: new Date().toISOString() })
}

async function open(admin: Admin, env: Record<string, string | undefined>, secrets: Secrets, kit: WalkKit): Promise<Response> {
  const token = await bidsToken(env, secrets, kit)
  const { found, query, checked } = await findEstimateMail(admin, token, kit)
  if (!found) return json({ ok: true, arrived: false, query, checked })
  const link = acceptLinkIn(found.mail.links)
  const arrived = {
    arrivedAt: found.mail.at,
    gmailId: found.mail.gmailId,
    threadId: found.mail.threadId,
    messageId: found.mail.headers['message-id'] ?? null,
    subject: found.mail.subject,
    estimateNumber: found.estimateNumber,
  }
  if (!link) return json({ ok: true, arrived: true, ...arrived, link: false, open: null })
  const url = `${env.SUPABASE_URL}/functions/v1/get-estimate-for-customer?token=${encodeURIComponent(link.token)}`
  const res = await fetch(url, {
    headers: { apikey: env.SUPABASE_ANON_KEY ?? '', Authorization: `Bearer ${env.SUPABASE_ANON_KEY ?? ''}`, 'User-Agent': BROWSER_USER_AGENT },
  })
  const answer = (await res.json().catch(() => null)) as { estimate_number?: number; status?: string; error?: string } | null
  return json({
    ok: true,
    arrived: true,
    ...arrived,
    link: true,
    linkTail: lastFour(link.link),
    open: { status: res.status, ok: res.ok, at: new Date().toISOString(), estimateNumber: answer?.estimate_number ?? null, error: answer?.error ?? null },
  })
}

async function replyEmail(admin: Admin, env: Record<string, string | undefined>, secrets: Secrets, kit: WalkKit, ask: WalkAsk): Promise<Response> {
  const boxes = await loadBoxes(admin)
  const team = boxes.team.address.trim()
  if (!team.includes('@')) return refuse('noTeamBox', 'Settings names no team box address, so there is nobody to reply to.', 409)
  const token = await bidsToken(env, secrets, kit)
  const { found } = await findEstimateMail(admin, token, kit)
  if (!found) return refuse('notArrived', 'The estimate email has not arrived in the bids inbox yet.', 409)
  const at = new Date().toISOString()
  const messageId = replyMessageId(kit.email, Date.now(), crypto.randomUUID())
  const raw = replyRaw({
    from: kit.email,
    to: team,
    subject: `Re: ${found.mail.subject}`,
    inReplyTo: found.mail.headers['message-id'] ?? null,
    text: ask.words ?? 'Can you do it Thursday?',
    messageId,
    at,
  })
  const sent = await gmailSend(token, raw, found.mail.threadId)
  return json({ ok: true, at, to: team, subject: `Re: ${found.mail.subject}`, messageId, gmailId: sent.id, threadId: sent.threadId })
}

async function text(admin: Admin, env: Record<string, string | undefined>, secrets: Secrets, kit: WalkKit, ask: WalkAsk): Promise<Response> {
  if (!ask.words) return refuse('badRequest', 'The text needs words.', 400)
  if (kit.sharedPhone) return refuse('fallback', 'This is the fallback walk: the owner texts from their own phone by hand.', 409)
  const boxes = await loadBoxes(admin)
  const from = boxes.bids.numberId.trim()
  const to = toE164(boxes.team.phone)
  if (!from || !to) return refuse('noNumbers', 'Settings needs the bids box’s Quo number id and the team box’s number.', 409)
  const { key } = await loadQuoApiKey(admin, (k) => env[k])
  if (!key) return refuse('noKey', 'No Quo key is set in Settings or the secrets.', 503)
  secrets.QUO_KEY = key
  const at = new Date().toISOString()
  const res = await fetch(`${QUO_API_BASE}/v1/messages`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: ask.words, from, to: [to] }),
  })
  const answer = await res.json().catch(() => null)
  const words = res.ok ? null : `Quo answered ${res.status}.`
  return json({ ok: res.ok, status: res.status, at, from: boxes.bids.phone, to, words, quoId: sentQuoId(answer) }, res.ok ? 200 : 502)
}

async function seedOld(admin: Admin, kit: WalkKit): Promise<Response> {
  const id = crypto.randomUUID()
  const columns = seedOldColumns(kit, Date.now(), id)
  if (!columns) return refuse('noPhone', 'The kit has no phone channel to seed a text on.', 409)
  const { error } = await admin.from('messages').insert(columns)
  if (error) return refuse('failed', `messages: ${error.message}`, 500)
  return json({ ok: true, id, at: columns.at, contactId: kit.contactId })
}

async function cleanup(admin: Admin): Promise<Response> {
  const { data, error } = await admin.rpc('walk_cleanup')
  if (error) return refuse('cleanupRefused', String(error.message ?? error), 409)
  return json({ ok: true, ...(data as Record<string, unknown>), at: new Date().toISOString() })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return refuse('badRequest', 'Ask with POST.', 405)
  const env = readEnv()
  const secrets = secretsOf(env)
  const secret = req.headers.get('X-Dev-Login-Secret')
  if (!env.DEV_LOGIN_SECRET || secret !== env.DEV_LOGIN_SECRET) return refuse('unauthorized', 'The dev login secret is missing or wrong.', 401)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return refuse('failed', 'The function is not set up.', 503)
  try {
    const ask = parseWalkAsk(await req.json().catch(() => null))
    if (!ask) return refuse('badRequest', 'Say which action: setup, open, reply-email, text, seed-old or cleanup.', 400)
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

    let answer: Response
    if (ask.action === 'setup') answer = await setup(admin, ask)
    else if (ask.action === 'cleanup') answer = await cleanup(admin)
    else {
      const need = await needKit(admin)
      if ('response' in need) return need.response
      if (ask.action === 'open') answer = await open(admin, env, secrets, need.kit)
      else if (ask.action === 'reply-email') answer = await replyEmail(admin, env, secrets, need.kit, ask)
      else if (ask.action === 'text') answer = await text(admin, env, secrets, need.kit, ask)
      else answer = await seedOld(admin, need.kit)
    }

    // No answer carries a secret: a key, a token, the service account, the gate.
    const body = await answer.clone().json().catch(() => null)
    const leaked = leakedSecret(body, secrets)
    if (leaked) {
      console.error(`[walk] an answer carried ${leaked}; held back`)
      return refuse('held', 'The answer was held back: it carried a secret.', 500)
    }
    return answer
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[walk]', message)
    const leaked = leakedSecret({ message }, secrets)
    return refuse('failed', leaked ? 'The step failed; the error carried a secret and was held back.' : message, 500)
  }
})
