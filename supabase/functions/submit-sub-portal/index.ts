import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { parseScopeExtras } from '../_shared/subPortalStatement.ts'
import { canChangePick, evaluatePick, pickProblemMessage, pickWindowFor } from '../_shared/subPick.ts'
import { notifyJobWatchers } from '../_shared/jobWatchers.ts'

/**
 * Sub portal intake (sub-portal train): everything a sub can DO from the
 * no-login portal, token-authenticated like submit-portal-request.
 *
 * kinds:
 *  - availability   → dispatch_requests row + notify fan-out (customer-portal
 *                     request precedent)
 *  - accept_offer   → sign-to-accept: validates the offered commitment,
 *                     stores the signature (row stamp = record of truth,
 *                     PNG best-effort audit copy in contract-signer-signatures
 *                     under commitments/<id>/), transitions offered→accepted,
 *                     drops a dispatch note so the office inbox hears it
 *  - decline_offer  → offered→declined with the required reason + dispatch note
 *  - sign_link      → mints a fresh /contract/accept token for one of the
 *                     sub's own unsigned documents (send-contract-for-signature
 *                     mint pattern, no email)
 *  - accept_offer   → v2.2789: sheet work orders carry acknowledgements in
 *                     offer_scope_snapshot; every one must come back ticked and
 *                     is stamped into signer_acknowledgements with the signature
 *  - mark_work_done → v2.2767: the sub says one of their own sheets is done —
 *                     stage working → walkthrough (source = portal, optional
 *                     note), the stage trigger posts to the job's Activity
 *                     feed, and a dispatch note tells the office to walk it
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact our office.'
const SIGNATURE_BUCKET = 'contract-signer-signatures'
const MAX_SIGNATURE_BYTES = 524288
const MAX_PER_HOUR = 5

const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false
  }
  return true
}

function decodeBase64PngBytes(raw: string): Uint8Array | null {
  const trimmed = raw.trim()
  const m = /^data:image\/png;base64,(.+)$/i.exec(trimmed)
  let b64: string | null = null
  if (m?.[1]) {
    b64 = m[1]
  } else if (!trimmed.startsWith('data:')) {
    b64 = trimmed
  }
  if (b64 == null || b64 === '') return null
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

type SubLink = { id: string; person_id: string; created_by: string | null; revoked_at: string | null }

/** The span an order is picked against: its stage's window, else the span the office typed. */
async function pickWindowForOrder(admin: SupabaseClient, c: { stage_window_id?: string | null; proposed_start: string | null; proposed_end: string | null }) {
  let window_start: string | null = null, window_end: string | null = null
  if (c.stage_window_id) {
    const { data } = await admin.from('job_stage_windows').select('window_start, window_end').eq('id', c.stage_window_id).maybeSingle()
    const w = data as { window_start: string | null; window_end: string | null } | null
    window_start = w?.window_start ?? null
    window_end = w?.window_end ?? null
  }
  return pickWindowFor({ window_start, window_end, proposed_start: c.proposed_start, proposed_end: c.proposed_end })
}

/** Write the pick on the order and mirror it where the office reads dates: the sheet's date, the step's schedule. */
async function writePick(admin: SupabaseClient, c: { id: string; labor_job_id: string | null; step_id: string | null }, start: string, end: string): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const { error } = await admin.from('step_commitments').update({ picked_start: start, picked_end: end, picked_at: nowIso, picked_by: 'sub' }).eq('id', c.id)
  if (error) {
    console.error('sub pick write failed', error)
    return false
  }
  if (c.labor_job_id) await admin.from('people_labor_jobs').update({ job_date: start }).eq('id', c.labor_job_id)
  if (c.step_id) await admin.from('project_workflow_steps').update({ scheduled_start_date: start, scheduled_end_date: end }).eq('id', c.step_id)
  return true
}

const ymdField = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

