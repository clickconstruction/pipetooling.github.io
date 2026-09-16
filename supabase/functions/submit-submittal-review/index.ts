/**
 * The review room's writes (Submittals stage 4a-ii — decisions 8–12). POST JSON with an
 * `action`:
 *   - `identify` { token (room or personal), name, email, role, viaToken?, website (honeypot) }
 *     → the person on the room (attached to a pre-named row by email, the same person again
 *     on their own link, or a new row — `forwarded` when they arrived on someone else's
 *     personal link) and their personal token. An `identified` event.
 *   - `decide`   { token (personal), submittalId, decisions: [{ itemId, decision, note? }] }
 *     → the items' review columns with the person's name, email and id; refused when the
 *     room or the person's link is closed (410), the person is marked watching (403), the
 *     revision is not the newest shared one (409 stale_revision), or the rows are not on
 *     that revision (404). A `decided` event with the counts.
 * No JWT — the token is the credential; service role behind it (the sign-bid-room pattern).
 * The rules live in `_shared/submittalReviewActions.ts`, tested from the app.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decideVerdict, decisionCounts, IDENTIFY_PER_HOUR, parseDecideBody, parseIdentifyBody, resolveIdentify } from '../_shared/submittalReviewActions.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0]?.trim() ?? null : null
}
function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

type RoomRow = { id: string; bid_id: string; status: string; closed_at: string | null }
type PersonRow = { id: string; room_id: string; name: string; email: string; role: string; may_decide: boolean; token: string | null; closed_at: string | null; first_seen_at: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action

    const roomByToken = async (t: string): Promise<{ room: RoomRow | null; person: PersonRow | null }> => {
      const { data } = await admin.from('bid_submittal_rooms').select('id, bid_id, status, closed_at').eq('token', t).maybeSingle()
      if (data) return { room: data as RoomRow, person: null }
      const { data: p } = await admin.from('bid_submittal_people').select('id, room_id, name, email, role, may_decide, token, closed_at, first_seen_at').eq('token', t).maybeSingle()
      const person = (p as PersonRow | null) ?? null
      if (!person) return { room: null, person: null }
      const { data: r } = await admin.from('bid_submittal_rooms').select('id, bid_id, status, closed_at').eq('id', person.room_id).maybeSingle()
      return { room: (r as RoomRow | null) ?? null, person }
    }

    if (action === 'identify') {
      const parsed = parseIdentifyBody(body)
      if (!parsed.ok) return json({ error: parsed.error }, 400)
      const v = parsed.value
      if (v.honeypot) return json({ ok: true, personToken: newToken(), person: { id: 'x', name: v.name, role: v.role, mayDecide: false } })
      const { room, person: viaPerson } = await roomByToken(v.token)
      if (!room) return json({ error: 'This link is no longer active.' }, 404)
      if (room.status === 'closed' || room.closed_at) return json({ error: 'This review is closed.', code: 'closed' }, 410)
      // A gentle cap: identifications from one address on one room per hour.
      const ip = clientIp(req)
      if (ip) {
        const since = new Date(Date.now() - 3600_000).toISOString()
        const { count } = await admin.from('bid_submittal_events').select('id', { count: 'exact', head: true }).eq('room_id', room.id).eq('event_type', 'identified').eq('client_ip', ip).gte('occurred_at', since)
        if ((count ?? 0) >= IDENTIFY_PER_HOUR) return json({ error: 'Too many sign-ins from this address — try again in an hour.' }, 429)
      }
      const { data: existing } = await admin.from('bid_submittal_people').select('id, token, closed_at').eq('room_id', room.id).ilike('email', v.email).maybeSingle()
      const ex = existing as { id: string; token: string | null; closed_at: string | null } | null
      const res = resolveIdentify({ existingByEmail: ex && !ex.closed_at ? { id: ex.id } : null, viaPerson: viaPerson && !viaPerson.closed_at ? { id: viaPerson.id, email: viaPerson.email } : null, email: v.email })
      const now = new Date().toISOString()
      let personId: string
      let token: string
      if (res.kind === 'existing') {
        personId = res.personId
        const { data: cur } = await admin.from('bid_submittal_people').select('token, first_seen_at, name').eq('id', personId).maybeSingle()
        const c = cur as { token: string | null; first_seen_at: string | null; name: string } | null
        token = c?.token ?? newToken()
        await admin.from('bid_submittal_people').update({ token, first_seen_at: c?.first_seen_at ?? now, last_seen_at: now, ...(c?.name?.trim() ? {} : { name: v.name }) }).eq('id', personId)
      } else {
        token = newToken()
        const { data: ins, error } = await admin
          .from('bid_submittal_people')
          .insert({ room_id: room.id, name: v.name, email: v.email, role: v.role, may_decide: true, token, how: res.how, first_seen_at: now, last_seen_at: now })
          .select('id')
          .single()
        if (error) throw error
        personId = (ins as { id: string }).id
      }
      // The opens this browser made before saying who it was (the same IP, the last half
      // hour) become this person's — the trail then reads "opened · decided", not
      // "not opened yet · decided" beside an anonymous open.
      if (ip) {
        const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        await admin.from('bid_submittal_events').update({ person_id: personId }).eq('room_id', room.id).eq('event_type', 'view').is('person_id', null).eq('client_ip', ip).gte('occurred_at', recent)
      }
      const { data: person } = await admin.from('bid_submittal_people').select('id, name, role, may_decide').eq('id', personId).maybeSingle()
      await admin.from('bid_submittal_events').insert({ room_id: room.id, person_id: personId, event_type: 'identified', metadata: { how: res.kind === 'existing' ? 'existing' : res.how, role: v.role, via: viaPerson?.id ?? null }, client_ip: ip, user_agent: req.headers.get('user-agent') })
      const p = person as { id: string; name: string; role: string; may_decide: boolean } | null
      return json({ ok: true, personToken: token, person: p ? { id: p.id, name: p.name, role: p.role, mayDecide: p.may_decide } : null })
    }

    if (action === 'decide') {
      const parsed = parseDecideBody(body)
      if (!parsed.ok) return json({ error: parsed.error }, 400)
      const v = parsed.value
      const { room, person } = await roomByToken(v.token)
      if (!room || !person) return json({ error: 'Tell us who you are first.', code: 'identify' }, 401)
      const { data: sub } = await admin.from('bid_submittals').select('id, bid_id, rev_number, shared_at').eq('id', v.submittalId).maybeSingle()
      const s = sub as { id: string; bid_id: string; rev_number: number; shared_at: string | null } | null
      const { data: newest } = await admin.from('bid_submittals').select('id').eq('bid_id', room.bid_id).not('shared_at', 'is', null).order('rev_number', { ascending: false }).limit(1).maybeSingle()
      const verdict = decideVerdict({
        roomStatus: room.closed_at ? 'closed' : room.status,
        personClosed: !!person.closed_at,
        mayDecide: person.may_decide,
        submittalBelongs: !!s && s.bid_id === room.bid_id,
        submittalShared: !!s?.shared_at,
        currentSubmittalId: (newest as { id: string } | null)?.id ?? null,
        submittalId: v.submittalId,
      })
      if (!verdict.ok) return json({ error: verdict.error, code: verdict.code }, verdict.status)
      const ids = v.decisions.map((d) => d.itemId)
      const { data: rows } = await admin.from('bid_submittal_items').select('id').eq('submittal_id', v.submittalId).in('id', ids)
      const onRevision = new Set(((rows ?? []) as Array<{ id: string }>).map((r) => r.id))
      const applied = v.decisions.filter((d) => onRevision.has(d.itemId))
      if (applied.length === 0) return json({ error: 'Those rows are not on this revision.', code: 'not_found' }, 404)
      const now = new Date().toISOString()
      for (const d of applied) {
        const { error } = await admin
          .from('bid_submittal_items')
          .update({ review_decision: d.decision, review_note: d.note, reviewed_by_name: person.name, reviewed_by_email: person.email, reviewed_by_person_id: person.id, reviewed_at: now })
          .eq('id', d.itemId)
        if (error) throw error
      }
      const counts = decisionCounts(applied)
      await admin.from('bid_submittal_events').insert({ room_id: room.id, person_id: person.id, submittal_id: v.submittalId, event_type: 'decided', metadata: { ...counts, rev_number: s?.rev_number ?? null }, client_ip: clientIp(req), user_agent: req.headers.get('user-agent') })
      await admin.from('bid_submittal_people').update({ last_seen_at: now }).eq('id', person.id)
      return json({ ok: true, decided: applied.length, counts })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('submit-submittal-review', e)
    return json({ error: 'Internal error' }, 500)
  }
})
