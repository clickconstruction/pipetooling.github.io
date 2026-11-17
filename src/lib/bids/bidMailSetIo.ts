/**
 * The io behind **Keep its files on the bid…** (punch list #368, PR 2): two reads as the signed-in person, a mail's
 * files with their kept marks and the bid's sets, and two calls to `bid-plan-set-files`, the set's folder and row
 * (`keep`) and one file into it (`saveAttachment`). The function's own words come back as the error (`fnProblem`).
 * The kept mark's column lands with PR 1's migration: a read that meets a database without it reads again with the
 * column left out, so the press stands either side of the push and only the *kept* mark waits.
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { checkSupabaseError } from '../../utils/errorHandling'
import { BID_PLAN_SET_SELECT, type BidPlanSetRow } from './bidPlanSets'
import { bidMailFiles, bidMailLines, mailBySet, type BidMailFile, type BidMailFileRow, type BidMailLine, type BidMailLineRow, type SetMail, type SetMailRow } from './bidMailSet'

export type KeptSet = { id: string; bid_id: string; name: string; link: string }
export type KeepReply = { set: KeptSet; folderUrl: string; made: boolean; reused: boolean }
export type FiledOnBid = { driveFileId: string; url: string; folderUrl: string }

export type BidMailSetIo = {
  /** The files on a mail's line, each with the set it is filed in. A read that fails throws: a failure must not read as no file. */
  filesOf(messageId: string): Promise<BidMailFile[]>
  /** The bid's sets, for *Put them in* and the kept mark's name. */
  setsOf(bidId: string): Promise<BidPlanSetRow[]>
  /** The set's folder under the bid's Plans folder and its row; a set of that name already on the bid is answered as it is. */
  keep(ask: { bidId: string; messageId: string; name: string; memo: string; planDate: string }): Promise<KeepReply>
  /** Our copy of one of the mail's files into a set's folder. */
  saveAttachment(setId: string, attachmentId: string): Promise<FiledOnBid>
  /** The mail each of these sets came from, for the chip and the door on the bid's Plan sets. A courtesy: a read that fails answers none. */
  mailOfSets(setIds: ReadonlyArray<string>): Promise<Map<string, SetMail>>
  /** The bid's mail that carries a file, newest first, for the list under Plan sets. A read that fails throws. */
  mailsOf(bidId: string): Promise<BidMailLine[]>
}

const FILE_COLUMNS = 'id, name, mime, kind, bucket_path, left_in_gmail, size_bytes'
/** Postgres' and PostgREST's answers for a column the schema does not have yet. */
const isMissingColumn = (code: string | null | undefined): boolean => code === '42703' || code === 'PGRST204'

async function answer<T>(r: FnResult, fallback: string, check: (d: Record<string, unknown>) => T | null): Promise<T> {
  const problem = await fnProblem(r, fallback)
  if (problem) throw new Error(problem)
  const out = check((r.data ?? {}) as Record<string, unknown>)
  if (!out) throw new Error(fallback)
  return out
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export const supabaseBidMailSetIo: BidMailSetIo = {
  async filesOf(messageId) {
    const read = (columns: string) => supabase.from('message_attachments').select(columns as never).eq('message_id', messageId).order('sort_order')
    let r = await read(`${FILE_COLUMNS}, bid_plan_set_id`)
    if (r.error && isMissingColumn((r.error as { code?: string }).code)) r = await read(FILE_COLUMNS)
    checkSupabaseError(r, 'read mail files')
    return bidMailFiles((r.data ?? []) as unknown as BidMailFileRow[])
  },
  async setsOf(bidId) {
    const r = await supabase.from('bid_plan_sets').select(BID_PLAN_SET_SELECT).eq('bid_id', bidId)
    checkSupabaseError(r, 'read plan sets')
    return (r.data ?? []) as BidPlanSetRow[]
  },
  async keep(ask) {
    const r = (await supabase.functions.invoke('bid-plan-set-files', {
      body: { action: 'keep', bid_id: ask.bidId, message_id: ask.messageId, name: ask.name, memo: ask.memo, plan_date: ask.planDate },
    })) as FnResult
    return answer(r, 'The set was not added to the bid.', (d) => {
      const set = d.set
      if (!isRecord(set) || typeof set.id !== 'string' || typeof set.name !== 'string' || typeof d.folderUrl !== 'string') return null
      return { set: { id: set.id, bid_id: String(set.bid_id ?? ask.bidId), name: set.name, link: String(set.link ?? d.folderUrl) }, folderUrl: d.folderUrl, made: d.made === true, reused: d.reused === true }
    })
  },
  async mailOfSets(setIds) {
    if (setIds.length === 0) return new Map()
    try {
      const r = await supabase.from('message_attachments').select('bid_plan_set_id, message_id, messages(contact_id, contacts(kind))' as never).in('bid_plan_set_id' as never, [...setIds]).order('created_at')
      return r.error ? new Map() : mailBySet((r.data ?? []) as unknown as SetMailRow[])
    } catch {
      return new Map()
    }
  },
  async mailsOf(bidId) {
    const r = await supabase.from('messages').select('id, at, subject, who_text, message_attachments(kind, name)').eq('bid_id', bidId).eq('channel', 'email').order('at', { ascending: false }).limit(100)
    checkSupabaseError(r, 'read mail on this bid')
    return bidMailLines((r.data ?? []) as unknown as BidMailLineRow[])
  },
  async saveAttachment(setId, attachmentId) {
    const r = (await supabase.functions.invoke('bid-plan-set-files', { body: { action: 'save_attachment', set_id: setId, attachment_id: attachmentId } })) as FnResult
    return answer(r, 'The file did not land in the set’s folder.', (d) =>
      typeof d.driveFileId === 'string' && typeof d.url === 'string' && typeof d.folderUrl === 'string' ? { driveFileId: d.driveFileId, url: d.url, folderUrl: d.folderUrl } : null,
    )
  },
}
