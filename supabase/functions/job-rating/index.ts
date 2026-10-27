// job-rating (v2.5876, measuring follow-ups item 6; the review ask since v2.5934, punch list #185): the customer's own
// word, by the ask's token.
//
// GET ?t=<public_token> answers { ok, name, score, words, answered } for the /rate page, and since v2.5934 what the
// page needs around them: the job's name, the company's name and phone, the customer's language, the company's Google
// review link (for a customer's ask, while app_settings google_review_link_v1 holds an https address), whether they
// pressed it, and their portal's short address. The first GET stamps opened_at.
// POST { t, score, words? } saves the customer's tap. A later tap may change the score (the customer's word is
// theirs); answered_at keeps the first answer's time. POST { t, action: 'google' } stamps the Google press once.
// Each answer, changed score, first words and press writes the app's line into the asked contact's thread
// (`_shared/ratingThreadLine.ts`, best effort, keyed once). Service role, by the token alone — no session, like
// get-job-contract. The ask is minted by mint_customer_rating (the {rate} fill); the office reads the rows on The last
// 7 days.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { ratingJobWordFor, writeRatingThreadLine, type RatingForLine } from '../_shared/ratingThreadLine.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const TOKEN = /^[0-9a-f-]{32,80}$/i
const WORDS_MAX = 1000
/** The company's Google review link (v2.5934), a dev's to set under Settings → What customers see. */
const GOOGLE_REVIEW_LINK_KEY = 'google_review_link_v1'
/** The customer's short portal address, as `src/lib/portal/portalShortOrigin.ts` spells it. */
const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

// deno-lint-ignore no-explicit-any
type Admin = any

type RatingRow = RatingForLine & { answered_at: string | null; opened_at: string | null; google_pressed_at: string | null }

const SELECT = 'id, contact_id, job_id, customer_name, score, words, answered_at, opened_at, google_pressed_at'

/** A link a dev set that is an https address; anything else reads as not set, so the page never names Google. */
function googleLinkFrom(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return /^https:\/\/\S+$/i.test(v) ? v : null
}

