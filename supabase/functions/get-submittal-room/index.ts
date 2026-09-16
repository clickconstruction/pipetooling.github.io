/**
 * The review room, public fetch (Submittals stage 4a — to-dos/submittals/README.md,
 * decisions 8–12). GET ?t=<token> serves the bid's shared submittal revisions in the
 * customer's words: the token is either the room's (the link the GC forwards) or a
 * person's (minted when the office named them or when they identified themselves).
 * No JWT — the token is the credential; service role behind it. Nothing about money,
 * quotes or supply houses is read, so nothing can leak.
 *
 * A view is logged unless the request is a staff open or `?preview=1`
 * (`_shared/publicViewCounting.ts`); a personal token's view also bumps the person's
 * open count. A closed room answers 410 with the closed payload so the page can say so.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { DEFAULT_TEST_REPORT_SETTINGS, parseTestReportSettings } from '../_shared/testReport.ts'
import { asRoomRole, roomCounts, roomRowsFrom, type RoomItemSource, type RoomMessage,
  type RoomRevision, type SubmittalRoomPayload } from '../_shared/submittalRoomPayload.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { sampleSubmittalRoomResponse } from '../_shared/customerSampleFixtures.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const SETTINGS_KEY = 'test_report_settings_v1'

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0]?.trim() ?? null : null
}

type RoomRow = { id: string; bid_id: string; token: string; status: string; shared_at: string | null; closed_at: string | null }
type PersonRow = { id: string; room_id: string; name: string; role: string; may_decide: boolean; closed_at: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const raw = new URL(req.url).searchParams.get('t')?.trim()
    if (!raw) return json({ error: 'Missing token' }, 400)
    // What customers see (v2.3511): the sample tokens answer with the hard-coded sample room — no row, no view stamp, no event.
    const sample = sampleStateFromToken(raw)
    if (sample) return json(sampleSubmittalRoomResponse(sample, PORTAL_COMPANY, todayYmdInAppTz()))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    // The token is the room's, or a person's on a room.
    let room: RoomRow | null = null
    let person: PersonRow | null = null
    {
      const { data } = await admin.from('bid_submittal_rooms').select('id, bid_id, token, status, shared_at, closed_at').eq('token', raw).maybeSingle()
      room = (data as RoomRow | null) ?? null
      if (!room) {
        const { data: p } = await admin.from('bid_submittal_people').select('id, room_id, name, role, may_decide, closed_at').eq('token', raw).maybeSingle()
        person = (p as PersonRow | null) ?? null
        if (person) {
          const { data: r } = await admin.from('bid_submittal_rooms').select('id, bid_id, token, status, shared_at, closed_at').eq('id', person.room_id).maybeSingle()
          room = (r as RoomRow | null) ?? null
        }
      }
    }
    if (!room) return json({ error: 'Not found' }, 404)

    const { data: bid } = await admin.from('bids').select('id, bid_number, project_name, address').eq('id', room.bid_id).maybeSingle()
    const b = bid as { bid_number: string | null; project_name: string | null; address: string | null } | null
    const { data: settingsRow } = await admin.from('app_settings').select('value_text').eq('key', SETTINGS_KEY).maybeSingle()
    let settings = DEFAULT_TEST_REPORT_SETTINGS
    try {
      const text = (settingsRow as { value_text: string | null } | null)?.value_text ?? ''
      settings = parseTestReportSettings(text.trim() ? JSON.parse(text) : null)
    } catch {
      settings = DEFAULT_TEST_REPORT_SETTINGS
    }
    const label = [b?.bid_number ? `B${b.bid_number}` : '', b?.project_name ?? ''].filter(Boolean).join(' ')
    const base = {
      bid: { label, projectName: b?.project_name ?? '', address: b?.address ?? null },
      company: { name: settings.companyName, tagline: settings.companyTagline, phone: settings.officePhone },
      person: person && !person.closed_at ? { id: person.id, name: person.name, role: asRoomRole(person.role), mayDecide: person.may_decide } : null,
    }
    const closed = room.status === 'closed' || !!room.closed_at || !!person?.closed_at
    if (closed) return json({ status: 'closed', closedAt: room.closed_at ?? person?.closed_at ?? null, ...base, revisions: [] } satisfies SubmittalRoomPayload, 410)

    // Every revision the office has shared, newest first; the newest is current.
    const { data: revs } = await admin
      .from('bid_submittals')
      .select('id, rev_number, shared_at, package_path')
      .eq('bid_id', room.bid_id)
      .not('shared_at', 'is', null)
      .order('rev_number', { ascending: false })
    const revRows = (revs ?? []) as Array<{ id: string; rev_number: number; shared_at: string | null; package_path: string | null }>
    if (revRows.length === 0) return json({ error: 'Nothing shared yet.', code: 'empty' }, 404)
    const ids = revRows.map((r) => r.id)
    const { data: items } = await admin
      .from('bid_submittal_items')
      .select('id, submittal_id, tag, sequence_order, specified_manufacturer, specified_model, specified_description, submitted_manufacturer, submitted_model, submitted_label, status, reason_kind, reason_note, lead_time_days, sheet_pages, review_decision, review_note, reviewed_by_name, reviewed_by_person_id, reviewed_at')
      .in('submittal_id', ids)
    const byRev = new Map<string, RoomItemSource[]>()
    for (const it of (items ?? []) as Array<RoomItemSource & { submittal_id: string }>) byRev.set(it.submittal_id, [...(byRev.get(it.submittal_id) ?? []), it])
    const revisions: RoomRevision[] = revRows.map((r, i) => {
      const rows = roomRowsFrom(byRev.get(r.id) ?? [])
      return { id: r.id, rev: r.rev_number, sharedAt: r.shared_at, current: i === 0, hasPackage: !!r.package_path, rows, counts: roomCounts(rows) }
    })

    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    if (viewDecision.count) {
      await admin.from('bid_submittal_events').insert({
        room_id: room.id,
        person_id: person?.id ?? null,
        submittal_id: revRows[0]?.id ?? null,
        event_type: 'view',
        metadata: { rev_number: revRows[0]?.rev_number ?? null },
        client_ip: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      })
      if (person) {
        const { data: cur } = await admin.from('bid_submittal_people').select('open_count, first_seen_at').eq('id', person.id).maybeSingle()
        const c = cur as { open_count: number; first_seen_at: string | null } | null
        const now = new Date().toISOString()
        await admin.from('bid_submittal_people').update({ open_count: (c?.open_count ?? 0) + 1, last_seen_at: now, first_seen_at: c?.first_seen_at ?? now }).eq('id', person.id)
      }
    }

    // Stage 5a: the thread, oldest first — the office reads as the company, system lines have no name.
    const { data: msgRows } = await admin
      .from('bid_submittal_messages')
      .select('id, created_at, author_kind, body, kind, tags, person_id, submittal_id, bid_submittal_people(name), bid_submittals(rev_number)')
      .eq('room_id', room.id)
      .order('created_at')
    const messages: RoomMessage[] = ((msgRows ?? []) as Array<Record<string, unknown>>).map((r) => {
      const kind = String(r.author_kind) as RoomMessage['authorKind']
      const p = r.bid_submittal_people as { name: string } | null
      const sub = r.bid_submittals as { rev_number: number } | null
      return {
        id: String(r.id),
        at: String(r.created_at),
        authorKind: kind,
        authorName: kind === 'office' ? settings.companyName : kind === 'system' || kind === 'robot' ? (p?.name ?? null) : (p?.name ?? null),
        body: String(r.body ?? ''),
        kind: String(r.kind) as RoomMessage['kind'],
        revNumber: sub?.rev_number ?? null,
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      }
    })
    let personOut = base.person
    if (person && personOut) {
      const since = new Date(Date.now() - 3600_000).toISOString()
      const { count } = await admin.from('bid_submittal_messages').select('id', { count: 'exact', head: true }).eq('person_id', person.id).in('author_kind', ['reviewer', 'watcher']).gte('created_at', since)
      personOut = { ...personOut, messagesThisHour: count ?? 0 }
    }

    return json({ status: 'open', closedAt: null, ...base, person: personOut, revisions, messages } satisfies SubmittalRoomPayload)
  } catch (e) {
    console.error('get-submittal-room', e)
    return json({ error: 'Internal error' }, 500)
  }
})
