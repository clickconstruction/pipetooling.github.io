// job-rating (v2.5876, measuring follow-ups item 6): the customer's own word, by the ask's token.
//
// GET ?t=<public_token> answers { ok, name, score, words, answered } for the /rate page; POST
// { t, score, words? } saves the customer's tap. Both run on the service role and reach one
// customer_ratings row by its token alone — no session, like get-job-contract. A later tap may
// change the score (the customer's word is theirs); answered_at keeps the first answer's time.
// The ask is minted by mint_customer_rating (the {rate} fill); the office reads the rows on
// The last 7 days.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('t') ?? ''
      if (!TOKEN.test(token)) return json({ error: 'This link is incomplete.' }, 400)
      const { data, error } = await admin
        .from('customer_ratings')
        .select('customer_name, score, words, answered_at')
        .eq('public_token', token)
        .maybeSingle()
      if (error) return json({ error: 'The rating could not be read.' }, 500)
      if (!data) return json({ error: 'This link has expired.' }, 404)
      return json({ ok: true, name: firstName(data.customer_name ?? ''), score: data.score, words: data.words ?? '', answered: data.answered_at != null })
    }

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { t?: unknown; score?: unknown; words?: unknown }
      const token = typeof body.t === 'string' ? body.t : ''
      if (!TOKEN.test(token)) return json({ error: 'This link is incomplete.' }, 400)
      const score = body.score
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) return json({ error: 'Pick a score from 1 to 5.' }, 400)
      const words = typeof body.words === 'string' ? body.words.slice(0, WORDS_MAX) : null

      const { data: row, error: readError } = await admin.from('customer_ratings').select('id, answered_at, words').eq('public_token', token).maybeSingle()
      if (readError) return json({ error: 'The rating could not be read.' }, 500)
      if (!row) return json({ error: 'This link has expired.' }, 404)

      const patch: Record<string, unknown> = { score, answered_at: row.answered_at ?? new Date().toISOString() }
      if (words !== null) patch.words = words
      const { error: writeError } = await admin.from('customer_ratings').update(patch).eq('id', row.id)
      if (writeError) return json({ error: 'Your answer could not be saved.' }, 500)
      return json({ ok: true, score, words: words ?? row.words ?? '', answered: true })
    }

    return json({ error: 'GET or POST.' }, 405)
  } catch (_err) {
    return json({ error: 'Your answer could not be saved.' }, 500)
  }
})
