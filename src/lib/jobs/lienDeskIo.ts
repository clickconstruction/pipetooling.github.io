import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { LienDeskDraftFields } from './lienNoticeDraft'
import type { LienDeskItemRow, LienNoticePolicy, LienSubmitOutcome } from './lienDesk'

/** The desk's three kinds — one live row per (job, kind). */
export type LienDeskItemKind = 'notice_53_056' | 'affidavit' | 'retainage_53_057'

/**
 * The Lien desk's writes — every state change of a `job_lien_desk_items`
 * row in one place, so the office pane, the leader pane and the run share
 * the same verbs. The approval guard trigger enforces who may approve and
 * what a spoken-word send must carry.
 */

type Json = Record<string, unknown>

function draftJson(fields: LienDeskDraftFields): Json {
  return JSON.parse(JSON.stringify(fields)) as Json
}

/** Create or refresh the draft (status stays / becomes `drafted`). Returns the row id. */
export async function saveLienDeskDraft(input: {
  itemId: string | null
  jobId: string
  months: string[]
  fields: LienDeskDraftFields
  coverNote: boolean
  userId: string | null
  /** 'notice_53_056' (default), 'affidavit', or 'retainage_53_057' (v2.3753). */
  kind?: LienDeskItemKind
}): Promise<string> {
  const payload = { months: input.months, fields: draftJson(input.fields), cover_note: input.coverNote }
  if (input.itemId) {
    await withSupabaseRetry(
      () => supabase.from('job_lien_desk_items').update({ ...payload, status: 'drafted' } as never).eq('id', input.itemId as string),
      'lien desk: save draft',
    )
    return input.itemId
  }
  const row = await withSupabaseRetry<{ id: string }>(
    () =>
      supabase
        .from('job_lien_desk_items')
        .insert({ job_id: input.jobId, kind: input.kind ?? 'notice_53_056', status: 'drafted', drafted_by: input.userId, ...payload } as never)
        .select('id')
        .single(),
    'lien desk: create draft',
  )
  return row.id
}

/** Send the draft on its way: to the leader, straight to the run (standing rule), or into a hold (standing rule). */
export async function submitLienDeskItem(itemId: string, outcome: LienSubmitOutcome): Promise<void> {
  const now = new Date().toISOString()
  const patch: Json =
    outcome.status === 'approved'
      ? { status: 'approved', approval_mode: 'rule', submitted_at: now }
      : outcome.status === 'held'
        ? { status: 'held', hold_reason: outcome.hold_reason, hold_until: outcome.hold_until, submitted_at: now }
        : { status: 'awaiting_approval', submitted_at: now }
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update(patch as never).eq('id', itemId), 'lien desk: submit')
}

/** "Robert said to send it" — approved on the leader's spoken word, with who / when / how. */
export async function sendLienDeskItemOnWord(itemId: string, word: { note: string; channel: 'phone' | 'in_person' | 'text' }): Promise<void> {
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .update({ status: 'approved', approval_mode: 'word', word_note: word.note.trim(), word_channel: word.channel, submitted_at: new Date().toISOString() } as never)
        .eq('id', itemId),
    'lien desk: send on word',
  )
}

/** The leader's click. The trigger refuses it from anyone else. */
export async function approveLienDeskItem(itemId: string): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').update({ status: 'approved', approval_mode: 'leader' } as never).eq('id', itemId),
    'lien desk: approve',
  )
}

export async function holdLienDeskItem(itemId: string, hold: { reason: 'promised' | 'call_first'; until: string }): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').update({ status: 'held', hold_reason: hold.reason, hold_until: hold.until } as never).eq('id', itemId),
    'lien desk: hold',
  )
}

/** Back to the office's draft — from a hold, from the leader's queue, or the leader's "not what I said". */
export async function pullBackLienDeskItem(itemId: string, userId: string | null): Promise<void> {
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .update({
          status: 'drafted',
          approval_mode: null,
          approved_by: null,
          approved_at: null,
          word_note: '',
          word_channel: '',
          hold_reason: '',
          hold_until: null,
          pulled_back_by: userId,
          pulled_back_at: new Date().toISOString(),
        } as never)
        .eq('id', itemId),
    'lien desk: pull back',
  )
}

