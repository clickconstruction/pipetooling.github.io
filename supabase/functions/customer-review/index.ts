/**
 * The customer's review page, served (v2.5896, punch list #185). `/r/<token>` asks for the stars and a line in their
 * words after a job is paid. GET answers the page by the token's hash: who is asked, the job, the company, the
 * language, and whether it was answered already; it stamps the first open. POST takes the answer once (the stars and
 * the words), then what we could have done better, then the Google press; each writes the app's line into the
 * customer's thread, best effort. The token itself is never stored (`customer_reviews.token_hash`); a dead or unknown
 * link answers in words. No JWT: the token is the capability, as on the estimate's page.
 *
 * What customers see (Settings → What customers see): the sample tokens answer a made-up review over the live
 * company words, and a POST in sample mode writes nothing.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { SAMPLE_HOMEOWNER, sampleStateFromToken } from '../_shared/customerSample.ts'
import { writeReviewThreadLine } from '../_shared/reviewThreadLine.ts'

/** The company's Google review link, a dev's to fill under Settings → What customers see → Reviews. Empty: the page never mentions Google. */
export const GOOGLE_REVIEW_LINK_KEY = 'google_review_link_v1'
/** The customer's short portal address, as `src/lib/portal/portalShortOrigin.ts` spells it. */
const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'
const WORDS_MAX = 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

type ReviewRow = {
  id: string
  job_id: string
  customer_id: string | null
  lang: string
  token_expires_at: string
  opened_at: string | null
  answered_at: string | null
  stars: number | null
  words: string | null
  better: string | null
  google_pressed_at: string | null
  jobs_ledger: { job_name: string | null; hcp_number: string | null; click_number: string | null } | null
  customers: { name: string | null } | null
}

const SELECT = 'id, job_id, customer_id, lang, token_expires_at, opened_at, answered_at, stars, words, better, google_pressed_at, jobs_ledger(job_name, hcp_number, click_number), customers(name)'

const firstWord = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || ''

/** The job as the page names it: its name, else "job 1312", else "your job". */
function jobName(job: ReviewRow['jobs_ledger']): string {
  const name = (job?.job_name ?? '').trim()
  if (name) return name
  const number = (job?.click_number ?? job?.hcp_number ?? '').trim()
  return number ? `job ${number}` : 'your job'
}

/** A link a dev set that is an https address; anything else reads as not set. */
function googleLinkFrom(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return /^https:\/\/\S+$/i.test(v) ? v : null
}

