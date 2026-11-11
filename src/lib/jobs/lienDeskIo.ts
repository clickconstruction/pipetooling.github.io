import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { LienDeskDraftFields } from './lienNoticeDraft'
import type { LienDeskItemRow, LienNoticePolicy, LienSubmitOutcome } from './lienDesk'
import type { LienWordChannel } from './lienWord'
import { canTakeBackItem, fieldsWithTakeBack } from './lienRunTakeBack'
import { LIEN_DESK_SIGNATURE_CLEAR } from './lienNoticeSignature'
import { withPromiseRecord, type CourtesyPromise } from './lienCourtesyNotice'
import { earliestSendDay, sentAtForTypedDay } from './lienSentAt'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { LIEN_AFFIDAVIT_SHORT_FORM_MARK, lienAffidavitFormForItems, type LienAffidavitForm, type LienAffidavitFormItem } from './lienAffidavitForm'

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
      // A draft saved after signing clears the signature (v2.5082): the mark belongs to the notice as he signed it.
      () => supabase.from('job_lien_desk_items').update({ ...payload, status: 'drafted', ...LIEN_DESK_SIGNATURE_CLEAR } as never).eq('id', input.itemId as string),
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

/**
 * Tell the leader (v2.4872): his phone buzzes, or the same words go by email, when the office sends
 * a notice for his approval. Best effort — a failure here never undoes the send. The function
 * writes the words itself; the client hands it only the item and the mail-by day.
 */
export async function tellLeaderOfLienApproval(itemId: string, dueYmd: string | null): Promise<{ pushSent: number; emailSent: boolean; leaderName: string | null }> {
  const { data, error } = await supabase.functions.invoke('notify-lien-approval', { body: { item_id: itemId, due_ymd: dueYmd ?? undefined } })
  if (error) throw error
  const d = (data ?? {}) as { push_sent?: number; email_sent?: boolean; leader_name?: string | null }
  return { pushSent: d.push_sent ?? 0, emailSent: Boolean(d.email_sent), leaderName: d.leader_name ?? null }
}

/** The words the office reads after a send for approval (v2.4872): which way it reached the leader. */
export function leaderToldWords(result: { pushSent: number; emailSent: boolean; leaderName: string | null } | null): string {
  const who = result?.leaderName?.trim().split(/\s+/)[0] || 'the leader'
  if (!result) return `Sent for approval. ${who[0]!.toUpperCase()}${who.slice(1)} will see it on the Dashboard.`
  if (result.pushSent > 0) return `Sent for approval. ${who[0]!.toUpperCase()}${who.slice(1)}'s phone has it.`
  if (result.emailSent) return `Sent for approval. ${who[0]!.toUpperCase()}${who.slice(1)} has it by email.`
  return `Sent for approval. ${who[0]!.toUpperCase()}${who.slice(1)} will see it on the Dashboard.`
}

/** "Robert said to send it" — approved on the leader's spoken word, with who / when / how (or, v2.3813, that he is standing here / typing it in). */
export async function sendLienDeskItemOnWord(itemId: string, word: { note: string; channel: LienWordChannel }): Promise<void> {
  await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .update({ status: 'approved', approval_mode: 'word', word_note: word.note.trim(), word_channel: word.channel, submitted_at: new Date().toISOString() } as never)
        .eq('id', itemId),
    'lien desk: send on word',
  )
}

/**
 * The form the job's affidavit was drafted on (punch list #305), for the job's Lien window: it prints the paper and
 * holds no desk data, so it reads the job's affidavit items and the rule decides (`lienAffidavitForm.ts`).
 */
export async function readLienAffidavitForm(jobId: string): Promise<LienAffidavitForm> {
  const rows = await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').select('kind, status, fields, voided_at, created_at').eq('job_id', jobId).eq('kind', 'affidavit').is('voided_at', null),
    'lien window: the affidavit’s form',
  )
  return lienAffidavitFormForItems((rows ?? []) as unknown as LienAffidavitFormItem[])
}

