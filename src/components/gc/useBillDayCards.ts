/**
 * Messages, cut 9 (wave 2, helper 7): Bill day on each building job's card, the "Bill day · 3 of 7" pill and its line.
 * For the money team only, it reads at once for every job being built with a signed trade: their bills (the last
 * certificate is a gate), the walk's taps, the trades' word that they send nothing, and the cut-off. The same kernels as
 * From the trades then give each job its dates, how many trades are in and how many gates are clear, so the card and
 * the page never disagree.
 */
import { useEffect, useMemo, useState } from 'react'
import { billingStateForAll, type BillingRows } from '../../lib/gc/billCustomer'
import { cutoffOf, lineChecksOf, loadBillDayCutoff, loadBillDayNothing, loadLineChecks, nothingOf, type LineCheckRow, type NothingRow } from '../../lib/gc/billDay/billDayIo'
import { billDayDates, billDayGates, tradeDraws, walkDraws } from '../../lib/gc/billDay/trades'
import { claimsToCheck } from '../../lib/gc/billDay/walk'
import type { DrawTables } from '../../lib/gc/drawRows'
import { loadGcBillingRows } from '../../lib/gc/gcIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { billDayIds } from './useBillDay'

export interface BillDayCardFacts {
  billDay: string
  number: number
  cutoff: string
  /** Trades in, said to send nothing included, of those that draw this period. */
  inN: number
  of: number
  /** Gates clear, of seven. */
  ok: number
  gates: number
}

/** The jobs Bill day reads: being built, with a signed statement of work from a trade we hire. */
export function billDayJobs(state: GcState | null): GcProject[] {
  return state ? state.projects.filter((p) => p.stage === 'building' && p.packages.some((k) => !k.selfPerform && k.sow?.status === 'signed')) : []
}

/** Pure: one job's card facts from its reads, by the same kernels as From the trades. */
export function billDayCardFacts(state: GcState, project: GcProject, drawTables: DrawTables, checks: LineCheckRow[], nothing: NothingRow[], cutoff: number): BillDayCardFacts {
  const dates = billDayDates(state, project, cutoffOf(cutoff))
  const rows = tradeDraws(state, project, dates, nothingOf(nothing))
  const items = claimsToCheck(walkDraws(rows), lineChecksOf(checks, drawTables.sowLines), () => null)
  const gates = billDayGates(project, rows, dates, state.today, items, null)
  const counted = rows.filter((r) => r.state !== 'closing')
  return {
    billDay: dates.billDay,
    number: dates.number,
    cutoff: dates.cutoff,
    inN: counted.filter((r) => r.state !== 'notin' || r.nothing).length,
    of: counted.length,
    ok: gates.filter((g) => g.ok).length,
    gates: gates.length,
  }
}

interface Reads {
  billing: BillingRows
  checks: LineCheckRow[]
  nothing: NothingRow[]
  cutoff: number
}

export function useBillDayCards(board: GcState | null, drawTables: DrawTables, on: boolean): Map<string, BillDayCardFacts> {
  const jobs = useMemo(() => billDayJobs(board), [board])
  const ids = useMemo(() => {
    const each = jobs.map(billDayIds)
    return { jobIds: jobs.map((p) => p.id), drawIds: each.flatMap((x) => x.drawIds), sowIds: each.flatMap((x) => x.sowIds) }
  }, [jobs])
  const [reads, setReads] = useState<Reads | null>(null)
  const key = `${on}|${ids.jobIds.join(',')}|${ids.drawIds.join(',')}`
  useEffect(() => {
    if (!on || ids.jobIds.length === 0) {
      setReads(null)
      return
    }
    let live = true
    Promise.all([loadGcBillingRows(ids.jobIds), loadLineChecks(ids.drawIds), loadBillDayNothing(ids.sowIds), loadBillDayCutoff()])
      .then(([billing, checks, nothing, cutoff]) => {
        if (live) setReads({ billing, checks, nothing, cutoff })
      })
      // A card with no read shows no pill: the page's From the trades still reads and says what failed.
      .catch(() => {
        if (live) setReads(null)
      })
    return () => {
      live = false
    }
    // `key` stands for who reads, the jobs and their draws, which are read through `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return useMemo(() => {
    const out = new Map<string, BillDayCardFacts>()
    if (!board || !reads) return out
    const state = billingStateForAll(board, reads.billing, ids.jobIds)
    for (const id of ids.jobIds) {
      const project = state.projects.find((p) => p.id === id)
      if (project) out.set(id, billDayCardFacts(state, project, drawTables, reads.checks, reads.nothing, reads.cutoff))
    }
    return out
  }, [board, reads, drawTables, ids])
}