async function resolveLink(admin: SupabaseClient, token: string): Promise<SubLink | null> {
  let { data: link } = await admin
    .from('sub_portal_links')
    .select('id, person_id, created_by, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) {
    const tokenHash = await sha256Hex(token)
    link = (await admin
      .from('sub_portal_links')
      .select('id, person_id, created_by, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()).data
  }
  if (!link || (link as SubLink).revoked_at) return null
  return link as SubLink
}

/** dispatch_requests.from_user_id is NOT NULL — same fallback chain as the customer intake. */
async function resolveFromUserId(admin: SupabaseClient, link: SubLink): Promise<string | null> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', 'portal_requests_from_user_id')
    .maybeSingle()
  const configured = ((setting as { value_text?: string | null } | null)?.value_text ?? '').trim()
  if (/^[0-9a-f-]{36}$/.test(configured)) return configured
  if (link.created_by) return link.created_by
  const { data: dev } = await admin.from('users').select('id').eq('role', 'dev').limit(1).maybeSingle()
  return (dev as { id?: string } | null)?.id ?? null
}

async function insertDispatchNote(
  admin: SupabaseClient,
  link: SubLink,
  title: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const fromUserId = await resolveFromUserId(admin, link)
  if (!fromUserId) return
  const { data: inserted, error } = await admin
    .from('dispatch_requests')
    .insert({
      from_user_id: fromUserId,
      title,
      pending_payload: { source: 'sub_portal', subPortalLinkId: link.id, ...payload },
    })
    .select('id')
    .single()
  if (error || !inserted) {
    console.error('sub portal dispatch note failed', error)
    return
  }
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/notify-dispatch-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch_request_id: (inserted as { id: string }).id }),
    })
  } catch (e) {
    console.error('notify-dispatch-request call failed', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return jsonResponse({ error: 'Bad request' }, 400)

    // Honeypot: real subs never fill a field their browser hides.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return jsonResponse({ ok: true })
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const kind = typeof body.kind === 'string' ? body.kind : ''
    if (!token || token.length < 16 || token.length > 128) {
      return jsonResponse({ error: 'Bad request' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const link = await resolveLink(admin, token)
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: person } = await admin.from('people').select('id, name').eq('id', link.person_id).maybeSingle()
    const personName = ((person as { name?: string | null } | null)?.name ?? '').trim() || 'Subcontractor'

    // ── availability ──────────────────────────────────────────────────────
    if (kind === 'availability') {
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
      if (description.length < 5 || description.length > 2000) {
        return jsonResponse({ error: 'Tell us a little more — a sentence is plenty.' }, 400)
      }
      const hourAgo = new Date(Date.now() - 3600_000).toISOString()
      const { count: recent } = await admin
        .from('dispatch_requests')
        .select('id', { count: 'exact', head: true })
        .eq('pending_payload->>subPortalLinkId', String(link.id))
        .gte('created_at', hourAgo)
      if ((recent ?? 0) >= MAX_PER_HOUR) {
        return jsonResponse({ error: 'That is a lot at once — give us an hour, or call the office.' }, 429)
      }
      await insertDispatchNote(admin, link, `Sub availability — ${personName}: ${description.slice(0, 120)}`, {
        kind: 'availability',
        personId: link.person_id,
        personName,
        description,
        phone: phone || null,
      })
      return jsonResponse({ ok: true })
    }

    // ── day_off (v2.2930): mark or take back a day off; a day under a pick tells the office ──
    if (kind === 'day_off') {
      const day = ymdField(body.day)
      const off = body.off === true
      if (!day) return jsonResponse({ error: 'Bad request' }, 400)
      const todayYmd = todayYmdInAppTz()
      if (day < todayYmd) return jsonResponse({ error: 'That day is already behind us.' }, 400)
      if (off) {
        const { error } = await admin.from('person_availability').upsert({ person_id: link.person_id, day, kind: 'off', source: 'portal' }, { onConflict: 'person_id,day' })
        if (error) {
          console.error('day_off upsert failed', error)
          return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
        }
        const { data: hits } = await admin
          .from('step_commitments')
          .select('id, job_id, labor_job_id, offer_scope_snapshot, job:job_id(hcp_number)')
          .eq('person_id', link.person_id)
          .in('status', ['accepted', 'approved'])
          .lte('picked_start', day)
          .gte('picked_end', day)
          .limit(5)
        const collisions = (hits ?? []) as Array<{ id: string; job_id: string | null; labor_job_id: string | null; offer_scope_snapshot: unknown; job: { hcp_number: string | null } | { hcp_number: string | null }[] | null }>
        if (collisions.length > 0) {
          const first = collisions[0]!
          const job = Array.isArray(first.job) ? first.job[0] ?? null : first.job
          const label = parseScopeExtras(first.offer_scope_snapshot).sheetLabel ?? (job?.hcp_number ? `#${job.hcp_number}` : 'a work order')
          await insertDispatchNote(admin, link, `${personName} marked ${day} off — ${label} is scheduled over it`, {
            kind: 'sub_day_off_collision',
            personId: link.person_id,
            personName,
            day,
            commitmentId: first.id,
            laborJobId: first.labor_job_id,
            jobId: first.job_id,
            collisions: collisions.length,
          })
        }
        return jsonResponse({ ok: true, collisions: collisions.length })
      }
      const { error } = await admin.from('person_availability').delete().eq('person_id', link.person_id).eq('day', day)
      if (error) {
        console.error('day_off delete failed', error)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      }
      return jsonResponse({ ok: true, collisions: 0 })
    }

    // ── sign_link: fresh signing token for one of the sub's own documents ─
    if (kind === 'sign_link') {
      const docId = typeof body.documentId === 'string' && /^[0-9a-f-]{36}$/.test(body.documentId) ? body.documentId : null
      if (!docId) return jsonResponse({ error: 'Bad request' }, 400)
      const { data: doc } = await admin
        .from('person_contract_documents')
        .select('id, status, person_id, person_name')
        .eq('id', docId)
        .maybeSingle()
      const docRow = doc as { id: string; status: string; person_id: string | null; person_name: string | null } | null
      const mine =
        docRow != null &&
        (docRow.person_id === link.person_id ||
          (docRow.person_id == null && (docRow.person_name ?? '').trim() === personName))
      if (!docRow || !mine) return jsonResponse({ error: 'Not found' }, 404)
      if (docRow.status !== 'unsent' && docRow.status !== 'sent') {
        return jsonResponse({ error: 'This document is already signed.' }, 400)
      }
      // send-contract-for-signature mint pattern (no email): a fresh token
      // replaces any prior one — the newest signing link wins.
      const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
      const tokenHash = await sha256Hex(rawToken)
      const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
      const { error: updErr } = await admin
        .from('person_contract_documents')
        .update({
          status: 'sent',
          sent_at: docRow.status === 'unsent' ? new Date().toISOString() : undefined,
          public_token_hash: tokenHash,
          public_token_expires_at: expiresAt,
        })
        .eq('id', docRow.id)
      if (updErr) {
        console.error('sub portal sign_link mint failed', updErr)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      }
      return jsonResponse({ ok: true, signPath: `/contract/accept?t=${rawToken}` })
    }

    // ── mark_work_done: the sub's one button on a job card ────────────────
    if (kind === 'mark_work_done') {
      const laborJobId = typeof body.laborJobId === 'string' && /^[0-9a-f-]{36}$/.test(body.laborJobId) ? body.laborJobId : null
      if (!laborJobId) return jsonResponse({ error: 'Bad request' }, 400)
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
      // The sheet must be one of THIS person's (junction-first, the same
      // scoping the statement uses) — never another sub's money.
      const { data: junction } = await admin
        .from('people_labor_job_assignees')
        .select('labor_job_id')
        .eq('labor_job_id', laborJobId)
        .eq('person_id', link.person_id)
        .maybeSingle()
      if (!junction) return jsonResponse({ error: 'Not found' }, 404)
      const { data: sheet } = await admin
        .from('people_labor_jobs')
        .select('id, stage, job_number, job_ledger_id, address')
        .eq('id', laborJobId)
        .maybeSingle()
      const sheetRow = sheet as { id: string; stage: string | null; job_number: string | null; job_ledger_id: string | null; address: string | null } | null
      if (!sheetRow) return jsonResponse({ error: 'Not found' }, 404)
      if ((sheetRow.stage ?? 'working') !== 'working') {
        return jsonResponse({ error: 'This job is already past the work stage — call the office if something changed.' }, 409)
      }
      const nowIso = new Date().toISOString()
      const { data: moved, error: moveErr } = await admin
        .from('people_labor_jobs')
        .update({
          stage: 'walkthrough',
          stage_changed_at: nowIso,
          stage_changed_by: null,
          stage_source: 'portal',
          stage_note: note || null,
          progress_pct: 100,
          progress_at: nowIso,
          progress_source: 'portal',
          ...(note ? { progress_note: note } : {}),
        })
        .eq('id', sheetRow.id)
        .eq('stage', 'working')
        .select('id')
      if (moveErr || !moved || moved.length === 0) {
        console.error('sub portal mark_work_done failed', moveErr)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, moveErr ? 500 : 409)
      }
      const where = [sheetRow.job_number, sheetRow.address].map((v) => (v ?? '').trim()).filter(Boolean).join(' ')
      // v2.3071: the sheet's job link, not a number match.
      {
        const jobId = sheetRow.job_ledger_id
        if (jobId) await notifyJobWatchers(admin, { jobId, kind: 'done', subName: personName, line: `${personName} says their work is done — call it in for inspection`, detail: note || null })
      }
      await insertDispatchNote(admin, link, `Ready to walk — ${personName} · ${where || 'sub sheet'}`, {
        kind: 'sub_work_done',
        personId: link.person_id,
        personName,
        laborJobId: sheetRow.id,
        jobNumber: sheetRow.job_number,
        address: sheetRow.address,
        note: note || null,
        markedAt: nowIso,
      })
      return jsonResponse({ ok: true, stage: 'walkthrough', stageChangedOn: todayYmdInAppTz() })
    }

    // ── progress (v2.2931): how far along their part is; 100 goes through mark_work_done ──
    if (kind === 'progress') {
      const laborJobId = typeof body.laborJobId === 'string' && /^[0-9a-f-]{36}$/.test(body.laborJobId) ? body.laborJobId : null
      const pctRaw = Number(body.pct)
      const pct = [0, 25, 50, 75].includes(pctRaw) ? pctRaw : null
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
      if (!laborJobId || (pct == null && !note)) return jsonResponse({ error: 'Bad request' }, 400)
      const { data: junction } = await admin.from('people_labor_job_assignees').select('labor_job_id').eq('labor_job_id', laborJobId).eq('person_id', link.person_id).maybeSingle()
      if (!junction) return jsonResponse({ error: 'Not found' }, 404)
      const { data: sheet } = await admin.from('people_labor_jobs').select('id, stage, job_number, job_ledger_id, address, step_id, progress_pct').eq('id', laborJobId).maybeSingle()
      const sheetRow = sheet as { id: string; stage: string | null; job_number: string | null; job_ledger_id: string | null; address: string | null; step_id: string | null; progress_pct: number | null } | null
      if (!sheetRow) return jsonResponse({ error: 'Not found' }, 404)
      if ((sheetRow.stage ?? 'working') !== 'working') return jsonResponse({ error: 'This job is already past the work stage — call the office if something changed.' }, 409)
      const nowIso = new Date().toISOString()
      const effectivePct = pct ?? sheetRow.progress_pct ?? 0
      const { error: updErr } = await admin
        .from('people_labor_jobs')
        .update({ progress_pct: effectivePct, progress_at: nowIso, progress_source: 'portal', ...(note ? { progress_note: note } : {}) })
        .eq('id', sheetRow.id)
      if (updErr) {
        console.error('sub progress update failed', updErr)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      }
      if (sheetRow.step_id && pct != null) await admin.from('project_workflow_steps').update({ percent_complete: pct }).eq('id', sheetRow.step_id)
      // The job's activity feed hears every report (the watchers' emails read it later).
      // v2.3071: the sheet's job link, not a number match.
      {
        const jobId = sheetRow.job_ledger_id
        if (jobId) {
          await admin.from('job_activity_events').insert({
            job_id: jobId,
            event_type: 'sub_progress',
            summary: pct != null ? `${personName} · ${pct}% along on their part${note ? ` — “${note}”` : ''}` : `${personName} sent a note from their portal — “${note}”`,
            detail: { laborJobId: sheetRow.id, pct: effectivePct, note: note || null, source: 'portal', address: sheetRow.address },
            financial: false,
          })
          await notifyJobWatchers(admin, { jobId, kind: 'progress', subName: personName, line: pct != null ? `${personName} · ${pct}% along on their part` : `${personName} sent a note from their portal`, detail: note || null })
        }
      }
      // Dispatch hears a note, never a bare percent.
      if (note) {
        const where = [sheetRow.job_number, sheetRow.address].map((v) => (v ?? '').trim()).filter(Boolean).join(' ')
        await insertDispatchNote(admin, link, `${personName} on ${where || 'a sub sheet'}: “${note.slice(0, 120)}”`, {
          kind: 'sub_note',
          personId: link.person_id,
          personName,
          laborJobId: sheetRow.id,
          jobNumber: sheetRow.job_number,
          address: sheetRow.address,
          pct: effectivePct,
          note,
        })
      }
      return jsonResponse({ ok: true, pct: effectivePct, progressOn: todayYmdInAppTz() })
    }

    // ── accept_offer / decline_offer ──────────────────────────────────────
    if (kind === 'accept_offer' || kind === 'decline_offer') {
      const commitmentId =
        typeof body.commitmentId === 'string' && /^[0-9a-f-]{36}$/.test(body.commitmentId) ? body.commitmentId : null
      if (!commitmentId) return jsonResponse({ error: 'Bad request' }, 400)

      const { data: commitment } = await admin
        .from('step_commitments')
        .select('id, person_id, status, amount, offer_expires_at, offer_scope_snapshot, labor_job_id, step_id, job_id, proposed_start, proposed_end, stage_window_id, work_days')
        .eq('id', commitmentId)
        .maybeSingle()
      const c = commitment as
        | { id: string; person_id: string; status: string; amount: number | null; offer_expires_at: string | null; offer_scope_snapshot: unknown; labor_job_id: string | null; step_id: string | null; job_id: string | null; proposed_start: string | null; proposed_end: string | null; stage_window_id: string | null; work_days: number | null }
        | null
      if (!c || c.person_id !== link.person_id) return jsonResponse({ error: 'Not found' }, 404)
      if (c.status !== 'offered') {
        return jsonResponse({ error: 'This work order is no longer open.' }, 409)
      }
      const todayYmd = todayYmdInAppTz()
      if ((c.offer_expires_at ?? '') !== '' && (c.offer_expires_at as string) < todayYmd) {
        return jsonResponse({ error: 'This offer has expired — call the office if you still want it.' }, 409)
      }

      if (kind === 'decline_offer') {
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
        if (!reason) return jsonResponse({ error: 'Tell us why so we can fix it — a few words is fine.' }, 400)
        const { error: updErr } = await admin
          .from('step_commitments')
          .update({ status: 'declined', declined_at: new Date().toISOString(), decline_reason: reason })
          .eq('id', c.id)
          .eq('status', 'offered')
        if (updErr) {
          console.error('sub portal decline failed', updErr)
          return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
        }
        await insertDispatchNote(admin, link, `Work order declined — ${personName}: ${reason.slice(0, 120)}`, {
          kind: 'sub_offer_declined',
          personId: link.person_id,
          personName,
          commitmentId: c.id,
          reason,
        })
        return jsonResponse({ ok: true })
      }

      // accept_offer — sign to accept.
      const printedName = typeof body.printedName === 'string' ? body.printedName.trim().slice(0, 200) : ''
      const agreed = body.agreedTerms === true
      const sigRaw = typeof body.signaturePngBase64 === 'string' ? body.signaturePngBase64 : ''
      const hasSig = sigRaw.trim().length > 0
      if (!printedName) return jsonResponse({ error: 'Please enter your full name.' }, 400)
      if (!agreed) return jsonResponse({ error: 'Please confirm that you agree.' }, 400)

      // v2.2928: an order with a window is signed WITH a start inside it.
      const pickWindow = await pickWindowForOrder(admin, c)
      const pickedStart = ymdField(body.pickedStart)
      const pickedEnd = ymdField(body.pickedEnd) ?? pickedStart
      let pick: { start: string; end: string } | null = null
      if (pickWindow) {
        if (!pickedStart || !pickedEnd) return jsonResponse({ error: 'Pick your start day inside the window before signing.' }, 400)
        const verdict = evaluatePick({ window: pickWindow, start: pickedStart, end: pickedEnd, todayYmd })
        if (!verdict.ok) return jsonResponse({ error: pickProblemMessage(verdict.reason) }, 400)
        pick = { start: verdict.start, end: verdict.end }
      } else if (pickedStart && pickedEnd) {
        const verdict = evaluatePick({ window: null, start: pickedStart, end: pickedEnd, todayYmd })
        if (verdict.ok) pick = { start: verdict.start, end: verdict.end }
      }

      // v2.2789: the work order's acknowledgements must all come back ticked.
      const required = parseScopeExtras(c.offer_scope_snapshot).acknowledgements
      const ticked = Array.isArray(body.acknowledgements)
        ? (body.acknowledgements as unknown[]).map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : '')).filter(Boolean)
        : []
      const missing = required.filter((r) => !ticked.includes(r.trim().toLowerCase()))
      if (missing.length > 0) {
        return jsonResponse({ error: 'Please tick every confirmation box before signing.' }, 400)
      }
      const nowIsoForAcks = new Date().toISOString()
      const signerAcknowledgements = required.map((text) => ({ text, acknowledgedAt: nowIsoForAcks }))

      let storagePath: string | null = null
      if (hasSig) {
        const bytes = decodeBase64PngBytes(sigRaw)
        if (!bytes || bytes.length === 0 || bytes.length > MAX_SIGNATURE_BYTES || !isPng(bytes)) {
          return jsonResponse({ error: 'Invalid or oversized signature image' }, 400)
        }
        storagePath = `commitments/${c.id}/${crypto.randomUUID()}.png`
        const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(storagePath, bytes, {
          contentType: 'image/png',
          upsert: false,
        })
        if (upErr) {
          console.error('sub portal signature upload failed', upErr)
          return jsonResponse({ error: 'Could not store signature' }, 500)
        }
      }

      const ua = req.headers.get('user-agent') ?? null
      const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      const ipRaw = fwd || req.headers.get('cf-connecting-ip') || null
      const nowIso = new Date().toISOString()

      const { data: updatedRows, error: updErr } = await admin
        .from('step_commitments')
        .update({
          status: 'accepted',
          accepted_at: nowIso,
          signed_at: nowIso,
          signer_printed_name: printedName,
          signer_signature_mode: hasSig ? 'draw' : 'type',
          signer_signature_storage_path: storagePath,
          signer_consented_at: nowIso,
          signer_ip: ipRaw,
          signer_user_agent: ua,
          signer_acknowledgements: signerAcknowledgements.length > 0 ? signerAcknowledgements : null,
        })
        .eq('id', c.id)
        .eq('status', 'offered')
        .select('id')
      if (updErr || !updatedRows || updatedRows.length === 0) {
        console.error('sub portal accept failed', updErr)
        if (storagePath) {
          await admin.storage.from(SIGNATURE_BUCKET).remove([storagePath])
        }
        return jsonResponse({ error: 'Could not record the signature. Please try again.' }, updErr ? 500 : 409)
      }

      // v2.2819: signing a job-anchored order creates its Sub Labor sheet (idempotent RPC).
      let createdSheetId: string | null = null
      if (!c.labor_job_id && c.job_id) {
        const { data: created, error: createErr } = await admin.rpc('create_sheet_for_work_order', { p_commitment_id: c.id })
        if (createErr) console.error('create_sheet_for_work_order failed', createErr)
        const cr = created as { ok?: boolean; labor_job_id?: string | null; error?: string } | null
        if (cr?.error) console.error('create_sheet_for_work_order refused', cr.error)
        createdSheetId = cr?.labor_job_id ?? null
      }

      if (pick) {
        await writePick(admin, { id: c.id, labor_job_id: c.labor_job_id ?? createdSheetId, step_id: c.step_id }, pick.start, pick.end)
        if (c.job_id) await notifyJobWatchers(admin, { jobId: c.job_id, kind: 'dates', subName: personName, line: `${personName} signed and picked ${pick.start} → ${pick.end}`, detail: parseScopeExtras(c.offer_scope_snapshot).sheetLabel ?? null })
      }

      const sheetLabel = parseScopeExtras(c.offer_scope_snapshot).sheetLabel
      await insertDispatchNote(
        admin,
        link,
        `Work order signed & accepted — ${personName} ($${Number(c.amount ?? 0).toFixed(2)})${sheetLabel ? ` · ${sheetLabel}` : ''}${pick ? ` · picked ${pick.start} → ${pick.end}` : ''}`,
        {
          kind: 'sub_offer_accepted',
          personId: link.person_id,
          personName,
          commitmentId: c.id,
          laborJobId: c.labor_job_id ?? createdSheetId,
          jobId: c.job_id,
          signedAt: nowIso,
          pickedStart: pick?.start ?? null,
          pickedEnd: pick?.end ?? null,
        },
      )
      return jsonResponse({ ok: true, pickedStart: pick?.start ?? null, pickedEnd: pick?.end ?? null })
    }

    // ── pick_dates / cant_do_dates (v2.2928): move a signed order's dates inside its window, or say none fit ──
    if (kind === 'pick_dates' || kind === 'cant_do_dates') {
      const commitmentId = typeof body.commitmentId === 'string' && /^[0-9a-f-]{36}$/.test(body.commitmentId) ? body.commitmentId : null
      if (!commitmentId) return jsonResponse({ error: 'Bad request' }, 400)
      const { data: commitment } = await admin
        .from('step_commitments')
        .select('id, person_id, status, labor_job_id, step_id, job_id, proposed_start, proposed_end, picked_start, picked_end, stage_window_id, work_days, offer_scope_snapshot, change_requested_at')
        .eq('id', commitmentId)
        .maybeSingle()
      const c = commitment as
        | { id: string; person_id: string; status: string; labor_job_id: string | null; step_id: string | null; job_id: string | null; proposed_start: string | null; proposed_end: string | null; picked_start: string | null; picked_end: string | null; stage_window_id: string | null; work_days: number | null; offer_scope_snapshot: unknown; change_requested_at: string | null }
        | null
      if (!c || c.person_id !== link.person_id) return jsonResponse({ error: 'Not found' }, 404)
      const todayYmd = todayYmdInAppTz()
      const sheetLabel = parseScopeExtras(c.offer_scope_snapshot).sheetLabel
      const pickWindow = await pickWindowForOrder(admin, c)

      if (kind === 'cant_do_dates') {
        if (!['offered', 'accepted', 'approved'].includes(c.status)) return jsonResponse({ error: 'This work order is closed.' }, 409)
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
        const hourAgo = new Date(Date.now() - 3600_000).toISOString()
        const { count: recent } = await admin.from('dispatch_requests').select('id', { count: 'exact', head: true }).eq('pending_payload->>subPortalLinkId', String(link.id)).gte('created_at', hourAgo)
        if ((recent ?? 0) >= MAX_PER_HOUR) return jsonResponse({ error: 'That is a lot at once — give us an hour, or call the office.' }, 429)
        await insertDispatchNote(admin, link, `${personName} can't do ${sheetLabel ?? 'the work order'}${pickWindow ? ` in ${pickWindow.start} → ${pickWindow.end}` : ''}${note ? `: ${note.slice(0, 120)}` : ''}`, {
          kind: 'sub_dates_askback',
          personId: link.person_id,
          personName,
          commitmentId: c.id,
          laborJobId: c.labor_job_id,
          jobId: c.job_id,
          window: pickWindow,
          note: note || null,
        })
        return jsonResponse({ ok: true })
      }

      // pick_dates
      if (!['accepted', 'approved'].includes(c.status)) return jsonResponse({ error: 'Sign the work order first, then pick your days.' }, 409)
      if (!pickWindow) return jsonResponse({ error: 'These dates were set by the office — call us to move them.' }, 409)
      // A change request from the office (v2.2934) reopens the pick regardless of the day-before rule.
      if (c.picked_start && !c.change_requested_at && !canChangePick(c.picked_start, todayYmd)) return jsonResponse({ error: 'Too close to move it here — call the office.' }, 409)
      const start = ymdField(body.pickedStart)
      const end = ymdField(body.pickedEnd) ?? start
      if (!start || !end) return jsonResponse({ error: 'Pick your start day.' }, 400)
      const verdict = evaluatePick({ window: pickWindow, start, end, todayYmd })
      if (!verdict.ok) return jsonResponse({ error: pickProblemMessage(verdict.reason) }, 400)
      const ok = await writePick(admin, c, verdict.start, verdict.end)
      if (!ok) return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      if (c.change_requested_at) await admin.from('step_commitments').update({ change_requested_at: null, change_requested_note: null }).eq('id', c.id)
      if (c.job_id) await notifyJobWatchers(admin, { jobId: c.job_id, kind: 'dates', subName: personName, line: `${personName} ${c.picked_start ? 'moved to' : 'picked'} ${verdict.start} → ${verdict.end}`, detail: sheetLabel ?? null })
      await insertDispatchNote(admin, link, `${personName} ${c.picked_start ? 'moved' : 'picked'} ${verdict.start} → ${verdict.end} for ${sheetLabel ?? 'a work order'}`, {
        kind: 'sub_dates_picked',
        personId: link.person_id,
        personName,
        commitmentId: c.id,
        laborJobId: c.labor_job_id,
        jobId: c.job_id,
        pickedStart: verdict.start,
        pickedEnd: verdict.end,
        previousStart: c.picked_start,
        window: pickWindow,
      })
      return jsonResponse({ ok: true, pickedStart: verdict.start, pickedEnd: verdict.end })
    }

    return jsonResponse({ error: 'Bad request' }, 400)
  } catch (e) {
    console.error('submit-sub-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
