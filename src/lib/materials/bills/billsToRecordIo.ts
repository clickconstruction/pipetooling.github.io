/**
 * Supply-house bill capture (punch list #179 PR 3, v2.6095): what the form, the house's row and the thread read and
 * press, on the app's client. The bills to record at a set of houses (`message_attachments` on the houses' contacts'
 * lines, less the answered and the ones on a row); the house behind a thread's contact; the accounts and the jobs the
 * fill matches against; the fill itself (`bill-read`); our copy's bytes for the pane; the switch; the answer that takes
 * a file off the list. One interface, so a smoke hands the form a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { base64OfBytes } from '../../../../supabase/functions/_shared/messagesEmailFiles'
import type { Database } from '../../../types/database'
import { checkSupabaseError, formatErrorMessage } from '../../../utils/errorHandling'
import { DEFAULT_JOB_LEDGER_PREFIX, formatJobLedgerNumberLabel } from '../../ledgerDisplayPrefixes'
import type { MatchableAccount, MatchableJob } from './billMatch'
import { BILL_READ_SWITCH_KEY, BILL_READ_WORDS, billReadIsOn, type BillRead } from './billRead'
import { billCandidates, type BillCandidate, type BillCandidateRow } from './billsToRecord'

/** What `bill-read` answers. */
export type BillReadAnswer =
  | { ok: true; read: BillRead; file: { path: string; name: string; mime: string | null; attachmentId: string | null; supplyHouseId: string | null }; model: string; cents: number; readId: string | null }
  | { ok: false; error: string; words: string }

export interface BillsIo {
  /** The bills waiting at these houses, newest first. Fail-soft: a read that fails is an empty list. */
  loadCandidates(houseIds: readonly string[]): Promise<BillCandidate[]>
  /** The house a thread's contact is, or at; null for a contact of another kind. */
  houseOfContact(contactId: string): Promise<string | null>
  /** The job accounts at this house, for the job guess and the tick. */
  loadAccounts(houseId: string): Promise<MatchableAccount[]>
  /** The jobs the printed place finds, through the form's own search. */
  searchJobs(text: string): Promise<MatchableJob[]>
  /** The fill: a thread file by its id, or a dropped-in file with the house. */
  readBill(body: { attachment_id: string; supply_house_id: string } | { supply_house_id: string; file: { name: string; mime: string; base64: string } }): Promise<BillReadAnswer>
  /** Our copy, signed for a minute: the bytes for the PDF pane, or the address for a picture. */
  fileUrl(path: string): Promise<string | null>
  /** A thread file recorded through the form: the offer and the count let it go. */
  markRecorded(attachmentId: string): Promise<void>
  /** Whether the fill is on. */
  switchOn(): Promise<boolean>
  /** The owner's or a dev's press on the switch. Rejects in words when nothing changed. */
  setSwitch(on: boolean): Promise<void>
}

const READABLE_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/octet-stream']

export const BILL_SWITCH_NOT_SAVED = 'The switch did not change. Only the owner or a dev can turn the fill on or off.'

/**
 * The app's client, loaded when first used: the thread's offer imports this file, and a smoke that stubs the thread's
 * own reads must not evaluate `src/lib/supabase` by the import alone.
 */
async function appClient(): Promise<SupabaseClient<Database>> {
  return (await import('../../supabase')).supabase
}

