import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadJobsOpenedFromBids } from '../lib/bids/bidJobsOpenedIo'
import { bidBoardJobLinkLabel } from '../lib/bids/bidBoardJobLinks'
import { bidDayEntries, bidDayMarksFromKept, bidDayNote, buildBidDayList, readBidDay, type BidDayEntry, type BidDayList, type BidDayPayload } from '../lib/clock/bidDay'
import { fetchMyBidDay } from '../lib/clock/bidDayIo'
import { formatBidLedgerShortLine, type LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'

/** A bid as the clock's own picks carry it: the board's bids and a bid picked from the sheet's search. */
export type BidDayPick = { id: string; bid_number: string | null; project_name: string | null; service_type_id?: string | null }

export type ClockOutBidDay = {
  /** True once the day is read and the sheet has a list to draw: the day holds a bid, or the person is an estimator. */
  show: boolean
  list: BidDayList
  /** The company's day the list is for, 'YYYY-MM-DD'. '' until the day is read. */
  workDate: string
  /** The board's bids that are not on the list yet. */
  board: Array<{ id: string; name: string }>
  /** Takes a kept bid off, puts one back, or ticks an opened bid onto the list. */
  toggle: (bidId: string) => void
  /** Adds a bid the app missed. A bid the day already holds is ticked instead. */
  add: (pick: BidDayPick) => void
  /** The note the clock session carries: one line a kept bid, then what the person typed. */
  noteWith: (typed: string) => string
  /** The rows the press keeps. */
  entries: () => BidDayEntry[]
}

/**
 * The bids of the day at clock out (punch list #445): reads the person's own day when the sheet opens and holds what
 * they do to the list until the press. A read that fails shows no list at all, and the sheet asks for the typed
 * note as it always has: the list never stands between a person and their clock out.
 */
export function useClockOutBidDay(opts: {
  open: boolean
  userId: string | null | undefined
  role: string | null | undefined
  prefixMap: LedgerPrefixMap
  boardPicks: readonly BidDayPick[]
}): ClockOutBidDay {
  const { open, userId, role, prefixMap, boardPicks } = opts
  const [payload, setPayload] = useState<BidDayPayload | null>(null)
  const [marks, setMarks] = useState<Map<string, 'kept' | 'off'>>(() => new Map())
  const [added, setAdded] = useState<string[]>([])
  const [extraNames, setExtraNames] = useState<Map<string, BidDayPick>>(() => new Map())
  const [jobs, setJobs] = useState<Map<string, string>>(() => new Map())
  const readGen = useRef(0)

  useEffect(() => {
    if (!open || !userId) {
      readGen.current++
      setPayload(null)
      setMarks(new Map())
      setAdded([])
      setExtraNames(new Map())
      setJobs(new Map())
      return
    }
    const gen = ++readGen.current
    void (async () => {
      try {
        const data = await fetchMyBidDay()
        if (gen !== readGen.current || !data) return
        setPayload(data)
        setMarks(bidDayMarksFromKept(data.kept))
        const ids = (data.bids ?? []).map((b) => b.id)
        if (ids.length === 0) return
        const opened = await loadJobsOpenedFromBids(ids)
        if (gen !== readGen.current) return
        const byBid = new Map<string, string>()
        // Newest first: a bid that opened two jobs shows the newest.
        for (const j of opened) if (!byBid.has(j.bidId)) byBid.set(j.bidId, bidBoardJobLinkLabel(j.hcpNumber))
        setJobs(byBid)
      } catch {
        /* no list: the sheet asks for the note as it always has */
      }
    })()
  }, [open, userId])

  const read = useMemo(() => readBidDay(payload), [payload])
  const names = useMemo(() => {
    const known = new Map<string, BidDayPick>()
    for (const b of payload?.bids ?? []) known.set(b.id, b)
    for (const b of boardPicks) if (!known.has(b.id)) known.set(b.id, b)
    for (const [id, b] of extraNames) if (!known.has(id)) known.set(id, b)
    return {
      nameOf: (bidId: string) => {
        const b = known.get(bidId)
        return b ? formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name) : 'A bid'
      },
      jobOf: (bidId: string) => jobs.get(bidId) ?? null,
    }
  }, [payload, boardPicks, extraNames, prefixMap, jobs])
  const list = useMemo(() => buildBidDayList(read, marks, added, names), [read, marks, added, names])

  const toggle = useCallback(
    (bidId: string) => {
      const row = list.worked.find((r) => r.bidId === bidId)
      setMarks((prev) => {
        const next = new Map(prev)
        next.set(bidId, row && row.kept ? 'off' : 'kept')
        return next
      })
    },
    [list],
  )
  const add = useCallback(
    (pick: BidDayPick) => {
      if (!pick.id) return
      setExtraNames((prev) => (prev.has(pick.id) ? prev : new Map(prev).set(pick.id, pick)))
      setMarks((prev) => new Map(prev).set(pick.id, 'kept'))
      setAdded((prev) => (prev.includes(pick.id) ? prev : [...prev, pick.id]))
    },
    [],
  )

  const onList = useMemo(() => new Set([...list.worked, ...list.opened].map((r) => r.bidId)), [list])
  const board = useMemo(
    () => boardPicks.filter((b) => !onList.has(b.id)).map((b) => ({ id: b.id, name: formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name) })),
    [boardPicks, onList, prefixMap],
  )
  const show = payload != null && (!list.empty || role === 'estimator')
  const noteWith = useCallback((typed: string) => bidDayNote(list, typed), [list])
  const entries = useCallback(() => bidDayEntries(list), [list])
  return { show, list, workDate: payload?.day ?? '', board, toggle, add, noteWith, entries }
}