function clean(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const one = text.replace(/\r\n?/g, '\n').trim()
  if (!one) return null
  return one.length > WORDS_MAX ? one.slice(0, WORDS_MAX) : one
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function readSettings(admin: Admin, customerId: string | null): Promise<{ googleLink: string | null; portalUrl: string | null }> {
  const [setting, slug] = await Promise.all([
    admin.from('app_settings').select('value_text').eq('key', GOOGLE_REVIEW_LINK_KEY).maybeSingle(),
    customerId ? admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const s = (slug?.data as { slug?: string | null } | null)?.slug?.trim() ?? ''
  return { googleLink: googleLinkFrom((setting?.data as { value_text?: string | null } | null)?.value_text), portalUrl: s ? `${PORTAL_SHORT_ORIGIN}${s}` : null }
}

function answerFor(row: ReviewRow, settings: { googleLink: string | null; portalUrl: string | null }) {
  return {
    ok: true,
    state: row.answered_at ? 'answered' : 'open',
    first: firstWord(row.customers?.name),
    jobName: jobName(row.jobs_ledger),
    company: { name: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone },
    lang: row.lang === 'es' ? 'es' : 'en',
    stars: row.stars,
    words: row.words,
    better: row.better,
    googleLink: settings.googleLink,
    googlePressed: Boolean(row.google_pressed_at),
    portalUrl: settings.portalUrl,
  }
}

function sampleAnswer(state: 'live' | 'done' | 'gc' | 'owner', googleLink: string | null) {
  const done = state === 'done'
  return {
    ok: true,
    state: done ? 'answered' : 'open',
    first: firstWord(SAMPLE_HOMEOWNER.name),
    jobName: 'the water heater',
    company: { name: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone },
    lang: 'en',
    stars: done ? 5 : null,
    words: done ? 'In and out in an hour, and the closet was cleaner than they found it.' : null,
    better: null,
    googleLink: googleLink ?? '#sample',
    googlePressed: false,
    portalUrl: `${PORTAL_SHORT_ORIGIN}${SAMPLE_HOMEOWNER.portalSlug}`,
    sample: true,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    let token = ''
    let body: Record<string, unknown> = {}
    if (req.method === 'GET') {
      token = new URL(req.url).searchParams.get('t')?.trim() ?? ''
    } else {
      body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
      token = typeof body.token === 'string' ? body.token.trim() : ''
    }
    if (!token) return json({ error: 'missing_token' }, 400)

    const sample = sampleStateFromToken(token)
    if (sample) {
      if (req.method === 'POST') return json({ ok: true, sample: true })
      const settings = await readSettings(admin, null)
      return json(sampleAnswer(sample, settings.googleLink))
    }

    const hash = await sha256Hex(token)
    const { data, error } = await admin.from('customer_reviews').select(SELECT).eq('token_hash', hash).maybeSingle()
    if (error) {
      console.error('customer-review lookup', JSON.stringify(error))
      return json({ error: 'lookup_failed' }, 500)
    }
    const row = data as ReviewRow | null
    if (!row) return json({ error: 'not_found' }, 404)
    const expired = !row.answered_at && Date.parse(row.token_expires_at) < Date.now()
    if (expired) return json({ error: 'expired' }, 410)

    if (req.method === 'GET') {
      if (!row.opened_at) {
        const { error: openErr } = await admin.from('customer_reviews').update({ opened_at: new Date().toISOString() }).eq('id', row.id).is('opened_at', null)
        if (openErr) console.error('customer-review opened_at', JSON.stringify(openErr))
      }
      return json(answerFor(row, await readSettings(admin, row.customer_id)))
    }

    const action = typeof body.action === 'string' ? body.action : 'answer'
    if (action === 'answer') {
      if (row.answered_at) return json({ ...answerFor(row, await readSettings(admin, row.customer_id)), alreadyAnswered: true })
      const stars = Number(body.stars)
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return json({ error: 'stars_required' }, 400)
      const lang = body.lang === 'es' ? 'es' : body.lang === 'en' ? 'en' : null
      const patch: Record<string, unknown> = { stars, words: clean(body.words), answered_at: new Date().toISOString() }
      if (lang) patch.lang = lang
      const { data: updated, error: upErr } = await admin.from('customer_reviews').update(patch).eq('id', row.id).is('answered_at', null).select(SELECT).maybeSingle()
      if (upErr) {
        console.error('customer-review answer', JSON.stringify(upErr))
        return json({ error: 'save_failed' }, 500)
      }
      const fresh = (updated as ReviewRow | null) ?? { ...row, ...patch, answered_at: String(patch.answered_at) }
      await writeReviewThreadLine(admin, { reviewId: row.id, kind: 'answered' })
      console.log(JSON.stringify({ event: 'customer_review_answered', reviewId: row.id, stars }))
      return json(answerFor(fresh, await readSettings(admin, row.customer_id)))
    }
    if (action === 'better') {
      if (!row.answered_at) return json({ error: 'not_answered' }, 409)
      const better = clean(body.better)
      if (!better) return json({ error: 'better_required' }, 400)
      const { error: upErr } = await admin.from('customer_reviews').update({ better }).eq('id', row.id)
      if (upErr) {
        console.error('customer-review better', JSON.stringify(upErr))
        return json({ error: 'save_failed' }, 500)
      }
      await writeReviewThreadLine(admin, { reviewId: row.id, kind: 'better' })
      return json(answerFor({ ...row, better }, await readSettings(admin, row.customer_id)))
    }
    if (action === 'google') {
      if (!row.answered_at) return json({ error: 'not_answered' }, 409)
      if (!row.google_pressed_at) {
        const at = new Date().toISOString()
        const { error: upErr } = await admin.from('customer_reviews').update({ google_pressed_at: at }).eq('id', row.id).is('google_pressed_at', null)
        if (upErr) console.error('customer-review google', JSON.stringify(upErr))
        else await writeReviewThreadLine(admin, { reviewId: row.id, kind: 'google' })
        row.google_pressed_at = at
      }
      return json(answerFor(row, await readSettings(admin, row.customer_id)))
    }
    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error('customer-review', e instanceof Error ? e.message : String(e))
    return json({ error: 'Internal error' }, 500)
  }
})