export function supabaseBillsIo(given?: SupabaseClient<Database>): BillsIo {
  const db = async (): Promise<SupabaseClient<Database>> => given ?? (await appClient())
  const from = async (table: string) => ((await db()) as unknown as SupabaseClient).from(table)
  return {
    async loadCandidates(houseIds) {
      if (houseIds.length === 0) return []
      try {
        const { data: contacts, error } = await (await from('contacts')).select('id, supply_house_id').in('supply_house_id', [...houseIds])
        if (error) return []
        const houseOf = new Map<string, string>()
        for (const c of (contacts ?? []) as Array<{ id: string; supply_house_id: string }>) houseOf.set(c.id, c.supply_house_id)
        if (houseOf.size === 0) return []
        const { data: rows, error: rowsError } = await (await from('message_attachments'))
          .select('id, message_id, name, mime, bucket_path, kind, paper_answer, created_at, messages!inner(contact_id, at)')
          .in('messages.contact_id', [...houseOf.keys()])
          .is('paper_answer', null)
          .neq('kind', 'link')
          .not('bucket_path', 'is', null)
          .in('mime', READABLE_MIME)
          .order('created_at', { ascending: false })
          .limit(400)
        if (rowsError) return []
        // The column lands with PR 2's migration; before the push this read fails and every candidate still shows.
        const onRow = new Set<string>()
        const linked = await (await from('supply_house_invoices')).select('bill_attachment_id').in('supply_house_id', [...houseIds]).not('bill_attachment_id', 'is', null)
        if (!linked.error) for (const r of (linked.data ?? []) as Array<{ bill_attachment_id: string | null }>) if (r.bill_attachment_id) onRow.add(r.bill_attachment_id)
        return billCandidates((rows ?? []) as BillCandidateRow[], houseOf, onRow)
      } catch {
        return []
      }
    },
    async houseOfContact(contactId) {
      const { data } = await (await from('contacts')).select('supply_house_id, supply_house_contact_id').eq('id', contactId).maybeSingle()
      const row = data as { supply_house_id: string | null; supply_house_contact_id: string | null } | null
      if (row?.supply_house_id) return row.supply_house_id
      if (!row?.supply_house_contact_id) return null
      const { data: rep } = await (await from('supply_house_contacts')).select('supply_house_id').eq('id', row.supply_house_contact_id).maybeSingle()
      return (rep as { supply_house_id?: string | null } | null)?.supply_house_id ?? null
    },
    async loadAccounts(houseId) {
      const { data } = await (await from('job_supply_house_accounts')).select('job_id, account_ref, status').eq('supply_house_id', houseId)
      return ((data ?? []) as Array<{ job_id: string; account_ref: string | null; status: string }>).map((a) => ({ jobId: a.job_id, accountRef: a.account_ref ?? '', status: a.status }))
    },
    async searchJobs(text) {
      const q = text.trim()
      if (!q) return []
      const { data } = await (await db()).rpc('search_jobs_ledger', { search_text: q })
      return ((data ?? []) as Array<{ id: string; hcp_number: string; click_number?: string; job_name: string | null; job_address: string | null }>).map((j) => ({
        id: j.id,
        label: formatJobLedgerNumberLabel(DEFAULT_JOB_LEDGER_PREFIX, j.hcp_number, j.click_number),
        name: j.job_name ?? '',
        address: j.job_address ?? '',
      }))
    },
    async readBill(body) {
      const r = await (await db()).functions.invoke('bill-read', { body })
      if (r.error) {
        // The function's own words ride in the body of a refused call; a lost signal has none.
        const ctx = (r.error as { context?: { json?: () => Promise<unknown> } }).context
        try {
          const failed = (await ctx?.json?.()) as { error?: string; words?: string } | undefined
          if (failed?.words) return { ok: false, error: failed.error ?? 'failed', words: failed.words }
        } catch {
          /* no body to read */
        }
        return { ok: false, error: 'failed', words: formatErrorMessage(r.error, BILL_READ_WORDS.failed) }
      }
      const data = r.data as BillReadAnswer | null
      if (!data) return { ok: false, error: 'failed', words: BILL_READ_WORDS.failed }
      return data
    },
    async fileUrl(path) {
      const signed = await (await db()).storage.from('message-attachments').createSignedUrl(path, 60)
      return signed.error || !signed.data?.signedUrl ? null : signed.data.signedUrl
    },
    async markRecorded(attachmentId) {
      const { answerPaper } = await import('../../messages/messagesIo')
      await answerPaper(attachmentId, 'filed')
    },
    async switchOn() {
      const result = await (await db()).from('app_settings').select('value_text').eq('key', BILL_READ_SWITCH_KEY).maybeSingle()
      if (result.error) return false
      return billReadIsOn(result.data?.value_text)
    },
    async setSwitch(on) {
      const result = await (await db()).from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', BILL_READ_SWITCH_KEY).select('key')
      checkSupabaseError(result, 'turn the fill on or off')
      if (result.data.length === 0) throw new Error(BILL_SWITCH_NOT_SAVED)
    },
  }
}

/** A dropped-in file as the function takes it. */
export async function fileToUpload(file: File): Promise<{ name: string; mime: string; base64: string }> {
  return { name: file.name, mime: file.type || 'application/octet-stream', base64: base64OfBytes(new Uint8Array(await file.arrayBuffer())) }
}