/**
 * Redraw an affidavit on the short form (punch list #305): one write that takes the item back to a draft, clears its
 * approval and any signature as a pull-back does, and marks its fields for the short form. One write, so a paper is
 * never left pulled back and unmarked. Only a paper still on the desk moves: one filed or voided since the list was
 * read is refused with the reason.
 */
export async function redrawLienAffidavitShort(item: Pick<LienDeskItemRow, 'id' | 'fields'>, userId: string | null): Promise<void> {
  const fields = { ...(item.fields && typeof item.fields === 'object' && !Array.isArray(item.fields) ? (item.fields as Json) : {}), ...LIEN_AFFIDAVIT_SHORT_FORM_MARK }
  const rows = await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .update({
          status: 'drafted',
          fields,
          ...LIEN_DESK_SIGNATURE_CLEAR,
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
        .eq('id', item.id)
        .eq('kind', 'affidavit')
        .in('status', ['drafted', 'awaiting_approval', 'approved', 'held'])
        .select('id'),
    'lien desk: redraw on the short form',
  )
  if (((rows ?? []) as unknown as Array<{ id: string }>).length === 0) throw new Error('This affidavit is no longer a draft on the desk. It was filed or taken back since the list was read.')
}

/**
 * The same for many (the Affidavits list's one press): each paper is its own write, the batch keeps going past one
 * that fails, and the failures come back with their reasons for the list to show.
 */
export async function redrawLienAffidavitsShort(
  papers: ReadonlyArray<{ jobId: string; item: Pick<LienDeskItemRow, 'id' | 'fields'> }>,
  userId: string | null,
): Promise<{ done: string[]; failed: Array<{ jobId: string; reason: string }> }> {
  const done: string[] = []
  const failed: Array<{ jobId: string; reason: string }> = []
  for (const p of papers) {
    try {
      await redrawLienAffidavitShort(p.item, userId)
      done.push(p.jobId)
    } catch (e) {
      failed.push({ jobId: p.jobId, reason: formatErrorMessage(e, 'The affidavit could not be redrawn.') })
    }
  }
  return { done, failed }
}

/**
 * Send every drafted affidavit for approval (punch list #305, v2.6918): each paper is its own write, the pane's own
 * **Send for approval ▸**, and the batch keeps going past one that fails. A paper that did not take stays in To draft.
 */
export async function submitLienAffidavits(
  papers: ReadonlyArray<{ jobId: string; itemId: string; outcome: LienSubmitOutcome }>,
): Promise<{ done: string[]; failed: Array<{ jobId: string; reason: string }> }> {
  const done: string[] = []
  const failed: Array<{ jobId: string; reason: string }> = []
  for (const p of papers) {
    try {
      await submitLienDeskItem(p.itemId, p.outcome)
      done.push(p.jobId)
    } catch (e) {
      failed.push({ jobId: p.jobId, reason: formatErrorMessage(e, 'The affidavit could not be sent for approval.') })
    }
  }
  return { done, failed }
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
          ...LIEN_DESK_SIGNATURE_CLEAR,
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

/**
 * Undo a run's approval (v2.4541): every notice the click approved, or sent to the leader, goes
 * back to the office's draft, and the printed stamp goes with it. Only rows still approved or
 * awaiting approval move, so a notice already recorded as sent is never touched. Returns how many moved.
 */
export async function undoLienDeskApprovals(itemIds: ReadonlyArray<string>, userId: string | null): Promise<number> {
  if (itemIds.length === 0) return 0
  const rows = await withSupabaseRetry(
    () =>
      supabase
        .from('job_lien_desk_items')
        .update({
          status: 'drafted',
          ...LIEN_DESK_SIGNATURE_CLEAR,
          approval_mode: null,
          approved_by: null,
          approved_at: null,
          word_note: '',
          word_channel: '',
          hold_reason: '',
          hold_until: null,
          printed_at: null,
          printed_by: null,
          pulled_back_by: userId,
          pulled_back_at: new Date().toISOString(),
        } as never)
        .in('id', [...itemIds])
        .in('status', ['approved', 'awaiting_approval'])
        .select('id'),
    'lien desk: undo approvals',
  )
  return ((rows ?? []) as unknown as Array<{ id: string }>).length
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

/** The GC's written okay for the owner to pay us directly (v2.3760), noted on the first packet's sent item — letter two is then not due. */
export async function noteGcAuthorizedDirectPay(item: Pick<LienDeskItemRow, 'id' | 'fields'>, who: { name: string; note: string }): Promise<void> {
  const fields = { ...((item.fields ?? {}) as Json), gcAuthorizedDirectPay: { at: new Date().toISOString(), name: who.name.trim(), note: who.note.trim() } }
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ fields } as never).eq('id', item.id), 'lien desk: note the GC’s okay')
}

