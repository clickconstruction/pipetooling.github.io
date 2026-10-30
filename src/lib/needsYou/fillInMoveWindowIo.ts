import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { jobAccountFillInIo, type JobAccountSaved } from './fillInJobAccountsIo'
import type { MoveWindowAccountSource, MoveWindowAllocationSource, MoveWindowAskSource, MoveWindowInvoiceSource, MoveWindowRepSource, MoveWindowSources, MoveWindowWrites } from './fillInMoveWindow'

/**
 * The move-window kind's reads and writes (v2.6086, punch list #178): the still-current unpaid
 * charges not on a job account as Accounts payable reads them, their allocations, the single-job
 * pairs' accounts and reps, the houses, the job names and the open asks (fail-soft, as the tab
 * reads them). The writes are the move modal's: **moved** flips the invoice's flag and confirms
 * the open ask or writes a confirmed phone row, recording the account as opened when a reference
 * came with it; **asked** is the `request-job-account-move` edge function, one charge; **not
 * needed** is the job-account sheet's row. Undo unflags, drops or unconfirms the ask row it made,
 * and hands the account row back; an email cannot be unsent.
 */
export type MoveWindowSaved =
  | { choice: 'moved'; invoiceId: string; confirmedAskId: string | null; insertedAskId: string | null; account: JobAccountSaved | null }
  | { choice: 'asked'; invoiceId: string; sentTo: string }
  | { choice: 'not_needed'; invoiceId: string; account: JobAccountSaved }

export type MoveWindowFillInIo = {
  fetchSources: () => Promise<MoveWindowSources>
  save: (w: MoveWindowWrites) => Promise<MoveWindowSaved>
  undo: (saved: MoveWindowSaved) => Promise<void>
}

async function inChunks<T>(ids: readonly string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) out.push(...(await read(ids.slice(i, i + 200))))
  return out
}

