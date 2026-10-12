/**
 * Messages, cut 9 (wave 2, helper 7): Bill day for one job, read and worked out. It reads the walk's taps, the trades'
 * word that they send nothing, where each line is on site and the cut-off (`billDayIo.ts`), then lays them through the
 * kernels (`src/lib/gc/billDay/`): the dates, one row per trade, the claims to check, the seven gates and the river. Its
 * presses read again what they changed. `state` is the board with the trades' draws laid over it (and the job's
 * schedule, for what the schedule says), and `drawTables` the rows `loadGcDraws` read, which name each line.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cutoffOf,
  lineChecksOf,
  loadBillDayCutoff,
  loadBillDayNothing,
  loadLineChecks,
  loadWhereOnSite,
  nothingOf,
  photoLinksOf,
  putBackNothing,
  recordLineCheck,
  sayNothingThisPeriod,
  setBillDayCutoff,
  whereOnSiteOf,
  type LineCheckRow,
  type NothingRecord,
  type NothingRow,
} from '../../lib/gc/billDay/billDayIo'
import { billRiver, type BillRiver } from '../../lib/gc/billDay/summary'
import { billDayDates, billDayGates, scheduleSays, tradeDraws, walkDraws, type BillDayDates, type BillDayGate, type TradeDraw } from '../../lib/gc/billDay/trades'
import { claimsToCheck, type ClaimToCheck } from '../../lib/gc/billDay/walk'
import type { DrawTables } from '../../lib/gc/drawRows'
import type { GcProject, GcState } from '../../lib/gc/types'
import { formatErrorMessage } from '../../utils/errorHandling'

export interface BillDayRead {
  dates: BillDayDates
  rows: TradeDraw[]
  /** The walk: the claims to check on the draws waiting on us, in walking order. */
  items: ClaimToCheck[]
  gates: BillDayGate[]
  river: BillRiver
  /** Each tap's photo link, by `drawId:sovId`, the newest kept. */
  photos: Map<string, string>
  nothing: NothingRecord[]
  cutoff: number
}

export interface BillDayWrites {
  /** A tap of the walk: the percent seen, or whether the stored material is on site, with a photo link and a note. */
  tap: (t: { drawId: string; sovId: string; weSee: number | null; onSite: boolean | null; photoUrl?: string; note?: string }) => Promise<boolean>
  /** Nothing this period, said by whom. */
  sayNothing: (row: TradeDraw, saidBy: string) => Promise<boolean>
  /** Put it back: the trade reads as not in again. */
  putBack: (row: TradeDraw) => Promise<boolean>
  setCutoff: (days: number) => Promise<boolean>
}

interface Reads {
  checks: LineCheckRow[]
  nothing: NothingRow[]
  where: { id: string; scope_item_id: string | null; where_on_site: string | null }[]
  cutoff: number
}

/** The ids Bill day reads by on one job: every draw of its trades, the ones sent back too, and their statements of work. */
export function billDayIds(project: GcProject): { drawIds: string[]; sowIds: string[] } {
  const sows = project.packages.flatMap((p) => (p.sow && !p.selfPerform ? [p.sow] : []))
  return {
    drawIds: sows.flatMap((s) => [...s.draws.map((d) => d.id), ...(s.sentBack ?? []).map((b) => b.draw.id)]),
    sowIds: sows.flatMap((s) => (s.id ? [s.id] : [])),
  }
}

export function useBillDay(
  state: GcState | null,
  project: GcProject | null,
  drawTables: DrawTables | null,
  superintendent: string | null,
): { read: BillDayRead | null; writes: BillDayWrites; busy: boolean; problem: string | null } {
  const [reads, setReadsState] = useState<Reads | null>(null)
  const readsRef = useRef<Reads | null>(null)
  const setReads = useCallback((r: Reads | null) => {
    readsRef.current = r
    setReadsState(r)
  }, [])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const latest = useRef(project)
  latest.current = project
  const ids = useMemo(() => (project ? billDayIds(project) : { drawIds: [], sowIds: [] }), [project])
  // Read again when the job or its draws change, not on every new board object.
  const key = `${project?.id ?? ''}|${ids.drawIds.join(',')}|${ids.sowIds.join(',')}`

  useEffect(() => {
    if (!latest.current) return
    let live = true
    setReads(null)
    setProblem(null)
    Promise.all([loadLineChecks(ids.drawIds), loadBillDayNothing(ids.sowIds), loadWhereOnSite(ids.sowIds), loadBillDayCutoff()])
      .then(([checks, nothing, where, cutoff]) => {
        if (live) setReads({ checks, nothing, where, cutoff })
      })
      .catch((e: unknown) => {
        if (live) setProblem(formatErrorMessage(e, 'Bill day did not load.'))
      })
    return () => {
      live = false
    }
    // `key` stands for the job and its ids; they are read through `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setReads])

  const read = useMemo((): BillDayRead | null => {
    if (!state || !project || !drawTables || !reads) return null
    const dates = billDayDates(state, project, cutoffOf(reads.cutoff))
    const nothing = nothingOf(reads.nothing)
    const rows = tradeDraws(state, project, dates, nothing)
    const where = whereOnSiteOf(reads.where)
    const items = claimsToCheck(
      walkDraws(rows),
      lineChecksOf(reads.checks, drawTables.sowLines),
      (sovId) => where[sovId] ?? null,
      (sovId) => scheduleSays(project, sovId, dates.billDay),
    )
    return {
      dates,
      rows,
      items,
      gates: billDayGates(project, rows, dates, state.today, items, superintendent),
      river: billRiver(state, project, rows, dates),
      photos: photoLinksOf(reads.checks, drawTables.sowLines),
      nothing,
      cutoff: dates.cutoffDays,
    }
  }, [state, project, drawTables, reads, superintendent])

  /** A press, then the read it changed; its problem in words, or true. */
  const press = useCallback(async (run: () => Promise<unknown>, again: (r: Reads) => Promise<Reads>, fallback: string): Promise<boolean> => {
    setBusy(true)
    setProblem(null)
    try {
      await run()
      const was = readsRef.current
      if (was) setReads(await again(was))
      return true
    } catch (e) {
      setProblem(formatErrorMessage(e, fallback))
      return false
    } finally {
      setBusy(false)
    }
  }, [setReads])

  const writes = useMemo(
    (): BillDayWrites => ({
      tap: (t) => press(() => recordLineCheck(t), async (r) => ({ ...r, checks: await loadLineChecks(ids.drawIds) }), 'The tap was not kept.'),
      sayNothing: (row, saidBy) =>
        press(
          () => sayNothingThisPeriod(row.sow.id ?? '', read?.dates.billDay ?? '', saidBy),
          async (r) => ({ ...r, nothing: await loadBillDayNothing(ids.sowIds) }),
          'Nothing this period was not recorded.',
        ),
      putBack: (row) =>
        press(
          async () => {
            const said = read?.nothing.find((n) => n.sowId === (row.sow.id ?? row.packageId) && n.periodTo === read.dates.billDay)
            if (said) await putBackNothing(said.id)
          },
          async (r) => ({ ...r, nothing: await loadBillDayNothing(ids.sowIds) }),
          'It was not put back.',
        ),
      setCutoff: (days) => press(() => setBillDayCutoff(days), async (r) => ({ ...r, cutoff: await loadBillDayCutoff() }), 'The cut-off did not change.'),
    }),
    [press, ids, read],
  )

  return { read, writes, busy, problem }
}