/** The office accepts the forfeit for these months (the row stays as the record of the decision). */
export async function skipLienDeskItem(input: { itemId: string | null; jobId: string; months: string[]; fields: LienDeskDraftFields; reason: string; userId: string | null; userName?: string; kind?: LienDeskItemKind }): Promise<void> {
  const who = (input.userName ?? '').trim()
  const fields = draftJson({ ...input.fields, skipReason: input.reason.trim(), ...(who ? { skippedBy: { name: who, at: new Date().toISOString() } } : {}) })
  if (input.itemId) {
    await withSupabaseRetry(
      () => supabase.from('job_lien_desk_items').update({ status: 'missed', fields, months: input.months } as never).eq('id', input.itemId as string),
      'lien desk: skip',
    )
    return
  }
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .insert({ job_id: input.jobId, kind: input.kind ?? 'notice_53_056', status: 'missed', months: input.months, fields, drafted_by: input.userId } as never)
        .select('id')
        .single(),
    'lien desk: skip',
  )
}

/**
 * A person saw a closed window and noted it (v2.3679): a `missed` row with no reason,
 * the months it names, and who looked. It never touches a live draft on the job — a
 * draft for the months still open goes on as it was.
 */
export async function noteLienWindowMissed(input: { jobId: string; months: string[]; fields: LienDeskDraftFields; userId: string | null; userName?: string }): Promise<void> {
  const who = (input.userName ?? '').trim()
  const fields = draftJson({ ...input.fields, windowClosed: { name: who, at: new Date().toISOString() } })
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .insert({ job_id: input.jobId, kind: 'notice_53_056', status: 'missed', months: input.months, fields, drafted_by: input.userId } as never)
        .select('id')
        .single(),
    'lien desk: note the window closed',
  )
}

/** The run recorded a filing for this item. */
export async function markLienDeskItemSent(itemId: string, filingId: string): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').update({ status: 'sent', sent_filing_id: filingId } as never).eq('id', itemId),
    'lien desk: mark sent',
  )
}

export async function setCustomerLienNoticePolicy(customerId: string, policy: LienNoticePolicy, note: string): Promise<void> {
  await withSupabaseRetry(
    () => supabase.rpc('set_customer_lien_notice_policy', { p_customer_id: customerId, p_policy: policy, p_note: note.trim() || undefined } as never),
    'lien desk: set standing rule',
  )
}

/**
 * After the Lien window records a notice: if the job's live desk item is
 * approved and a live notice now names every month it carries, the item is
 * sent. Returns true when it moved.
 */
export async function syncLienDeskAfterRecord(jobId: string): Promise<boolean> {
  const items = await withSupabaseRetry<LienDeskItemRow[]>(
    () => supabase.from('job_lien_desk_items').select('*').eq('job_id', jobId).is('voided_at', null).in('status', ['approved', 'drafted', 'awaiting_approval', 'held']),
    'lien desk: sync items',
  )
  let moved = false
  // Affidavits (v2.3412): a filed affidavit (filed_at set) sends the item.
  const affidavitItem = (items ?? []).find((i) => i.kind === 'affidavit')
  if (affidavitItem) {
    const filed = await withSupabaseRetry<{ id: string }[]>(
      () => supabase.from('job_lien_filings').select('id').eq('job_id', jobId).eq('kind', 'affidavit').is('voided_at', null).not('filed_at', 'is', null).order('created_at', { ascending: false }).limit(1),
      'lien desk: sync affidavit',
    )
    if (filed?.[0]) {
      await markLienDeskItemSent(affidavitItem.id, filed[0].id)
      moved = true
    }
  }
  const item = (items ?? []).find((i) => i.kind === 'notice_53_056')
  if (!item) return moved
  const filings = await withSupabaseRetry<{ id: string; months_covered: string[] | null; created_at: string }[]>(
    () => supabase.from('job_lien_filings').select('id, months_covered, created_at').eq('job_id', jobId).eq('kind', 'notice_53_056').is('voided_at', null).order('created_at', { ascending: false }),
    'lien desk: sync filings',
  )
  const covered = new Set<string>()
  for (const f of filings ?? []) for (const m of f.months_covered ?? []) covered.add(m)
  const months = item.months.length ? item.months : []
  if (months.length === 0 || !months.every((m) => covered.has(m))) return false
  const filing = (filings ?? []).find((f) => months.every((m) => (f.months_covered ?? []).includes(m))) ?? (filings ?? [])[0]
  if (!filing) return false
  await markLienDeskItemSent(item.id, filing.id)
  return true
}

export type { LienDeskItemRow }