export const moveWindowFillInIo: MoveWindowFillInIo = {
  async fetchSources() {
    const todayYmd = todayYmdInAppTz()
    const nowMs = Date.now()
    const invoices = ((await withSupabaseRetry(
      async () =>
        supabase
          .from('supply_house_invoices')
          .select('id, supply_house_id, invoice_number, purchase_order_number, invoice_date, amount, due_date, on_job_account')
          .eq('is_paid', false)
          .gt('amount', 0)
          .gte('due_date', todayYmd)
          .not('on_job_account', 'is', true),
      'fill in: move window charges',
    )) ?? []) as MoveWindowInvoiceSource[]
    const ids = invoices.map((i) => i.id)
    if (ids.length === 0) return { invoices, allocations: [], accounts: [], asks: [], reps: [], houses: [], jobs: [], todayYmd, nowMs }
    const allocations = await inChunks(ids, async (chunk) => ((await withSupabaseRetry(async () => supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id').in('invoice_id', chunk), 'fill in: move window allocations')) ?? []) as MoveWindowAllocationSource[])
    const perInvoice = new Map<string, string[]>()
    for (const a of allocations) (perInvoice.get(a.invoice_id) ?? perInvoice.set(a.invoice_id, []).get(a.invoice_id)!).push(a.job_id)
    const houseOf = new Map(invoices.map((i) => [i.id, i.supply_house_id]))
    const jobIds = new Set<string>()
    const houseIds = new Set<string>()
    for (const [invoiceId, jobs] of perInvoice) {
      if (jobs.length !== 1) continue
      jobIds.add(jobs[0]!)
      houseIds.add(houseOf.get(invoiceId) ?? '')
    }
    houseIds.delete('')
    const jobList = [...jobIds]
    const houseList = [...houseIds]
    const [accounts, reps, houses, jobs, asks] = await Promise.all([
      jobList.length > 0 && houseList.length > 0
        ? inChunks(jobList, async (chunk) => ((await withSupabaseRetry(async () => supabase.from('job_supply_house_accounts').select('job_id, supply_house_id, status, account_ref, opened_at, requested_at').in('job_id', chunk).in('supply_house_id', houseList), 'fill in: move window accounts')) ?? []) as MoveWindowAccountSource[])
        : Promise.resolve([] as MoveWindowAccountSource[]),
      houseList.length > 0
        ? withSupabaseRetry(async () => supabase.from('supply_house_contacts').select('id, supply_house_id, name, email, phone').in('supply_house_id', houseList).eq('role', 'job_accounts').is('archived_at', null), 'fill in: move window reps').then((rows) => (rows ?? []) as MoveWindowRepSource[])
        : Promise.resolve([] as MoveWindowRepSource[]),
      houseList.length > 0
        ? withSupabaseRetry(async () => supabase.from('supply_houses').select('id, name').in('id', houseList), 'fill in: move window houses').then((rows) => (rows ?? []) as Array<{ id: string; name: string }>)
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      jobAccountFillInIo.fetchJobs(jobList),
      // The asks read fails soft, as on the tab: no asks is a valid answer.
      inChunks(ids, async (chunk) => ((await withSupabaseRetry(async () => supabase.from('supply_house_invoice_move_requests').select('id, invoice_id, requested_at, via, sent_to').in('invoice_id', chunk).is('confirmed_at', null), 'fill in: move window asks')) ?? []) as MoveWindowAskSource[]).catch(() => [] as MoveWindowAskSource[]),
    ])
    return { invoices, allocations, accounts, asks, reps, houses, jobs, todayYmd, nowMs }
  },
  async save(w) {
    if (w.choice === 'moved') {
      await withSupabaseRetry(async () => supabase.from('supply_house_invoices').update({ on_job_account: true }).eq('id', w.invoiceId).select('id'), 'fill in: move window flag')
      const now = new Date().toISOString()
      const updated = (await withSupabaseRetry(async () => supabase.from('supply_house_invoice_move_requests').update({ confirmed_at: now }).eq('invoice_id', w.invoiceId).is('confirmed_at', null).select('id'), 'fill in: move window confirm')) as Array<{ id: string }> | null
      const confirmedAskId = updated?.[0]?.id ?? null
      let insertedAskId: string | null = null
      if (!confirmedAskId) {
        const inserted = (await withSupabaseRetry(async () => supabase.from('supply_house_invoice_move_requests').insert({ invoice_id: w.invoiceId, job_id: w.jobId, supply_house_id: w.houseId, via: 'phone', confirmed_at: now }).select('id'), 'fill in: move window phone row')) as Array<{ id: string }> | null
        insertedAskId = inserted?.[0]?.id ?? null
      }
      const account = w.account ? await jobAccountFillInIo.save(w.account) : null
      return { choice: 'moved', invoiceId: w.invoiceId, confirmedAskId, insertedAskId, account }
    }
    if (w.choice === 'asked') {
      const { data, error } = await supabase.functions.invoke('request-job-account-move', { body: { invoice_ids: [w.invoiceId], include_asked: w.includeAsked } })
      const payload = (data ?? {}) as { error?: string; asked?: string[]; sent_to?: string; held?: Array<{ invoice_id: string; reason: string }> }
      if (error || payload.error) throw new Error(payload.error ?? error?.message ?? 'The email did not send.')
      if (!(payload.asked ?? []).includes(w.invoiceId)) {
        const held = payload.held?.find((h) => h.invoice_id === w.invoiceId)
        throw new Error(held?.reason ?? 'The house was not asked.')
      }
      return { choice: 'asked', invoiceId: w.invoiceId, sentTo: payload.sent_to ?? w.sentTo }
    }
    const account = await jobAccountFillInIo.save(w.account)
    return { choice: 'not_needed', invoiceId: w.invoiceId, account }
  },
  async undo(saved) {
    if (saved.choice === 'moved') {
      await withSupabaseRetry(async () => supabase.from('supply_house_invoices').update({ on_job_account: false }).eq('id', saved.invoiceId).select('id'), 'fill in: undo move window flag')
      if (saved.insertedAskId) await withSupabaseRetry(async () => supabase.from('supply_house_invoice_move_requests').delete().eq('id', saved.insertedAskId!), 'fill in: undo move window phone row')
      if (saved.confirmedAskId) await withSupabaseRetry(async () => supabase.from('supply_house_invoice_move_requests').update({ confirmed_at: null }).eq('id', saved.confirmedAskId!).select('id'), 'fill in: undo move window confirm')
      if (saved.account) await jobAccountFillInIo.undo(saved.account)
      return
    }
    if (saved.choice === 'not_needed') await jobAccountFillInIo.undo(saved.account)
  },
}
