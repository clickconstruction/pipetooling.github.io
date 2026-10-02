import { supabase } from '../supabase'

/**
 * What the house told us (v2.4411): the writes behind the Lien desk's card. One row per job
 * and house in `job_supply_house_words`; who wrote it and when are stamped by the database.
 */

export type SupplierWordInput = {
  jobId: string
  houseId: string
  /** The house's own balance on the job; null when it gave none. */
  balance: number | null
  /** 'YYYY-MM-DD' the house says its notice goes out; null when it gave none. */
  noticeYmd: string | null
  saidBy: string
  note: string
  /** The signed-in person's name, kept beside the stamp so the card can say who wrote it. */
  notedByName: string
}

export async function saveSupplierWord(input: SupplierWordInput): Promise<void> {
  const row = {
    job_id: input.jobId,
    supply_house_id: input.houseId,
    their_balance: input.balance,
    notice_on: input.noticeYmd,
    said_by: input.saidBy.trim(),
    note: input.note.trim(),
    noted_by_name: input.notedByName.trim(),
  }
  const { error } = await supabase.from('job_supply_house_words').upsert(row, { onConflict: 'job_id,supply_house_id' })
  if (error) throw error
}

export async function clearSupplierWord(jobId: string, houseId: string): Promise<void> {
  const { error } = await supabase.from('job_supply_house_words').delete().eq('job_id', jobId).eq('supply_house_id', houseId)
  if (error) throw error
}