/** What the page shows around the score: each read best effort, so a failed one only leaves its line off. */
async function around(admin: Admin, row: RatingRow) {
  const out = {
    jobName: null as string | null,
    company: { name: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone },
    lang: 'en' as 'en' | 'es',
    googleLink: null as string | null,
    googlePressed: row.google_pressed_at != null,
    portalUrl: null as string | null,
  }
  try {
    const [job, contact, setting] = await Promise.all([
      row.job_id ? admin.from('jobs_ledger').select('job_name').eq('id', row.job_id).maybeSingle() : Promise.resolve({ data: null }),
      row.contact_id ? admin.from('contacts').select('kind, customer_id, customer_contact_person_id').eq('id', row.contact_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('app_settings').select('value_text').eq('key', GOOGLE_REVIEW_LINK_KEY).maybeSingle(),
    ])
    out.jobName = ((job?.data as { job_name?: string | null } | null)?.job_name ?? '').trim() || null
    const c = contact?.data as { kind?: string | null; customer_id?: string | null; customer_contact_person_id?: string | null } | null
    // The Google ask is a customer's: a trade partner, an architect or a lead answering a rating sees none.
    if (c?.kind === 'customer') out.googleLink = googleLinkFrom((setting?.data as { value_text?: string | null } | null)?.value_text)
    let customerId = c?.customer_id ?? null
    if (!customerId && c?.customer_contact_person_id) {
      const person = (await admin.from('customer_contact_persons').select('customer_id').eq('id', c.customer_contact_person_id).maybeSingle()).data as { customer_id?: string | null } | null
      customerId = person?.customer_id ?? null
    }
    if (customerId) {
      const [customer, slug] = await Promise.all([
        admin.from('customers').select('language').eq('id', customerId).maybeSingle(),
        admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle(),
      ])
      if ((customer?.data as { language?: string | null } | null)?.language === 'es') out.lang = 'es'
      const s = ((slug?.data as { slug?: string | null } | null)?.slug ?? '').trim()
      if (s) out.portalUrl = `${PORTAL_SHORT_ORIGIN}${s}`
    }
  } catch (e) {
    console.error('job-rating around', e instanceof Error ? e.message : String(e))
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('t') ?? ''
      if (!TOKEN.test(token)) return json({ error: 'This link is incomplete.' }, 400)
      const { data, error } = await admin.from('customer_ratings').select(SELECT).eq('public_token', token).maybeSingle()
      if (error) return json({ error: 'The rating could not be read.' }, 500)
      if (!data) return json({ error: 'This link has expired.' }, 404)
      const row = data as RatingRow
      if (!row.opened_at) {
        const { error: openError } = await admin.from('customer_ratings').update({ opened_at: new Date().toISOString() }).eq('id', row.id).is('opened_at', null)
        if (openError) console.error('job-rating opened_at', JSON.stringify(openError))
      }
      return json({
        ok: true,
        name: firstName(row.customer_name ?? ''),
        score: row.score,
        words: row.words ?? '',
        answered: row.answered_at != null,
        ...(await around(admin, row)),
      })
    }

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { t?: unknown; score?: unknown; words?: unknown; action?: unknown }
      const token = typeof body.t === 'string' ? body.t : ''
      if (!TOKEN.test(token)) return json({ error: 'This link is incomplete.' }, 400)

      const { data, error: readError } = await admin.from('customer_ratings').select(SELECT).eq('public_token', token).maybeSingle()
      if (readError) return json({ error: 'The rating could not be read.' }, 500)
      if (!data) return json({ error: 'This link has expired.' }, 404)
      const row = data as RatingRow

      if (body.action === 'google') {
        if (!row.answered_at) return json({ error: 'Pick a score first.' }, 409)
        if (!row.google_pressed_at) {
          const { error: pressError } = await admin.from('customer_ratings').update({ google_pressed_at: new Date().toISOString() }).eq('id', row.id).is('google_pressed_at', null)
          if (pressError) console.error('job-rating google', JSON.stringify(pressError))
          else await writeRatingThreadLine(admin, row, 'google', null)
        }
        return json({ ok: true, score: row.score, words: row.words ?? '', answered: true, googlePressed: true })
      }

      const score = body.score
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) return json({ error: 'Pick a score from 1 to 5.' }, 400)
      const words = typeof body.words === 'string' ? body.words.slice(0, WORDS_MAX) : null

      const patch: Record<string, unknown> = { score, answered_at: row.answered_at ?? new Date().toISOString() }
      if (words !== null) patch.words = words
      const { error: writeError } = await admin.from('customer_ratings').update(patch).eq('id', row.id)
      if (writeError) return json({ error: 'Your answer could not be saved.' }, 500)

      // The thread's lines (v2.5934): the first answer, a score that changed, and the first words. Each keyed once.
      const saved: RatingForLine = { ...row, score, words: words ?? row.words }
      const jobWord = await ratingJobWordFor(admin, row.job_id)
      if (!row.answered_at) await writeRatingThreadLine(admin, saved, 'answered', jobWord)
      else if (row.score !== score) await writeRatingThreadLine(admin, saved, 'changed', jobWord)
      if (words !== null && words.trim() && words.trim() !== (row.words ?? '').trim()) await writeRatingThreadLine(admin, saved, 'words', jobWord)
      console.log(JSON.stringify({ event: 'customer_rating_saved', ratingId: row.id, score, first: !row.answered_at, words: Boolean(words?.trim()) }))
      return json({ ok: true, score, words: words ?? row.words ?? '', answered: true })
    }

    return json({ error: 'GET or POST.' }, 405)
  } catch (_err) {
    return json({ error: 'Your answer could not be saved.' }, 500)
  }
})