/** What they promised for the rest (punch list #274, PR 3), recorded on the first packet's sent item; the day also goes on the job through `addJobPaymentPromise`, so every board reads one promise. A later promise overwrites. */
export async function notePromiseOnNotice(item: Pick<LienDeskItemRow, 'id' | 'fields'>, promise: CourtesyPromise): Promise<void> {
  const fields = withPromiseRecord((item.fields ?? {}) as Json, promise)
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ fields } as never).eq('id', item.id), 'lien desk: record what they promised')
}

/** The owner's call (v2.3767): the three answers, recorded on the first packet's sent item — read by the desk, the affidavit piles and the grid. A later call overwrites. */
export async function noteOwnerCall(item: Pick<LienDeskItemRow, 'id' | 'fields'>, call: NonNullable<LienDeskDraftFields['ownerCall']>): Promise<void> {
  const fields = { ...((item.fields ?? {}) as Json), ownerCall: { ...call } }
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ fields } as never).eq('id', item.id), 'lien desk: record the owner’s call')
}

/** Letter two (v2.3760): a fresh draft on the job — the first packet's months and form, the chosen letter, the `letterTwo` mark — for the office to send for approval like any notice. Returns the new item id. */
export async function startLetterTwo(input: { first: Pick<LienDeskItemRow, 'id' | 'job_id' | 'months' | 'sent_at'>; fields: LienDeskDraftFields; userId: string | null }): Promise<string> {
  return saveLienDeskDraft({ itemId: null, jobId: input.first.job_id, months: input.first.months, fields: input.fields, coverNote: true, userId: input.userId })
}

/** The run printed these items' notices (v2.4119): they sit in "In the mail · tracking owed" until recorded. Best-effort — a failure only leaves them in Ready to send. */
export async function markLienDeskItemsPrinted(itemIds: ReadonlyArray<string>, userId: string | null): Promise<void> {
  if (itemIds.length === 0) return
  await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').update({ printed_at: new Date().toISOString(), printed_by: userId } as never).in('id', [...itemIds]),
    'lien desk: mark printed',
  )
}

/** Back to Ready to send (v2.4568): the packet was not mailed after all, or was printed by mistake. The approval stands. */
export async function clearLienDeskItemPrinted(itemId: string, by: { userId: string | null; userName: string | null } = { userId: null, userName: null }): Promise<void> {
  await takeBackLienDeskItems([itemId], by)
}

/**
 * Take back a printed run (punch list #101): every listed item still printed and not sent goes
 * back to Ready to send, keeping its approval and a line saying who took it back
 * (`fields.runTakenBack`). Returns how many were taken back; a row sent or cleared meanwhile is left alone.
 */
