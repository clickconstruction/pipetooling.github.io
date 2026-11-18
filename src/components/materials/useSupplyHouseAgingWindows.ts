/**
 * The Supply houses tab's aging windows, as an engine (SupplyHousesTab map, extraction step 10).
 *
 * The state, the reads and the writes behind two windows, moved from `SupplyHousesTab` as they stood: the window an
 * aging cell opens onto the bills it sums (v2.5673, by job since v2.5694), and the move window, the still-current
 * charges that can go onto a job account with its emailed ask and its attested move (punch list #132). The tab calls
 * the hook above its access gate, so the windows' state lives as long as the tab does, and the window itself
 * (`AgingCellWindow`) only draws.
 *
 * It reads the book and never loads it. Its one write to the book is the job-account flag on one unpaid bill.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import {
  invoicesForAgingCell,
  movableCandidates,
  movableWindowRows,
  notNeededInvoiceIds,
  singleJobPairs,
  withEmailedAsks,
  type MoveAsk,
  type AgingCellKey,
} from '../../lib/supplyHouseAging'
import {
  groupAllocationsByInvoice,
} from '../../lib/materials/supplyHouseInvoiceForm'
import { accountsByPair, repsByHouse, type JobAccountRep, type JobSupplyHouseAccountRow } from '../../lib/materials/jobSupplyHouseAccounts'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { jobsLedgerNames, type JobsLedgerNameRow } from '../../lib/materials/supplyHouseBillRows'
import { type AgingInvoiceRow, type InvoiceJobAllocation } from './useSupplyHouseAccountsPayable'
import type { SupplyHouse } from './useSupplyHouseInvoiceForm'


/** An open (unconfirmed) job-account move ask (PR 3) — the follow-up the office owes. */
export type MoveAskRow = MoveAsk

/** What the tab lends the aging windows, under the tab's own names. */
export type SupplyHouseAgingWindowsHost = {
  /** The book's unpaid bills, and the setter the job-account flag patches one row through. */
  agingUnpaidInvoices: AgingInvoiceRow[]
  setAgingUnpaidInvoices: Dispatch<SetStateAction<AgingInvoiceRow[]>>
  agingBookLoaded: boolean
  /** The open house: a flag flipped on one of its bills makes it read again. */
  selectedSupplyHouseForDetail: SupplyHouse | null
  loadSupplyHouseDetail: (sh: SupplyHouse) => Promise<unknown>
  setError: (message: string | null) => void
  /** The Needs You line's door: `movable` opens the worked list once the book and its jobs have read. */
  openList?: 'movable' | 'finish' | null
  onOpenListHandled?: () => void
}