export async function takeBackLienDeskItems(itemIds: ReadonlyArray<string>, by: { userId: string | null; userName: string | null }): Promise<number> {
  if (itemIds.length === 0) return 0
  const rows = await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').select('id, fields, printed_at, status, voided_at').in('id', [...itemIds]),
    'lien desk: read printed',
  )
  const at = new Date().toISOString()
  const live = ((rows ?? []) as Array<{ id: string; fields: unknown; printed_at: string | null; status: string | null; voided_at: string | null }>).filter(canTakeBackItem)
  await Promise.all(
    live.map((r) =>
      withSupabaseRetry(
        () =>
          supabase
            .from('job_lien_desk_items')
            .update({ printed_at: null, printed_by: null, fields: fieldsWithTakeBack(r.fields, { at, by: by.userId, byName: by.userName, printedAt: r.printed_at }) } as never)
            .eq('id', r.id)
            .not('printed_at', 'is', null)
            .neq('status', 'sent'),
        'lien desk: take back',
      ),
    ),
  )
  return live.length
}

/**
 * The run or a door recorded a filing for this item. `sentAt` is the day it went when that day is
 * not today (punch list #243, `sentAtForTypedDay`), so letter two, the courtesy notice and the desk's
 * day count run from the mailing day; null leaves the stamp to the trigger, which writes the moment
 * of the record, as a notice recorded the day it goes out always has.
 */
export async function markLienDeskItemSent(itemId: string, filingId: string, sentAt: string | null = null): Promise<void> {
  await withSupabaseRetry(
    () => supabase.from('job_lien_desk_items').update({ status: 'sent', sent_filing_id: filingId, ...(sentAt ? { sent_at: sentAt } : {}) } as never).eq('id', itemId),
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
 * sent — on the day the filing says it went (punch list #243), when that day
 * is before today. Returns true when it moved.
 */
export async function syncLienDeskAfterRecord(jobId: string, todayYmd: string = todayYmdInAppTz()): Promise<boolean> {
  const items = await withSupabaseRetry<LienDeskItemRow[]>(
    () => supabase.from('job_lien_desk_items').select('*').eq('job_id', jobId).is('voided_at', null).in('status', ['approved', 'drafted', 'awaiting_approval', 'held']),
    'lien desk: sync items',
  )
  let moved = false
  // Affidavits (v2.3412): a filed affidavit (filed_at set) sends the item.
  const affidavitItem = (items ?? []).find((i) => i.kind === 'affidavit')
  if (affidavitItem) {
    const filed = await withSupabaseRetry<{ id: string; filed_at: string | null }[]>(
      () => supabase.from('job_lien_filings').select('id, filed_at').eq('job_id', jobId).eq('kind', 'affidavit').is('voided_at', null).not('filed_at', 'is', null).order('created_at', { ascending: false }).limit(1),
      'lien desk: sync affidavit',
    )
    if (filed?.[0]) {
      // `filed_at` is a date column: the day the county recorded it.
      await markLienDeskItemSent(affidavitItem.id, filed[0].id, sentAtForTypedDay(filed[0].filed_at, todayYmd))
      moved = true
    }
  }
  const item = (items ?? []).find((i) => i.kind === 'notice_53_056')
  if (!item) return moved
  const filings = await withSupabaseRetry<{ id: string; months_covered: string[] | null; created_at: string; sends: unknown }[]>(
    () => supabase.from('job_lien_filings').select('id, months_covered, created_at, sends').eq('job_id', jobId).eq('kind', 'notice_53_056').is('voided_at', null).order('created_at', { ascending: false }),
    'lien desk: sync filings',
  )
  const covered = new Set<string>()
  for (const f of filings ?? []) for (const m of f.months_covered ?? []) covered.add(m)
  const months = item.months.length ? item.months : []
  if (months.length === 0 || !months.every((m) => covered.has(m))) return false
  const filing = (filings ?? []).find((f) => months.every((m) => (f.months_covered ?? []).includes(m))) ?? (filings ?? [])[0]
  if (!filing) return false
  await markLienDeskItemSent(item.id, filing.id, sentAtForTypedDay(earliestSendDay(filing.sends), todayYmd))
  return true
}

export type { LienDeskItemRow }