export function useSupplyHouseAgingWindows(host: SupplyHouseAgingWindowsHost) {
  const { agingUnpaidInvoices, setAgingUnpaidInvoices, agingBookLoaded, selectedSupplyHouseForDetail, loadSupplyHouseDetail, setError, openList, onOpenListHandled } = host

  /** The open aging-cell drill-down (v2.5673): which cell's invoices the modal lists.
   *  'movable' (PR 3) is the worked list — every still-current charge not on a job account. */
  const [agingCellModal, setAgingCellModal] = useState<{ houseId: string | null; cell: AgingCellKey | 'movable' } | null>(null)
  /** The open cell's job allocations and job names, fetched once per modal open. */
  const [agingCellJobs, setAgingCellJobs] = useState<{
    allocations: Record<string, InvoiceJobAllocation[]>
    jobs: Record<string, { hcp_number: string; click_number?: string; job_name: string }>
  }>({ allocations: {}, jobs: {} })
  /**
   * PR 2 (punch list #132): the (job, house) account rows behind the modal's job headings, keyed
   * `${jobId}:${houseId}` (an entry of null = checked, none on record), the job-accounts reps
   * per house for the Mark opened sheet, which invoice's Mark opened sheet is up — from a job
   * heading (v2.5694) it only records the account; from the move modal, saved open also flags the
   * invoice — and which job (`${jobId}:${houseId}`) has Flag anyway unfolded. All cleared when the
   * modal closes.
   */
  const [agingCellAccounts, setAgingCellAccounts] = useState<Record<string, JobSupplyHouseAccountRow | null>>({})
  const [agingCellAccountsLoaded, setAgingCellAccountsLoaded] = useState(false)
  const [agingCellReps, setAgingCellReps] = useState<Record<string, JobAccountRep[]>>({})
  const [agingCellMarkOpenedFor, setAgingCellMarkOpenedFor] = useState<{ inv: AgingInvoiceRow; flagOnOpen: boolean } | null>(null)
  const [agingCellFlagAnywayFor, setAgingCellFlagAnywayFor] = useState<string | null>(null)

  const [agingCellJobsRefresh, setAgingCellJobsRefresh] = useState(0)

  /**
   * PR 3 (the move window): the allocations and open asks behind the strip — read once per
   * summary load for the still-current unflagged invoices — plus the move modal's state.
   * The asks read tolerates the table not existing yet (the client can deploy first).
   */
  const [agingMoveData, setAgingMoveData] = useState<{
    allocations: Record<string, InvoiceJobAllocation[]>
    asks: Record<string, MoveAskRow>
    /** Candidates whose one job's account at the house is on record as not needed (v2.6086, punch list #178): out of the window. */
    notNeeded: ReadonlySet<string>
    loaded: boolean
  }>({ allocations: {}, asks: {}, notNeeded: new Set(), loaded: false })
  /** Which unpaid book (by identity) the move data above was read for, and whether the book itself has loaded once — the worked-list door waits on both. */
  const [agingMoveDataBook, setAgingMoveDataBook] = useState<AgingInvoiceRow[] | null>(null)
  const [agingMoveModalFor, setAgingMoveModalFor] = useState<string | null>(null)
  const [agingMoveAttest, setAgingMoveAttest] = useState(false)
  const [agingMoveBusy, setAgingMoveBusy] = useState<null | 'send' | 'move' | string>(null)
  const [agingMoveError, setAgingMoveError] = useState<string | null>(null)

  // The aging-cell modal's Jobs column (v2.5673): one allocations read for just the listed
  // invoices, then the job names — fetched once per open, never for the whole book.
  useEffect(() => {
    if (!agingCellModal) {
      setAgingCellJobs({ allocations: {}, jobs: {} })
      setAgingCellAccounts({})
      setAgingCellAccountsLoaded(false)
      setAgingCellReps({})
      setAgingCellMarkOpenedFor(null)
      setAgingCellFlagAnywayFor(null)
      return
    }
    const cellRows =
      agingCellModal.cell === 'movable'
        ? movableWindowRows(agingUnpaidInvoices, todayYmdInAppTz(), agingMoveData)
        : invoicesForAgingCell(agingUnpaidInvoices, agingCellModal.houseId, agingCellModal.cell, todayYmdInAppTz())
    const ids = cellRows.map((r) => r.id)
    if (ids.length === 0) {
      setAgingCellAccountsLoaded(true)
      return
    }
    const houseByInvoice = new Map(cellRows.map((r) => [r.id, r.supply_house_id]))
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('supply_house_invoice_job_allocations')
        .select('invoice_id, job_id, pct')
        .in('invoice_id', ids)
      if (cancelled) return
      const allocations = groupAllocationsByInvoice((data ?? []) as { invoice_id: string; job_id: string; pct: number }[])
      const jobIds = [...new Set(Object.values(allocations).flat().map((a) => a.job_id))]
      // PR 2: the chips need the (job, house) account rows — only the single-job pairs can
      // carry the flag — and each involved house's job-accounts reps for the Mark opened sheet.
      const pairs = singleJobPairs(allocations, houseByInvoice).filter((p) => p.houseId)
      const pairJobIds = [...new Set(pairs.map((p) => p.jobId))]
      const pairHouseIds = [...new Set(pairs.map((p) => p.houseId))]
      const [jobRes, accRes, repRes] = await Promise.all([
        jobIds.length > 0 ? supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }) : Promise.resolve({ data: [] }),
        pairs.length > 0
          ? supabase
              .from('job_supply_house_accounts')
              .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
              .in('job_id', pairJobIds)
              .in('supply_house_id', pairHouseIds)
          : Promise.resolve({ data: [] }),
        pairHouseIds.length > 0
          ? supabase
              .from('supply_house_contacts')
              .select('id, supply_house_id, name, email, phone')
              .in('supply_house_id', pairHouseIds)
              .eq('role', 'job_accounts')
              .is('archived_at', null)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const jobs = jobsLedgerNames((jobRes.data ?? []) as JobsLedgerNameRow[])
      const accounts = accountsByPair(pairs, (accRes.data ?? []) as JobSupplyHouseAccountRow[])
      const reps: Record<string, JobAccountRep[]> = repsByHouse((repRes.data ?? []) as Array<JobAccountRep & { supply_house_id: string }>)
      setAgingCellJobs({ allocations, jobs })
      setAgingCellAccounts(accounts)
      setAgingCellReps(reps)
      setAgingCellAccountsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agingCellModal, agingCellJobsRefresh])


  /**
   * PR 2's one write: the flag flips, every reader re-derives from the same state (the
   * matrix, the teal lines, the open modal's footer), and an expanded house showing the
   * same invoice reloads so its table agrees.
   */
  // PR 3: the strip's data — allocations and open asks for the still-current unflagged
  // invoices, re-read whenever the book reloads. Small sets; one query each.
  useEffect(() => {
    const candidates = movableCandidates(agingUnpaidInvoices, todayYmdInAppTz())
    const ids = candidates.map((r) => r.id)
    if (ids.length === 0) {
      setAgingMoveData({ allocations: {}, asks: {}, notNeeded: new Set(), loaded: true })
      setAgingMoveDataBook(agingUnpaidInvoices)
      return
    }
    let cancelled = false
    void (async () => {
      const [allocRes, askRes] = await Promise.all([
        supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('invoice_id', ids),
        supabase
          .from('supply_house_invoice_move_requests')
          .select('id, invoice_id, requested_at, via, sent_to')
          .in('invoice_id', ids)
          .is('confirmed_at', null),
      ])
      if (cancelled) return
      const allocations = groupAllocationsByInvoice((allocRes.data ?? []) as { invoice_id: string; job_id: string; pct: number }[])
      const asks: Record<string, MoveAskRow> = {}
      // askRes.error: the table may not be pushed yet — the strip still works, with no asks.
      for (const r of (askRes.error ? [] : askRes.data ?? []) as MoveAskRow[]) asks[r.invoice_id] = r
      // v2.6086: a single-job candidate whose job's account at the house is marked not needed leaves the window.
      const houseOf = new Map(candidates.map((r) => [r.id, r.supply_house_id]))
      const pairs = singleJobPairs(allocations, houseOf)
      let notNeeded = new Set<string>()
      if (pairs.length > 0) {
        const accRes = await supabase
          .from('job_supply_house_accounts')
          .select('job_id, supply_house_id')
          .in('job_id', [...new Set(pairs.map((p) => p.jobId))])
          .in('supply_house_id', [...new Set(pairs.map((p) => p.houseId))])
          .eq('status', 'not_needed')
        if (cancelled) return
        notNeeded = notNeededInvoiceIds(pairs, (accRes.data ?? []) as { job_id: string; supply_house_id: string }[])
      }
      setAgingMoveData({ allocations, asks, notNeeded, loaded: true })
      setAgingMoveDataBook(agingUnpaidInvoices)
    })()
    return () => {
      cancelled = true
    }
  }, [agingUnpaidInvoices])

  // The Needs You line's door (v2.5723): `?list=movable` opens the worked list — the same modal
  // the strip's Work the list opens — once the move data is for the book on screen, so the
  // modal's one-time jobs fetch sees the rows. Handled once; the parent drops the param.
  useEffect(() => {
    if (openList !== 'movable' || !agingBookLoaded || agingMoveDataBook !== agingUnpaidInvoices) return
    setAgingCellModal({ houseId: null, cell: 'movable' })
    onOpenListHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openList, agingBookLoaded, agingMoveDataBook, agingUnpaidInvoices])

  /** PR 3: email the house's job-accounts rep the move request for these invoices (one house per call). */
  async function sendMoveRequest(invoiceIds: string[], busyKey: string, includeAsked: boolean): Promise<void> {
    if (invoiceIds.length === 0) return
    setAgingMoveBusy(busyKey)
    setAgingMoveError(null)
    const { data, error } = await supabase.functions.invoke('request-job-account-move', {
      body: { invoice_ids: invoiceIds, include_asked: includeAsked },
    })
    setAgingMoveBusy(null)
    const payload = (data ?? {}) as { error?: string; asked?: string[]; sent_to?: string }
    if (error || payload.error) {
      setAgingMoveError(payload.error ?? error?.message ?? 'The email did not send.')
      return
    }
    const now = new Date().toISOString()
    setAgingMoveData((prev) => ({ ...prev, asks: withEmailedAsks(prev.asks, payload.asked ?? invoiceIds, now, payload.sent_to ?? '') }))
  }

  /** PR 3: the attested call — the flag flips, and the ask (or a fresh phone row) is confirmed. */
  async function markMovedConfirmed(inv: AgingInvoiceRow, jobId: string): Promise<void> {
    setAgingMoveBusy('move')
    setAgingMoveError(null)
    await setInvoiceJobAcct(inv, true)
    const now = new Date().toISOString()
    // Confirm the open ask if one exists; a pure phone move writes its own confirmed record.
    const { data: updated, error: updErr } = await supabase
      .from('supply_house_invoice_move_requests')
      .update({ confirmed_at: now })
      .eq('invoice_id', inv.id)
      .is('confirmed_at', null)
      .select('id')
    if (!updErr && (updated ?? []).length === 0) {
      await supabase.from('supply_house_invoice_move_requests').insert({
        invoice_id: inv.id,
        job_id: jobId,
        supply_house_id: inv.supply_house_id,
        via: 'phone',
        confirmed_at: now,
      })
    }
    setAgingMoveData((prev) => {
      const asks = { ...prev.asks }
      delete asks[inv.id]
      return { ...prev, asks }
    })
    setAgingMoveModalFor(null)
    setAgingMoveAttest(false)
    setAgingMoveBusy(null)
  }

  async function setInvoiceJobAcct(inv: AgingInvoiceRow, on: boolean) {
    const { error } = await supabase.from('supply_house_invoices').update({ on_job_account: on }).eq('id', inv.id)
    if (error) {
      setError(`Could not ${on ? 'flag' : 'unflag'} ${inv.invoice_number}: ${error.message}`)
      return
    }
    setAgingUnpaidInvoices((prev) => prev.map((r) => (r.id === inv.id ? { ...r, on_job_account: on } : r)))
    if (selectedSupplyHouseForDetail?.id === inv.supply_house_id) void loadSupplyHouseDetail(selectedSupplyHouseForDetail)
  }

  return {
    agingCellModal,
    setAgingCellModal,
    agingCellJobs,
    agingCellAccounts,
    setAgingCellAccounts,
    agingCellAccountsLoaded,
    agingCellReps,
    agingCellMarkOpenedFor,
    setAgingCellMarkOpenedFor,
    agingCellFlagAnywayFor,
    setAgingCellFlagAnywayFor,
    agingMoveData,
    agingMoveModalFor,
    setAgingMoveModalFor,
    agingMoveAttest,
    setAgingMoveAttest,
    agingMoveBusy,
    agingMoveError,
    setAgingMoveError,
    sendMoveRequest,
    markMovedConfirmed,
    setInvoiceJobAcct,
    setAgingCellJobsRefresh,
  }
}

/** The aging windows as their window reads them. */
export type SupplyHouseAgingWindows = ReturnType<typeof useSupplyHouseAgingWindows>
