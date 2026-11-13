import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { Json } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { useOverheadOfficeJobId } from '../../hooks/useOverheadOfficeJobId'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { useStaleTallyStaffFollowUp } from '../../hooks/useStaleTallyStaffFollowUp'
import { TALLY_STALE_MIN_AGE_DAYS } from '../../lib/tallyStaleMinAgeDays'
import { parseTallyJobSplitsJson } from '../../lib/tallyJobSplits'
import { fetchOffsetPersonNameOptions } from '../../lib/offsetPersonNameOptions'
import type { SortedTeamPurchaseRow } from '../../lib/teamPurchasesSorted'
import {
  fetchRecentlySortedTeamPurchases,
  fetchTallyJobLabels,
  fetchTallyTeamQueue,
  TALLY_TEAM_SORTED_WINDOW_DAYS,
  type TallyTeamQueueReads,
} from '../../lib/tally/fetchTallyTeamQueue'
import { buildTallyTeamQueue, type TallyQueueCard } from '../../lib/tally/tallyTeamQueue'
import { mercuryTxRowFromStaffListRow, staffListRowFromSorted, type StaleStaffRow } from '../../lib/tally/teamPurchaseRows'
import { assignChargeToOfficeAsStaff, backchargeDraftForCharge } from '../../lib/tally/tallyBackcharge'
import { tallyUndoLineFromSortedRow, tallyUndoRpcArgs, tallyUndoToast, type TallyUndoLine } from '../../lib/tally/tallyUndoLine'
import { tallyPayMarkToast, tallyPaySendGroups, tallyPayUnmarkToast, type TallyPaySendGroup } from '../../lib/tally/tallyPaySends'
import type { TallyChoice, TallySuggestion } from '../../lib/tally/tallySortSuggestion'
import {
  pickDayChip,
  pickLineChoice,
  rowsForSelection,
  toggleLineByHours,
  type TallyLineSelection,
} from '../../lib/tally/tallyTeamSelections'
import { MercuryTransactionAllocationsModal } from '../MercuryTransactionAllocationsModal'
import MercuryTransactionInvoiceLinkModal from '../MercuryTransactionInvoiceLinkModal'
import { TeamPurchasesSortedList } from '../TeamPurchasesSortedList'
import { PersonOffsetFormModal, type PersonOffsetInitialDraft } from '../pay/PersonOffsetFormModal'
import { TallyTeamDayCard } from './TallyTeamDayCard'
import { TeamTicketsList } from './TeamTicketsList'
import { TicketWindow } from '../tickets/TicketWindow'
import { TallyChooseJobSheet } from './TallyChooseJobSheet'
import { ticketJobIds, type TicketPaidOther } from '../../lib/tickets/ticket'
import type { TicketJobFacts } from '../../lib/tickets/ticketJobs'
import { officeTicketRows, ticketJobByCharge as ticketJobByChargeOf, ticketsByCharge, ticketsTabLabel, type ChargeSplit } from '../../lib/tickets/ticketOffice'
import type { TicketMatch } from '../../lib/tickets/ticketMatch'
import { answerTicketNo, answerTicketYes, listOfficeTickets, markTicketUsed, markTicketsUsedByCharge, matchChargeFromStaffRow, matchChargeFromWindowRow, mergeMatchCharges, runTicketMatches, setTicketPaidOther } from '../../lib/tickets/ticketMatchIo'
import { loadJobsForTicketPick, loadTicketJobFacts } from '../../lib/tickets/ticketSheetIo'
import { ticketScreensIo } from '../../lib/tickets/ticketScreensIo'
import { receiptCopiedWords } from '../../lib/tickets/receiptLink'
import { copyReceiptLinkFor } from '../../lib/tickets/receiptLinkIo'
import { useTicketCapture } from '../../hooks/useTicketCapture'
import { useNavigate } from 'react-router-dom'
import type { TicketWithPages } from '../../lib/tickets/ticketsIo'
import type { ChooseJobRow } from '../../lib/tally/chooseJobSearch'
import { tallyDayKey } from '../../lib/tally/tallySortSuggestion'
import { formatTallyCurrency } from '../../lib/tally/formatTallyPosted'
import { TallyPayBar } from './TallyPayBar'

/**
 * Job Parts Tally → Transactions → Team (punch list #72, PR 2a): the office's queue of the team's
 * unsorted card charges, one card per person per day. Each card says the holder's day in words and
 * offers the day's chips with the likely one first; nothing is selected until the sorter taps.
 * *Sort the day* writes each selected charge through the staff split RPC, one call per charge.
 * Undo (PR 3, its first half) puts a charge sorted to jobs back: on the message after Sort the day,
 * on a card's sorted line, and on a row of Sorted, each through the same RPC with no rows.
 * The pay bar (PR 3, its second half; the owner's call 2026-10-09) gathers each card's Cash App pay
 * sends and marks them payroll through `set_tally_payroll_flag`, shown only when `canMarkPayroll`
 * (dev, controller, a pay-approved master); it marks and does not widen a rule (rules are dev-only).
 * The Dashboard and Quickfill *Team purchases* window keeps working beside it until PR 2b.
 */

const EMPTY_JOB_LABEL_BY_ID: Record<string, string> = {}

const segmentStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.8rem',
  minHeight: 36,
  borderRadius: 999,
  border: active ? '1px solid #2563eb' : '1px solid var(--border)',
  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
  fontWeight: 600,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
})

function chargesWords(n: number): string {
  return `${n} ${n === 1 ? 'charge' : 'charges'}`
}

export function TallyTeamQueue({ canMarkPayroll = false }: { canMarkPayroll?: boolean }) {
  const { user: authUser } = useAuth()
  const { showToast, showActionToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const officeJobId = useOverheadOfficeJobId(true)
  const isNarrow = useNarrowViewport640()
  const { nicknameByAccount, nicknameByDebitCard } = useMercuryLedgerNicknames({ enabled: true })
  const { transactionCount: staleCount, refetch: refetchStale } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)

  const [reads, setReads] = useState<TallyTeamQueueReads | null>(null)
  const [loadedAt, setLoadedAt] = useState(() => Date.now())
  const [sortedRows, setSortedRows] = useState<SortedTeamPurchaseRow[] | null>(null)
  const [labels, setLabels] = useState<Record<string, string>>({})
  /** Job ids already asked for, so a job that never resolves is not asked for again. */
  const askedLabels = useRef(new Set<string>())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<'to-sort' | 'sorted' | 'tickets'>('to-sort')
  /** Counter tickets (punch list #295, PR 3): every live ticket in the queue's window, the matcher's answers, and the jobs they name. */
  const [tickets, setTickets] = useState<TicketWithPages[]>([])
  const [ticketMatches, setTicketMatches] = useState<ReadonlyMap<string, TicketMatch>>(new Map())
  const [ticketJobs, setTicketJobs] = useState<ReadonlyMap<string, TicketJobFacts>>(new Map())
  const [openTicket, setOpenTicket] = useState<TicketWithPages | null>(null)
  const [ticketBusy, setTicketBusy] = useState<string | null>(null)
  const [pickJobFor, setPickJobFor] = useState<TicketWithPages | null>(null)
  const [receiptLinkBusyId, setReceiptLinkBusyId] = useState<string | null>(null)
  const [pickJobs, setPickJobs] = useState<ChooseJobRow[] | null>(null)
  /** + Ticket (PR 4): the desk's scan of a paper handed in, tied to the charge it was pressed on. */
  const deskCapture = useTicketCapture()
  const navigate = useNavigate()
  const deskForRef = useRef<StaleStaffRow | null>(null)
  const deskSending = useRef(false)
  const [person, setPerson] = useState<string | null>(null)
  const [selections, setSelections] = useState<Map<string, TallyLineSelection>>(() => new Map())
  const [lineErrors, setLineErrors] = useState<Map<string, string>>(() => new Map())
  const [busyCard, setBusyCard] = useState<string | null>(null)
  const [undoBusyIds, setUndoBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  /** The cards whose pay sends are being marked: one entry per bar, so two bars never share a busy flag. */
  const [payBusyHolders, setPayBusyHolders] = useState<ReadonlySet<string>>(() => new Set())
  const payBusyRef = useRef(new Set<string>())
  const [allocRow, setAllocRow] = useState<StaleStaffRow | null>(null)
  const [invoiceRow, setInvoiceRow] = useState<StaleStaffRow | null>(null)
  const [backchargeBusyId, setBackchargeBusyId] = useState<string | null>(null)
  const [offsetDraft, setOffsetDraft] = useState<PersonOffsetInitialDraft | null>(null)
  const [offsetNames, setOffsetNames] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [next, sorted] = await Promise.all([fetchTallyTeamQueue(), fetchRecentlySortedTeamPurchases()])
      setReads(next)
      setSortedRows(sorted)
      setLoadedAt(Date.now())
      // The tickets in the window, and the matcher over every charge the queue read: a match it makes is written here.
      try {
        // The tickets from the oldest charge the window read, so a ticket meets any charge the queue can show.
        const since = next.history.reduce((m, r) => (r.postedAt < m ? r.postedAt : m), new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())
        let list = await listOfficeTickets(since)
        const held = ticketsByCharge(list)
        const charges = mergeMatchCharges([next.queue.map(matchChargeFromStaffRow), next.history.map(matchChargeFromWindowRow)], held)
        const { matches, written } = await runTicketMatches(list, charges)
        if (written > 0) list = await listOfficeTickets(since)
        setTickets(list)
        setTicketMatches(matches)
        void loadTicketJobFacts(list.flatMap(ticketJobIds), prefixMap).then(setTicketJobs).catch(() => undefined)
      } catch {
        // the tickets are a layer on the queue; a read that fails leaves the queue as it was
      }
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Could not load the team’s card charges.'))
    } finally {
      setLoading(false)
    }
  }, [prefixMap])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  useEffect(() => {
    const row = deskForRef.current
    if (deskCapture.pages.length === 0 || !row || deskSending.current || !authUser?.id) return
    deskSending.current = true
    void (async () => {
      try {
        const out = await deskCapture.save({
          userId: authUser.id,
          byName: '',
          takenBy: row.target_user_id ?? authUser.id,
          takenByName: row.target_name ?? '',
          source: 'office',
          write: { job_id: null, also_job_ids: [], no_one_job: false, po_entry_id: null },
          total: null,
          note: '',
          about: row.counterparty_name ?? 'a charge',
        })
        await answerTicketYes(out.ticketId, row.mercury_transaction_id, 'picked')
        showToast(`The ticket is on ${formatTallyCurrency(Math.abs(Number(row.amount)))} at ${row.counterparty_name ?? 'the store'}.`, 'success')
        void load()
      } catch (e) {
        showToast(formatErrorMessage(e, 'The ticket did not save.'), 'error')
        deskCapture.discard()
      } finally {
        deskForRef.current = null
        deskSending.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskCapture.pages])

  // Copy the receipt link (punch list #299): the charge's own page, no sign-in, where its holder photographs the receipt.
  const copyReceiptLink = useCallback(
    async (row: StaleStaffRow) => {
      const about = `${formatTallyCurrency(Math.abs(Number(row.amount)))} at ${row.counterparty_name ?? 'the store'}`
      setReceiptLinkBusyId(row.mercury_transaction_id)
      try {
        const out = await copyReceiptLinkFor(row.mercury_transaction_id)
        if (out.copied) showToast(receiptCopiedWords(about, out.closesOn), 'success')
        else showToast(`This browser did not copy it. The receipt link for ${about} is ${out.url}`, 'warning')
      } catch (e) {
        showToast(formatErrorMessage(e, 'The receipt link was not made.'), 'error')
      } finally {
        setReceiptLinkBusyId(null)
      }
    },
    [showToast],
  )

  const ticketJobByCharge = useMemo(() => ticketJobByChargeOf(tickets), [tickets])
  const queue = useMemo(
    () => (reads ? buildTallyTeamQueue({ ...reads, officeJobId, nowMs: loadedAt, ticketJobByCharge }) : null),
    [reads, officeJobId, loadedAt, ticketJobByCharge],
  )
  const ticketByCharge = useMemo(() => {
    const out = new Map<string, { ticket: TicketWithPages; jobLabel: string | null }>()
    for (const [chargeId, t] of ticketsByCharge(tickets)) {
      const jobId = ticketJobIds(t)[0]
      out.set(chargeId, { ticket: t, jobLabel: jobId ? (ticketJobs.get(jobId)?.label ?? null) : null })
    }
    return out
  }, [tickets, ticketJobs])
  const asksByCharge = useMemo(() => {
    const out = new Map<string, TicketWithPages>()
    const byId = new Map(tickets.map((t) => [t.id, t]))
    for (const [ticketId, m] of ticketMatches) {
      const t = byId.get(ticketId)
      if (t && m.kind === 'ask' && !out.has(m.chargeId)) out.set(m.chargeId, t)
    }
    return out
  }, [tickets, ticketMatches])
  const splitsByCharge = useMemo(() => {
    const out = new Map<string, ChargeSplit[]>()
    for (const r of reads?.history ?? []) if (r.splits.length > 0) out.set(r.id, r.splits.map((sp) => ({ jobId: sp.jobId, amount: sp.amount })))
    return out
  }, [reads])
  const ticketRows = useMemo(() => officeTicketRows(tickets, { matches: ticketMatches, splitsByCharge }), [tickets, ticketMatches, splitsByCharge])
  const chargeWords = useCallback(
    (chargeId: string) => {
      const w = reads?.history.find((r) => r.id === chargeId)
      if (w) return `${formatTallyCurrency(Math.abs(w.amount))} at ${w.counterpartyName ?? 'a store'}, ${formatWorkDateYmdWeekdayShortFriendly(tallyDayKey(w.purchasedAt ?? w.postedAt) ?? '')}`
      const q = reads?.queue.find((r) => r.mercury_transaction_id === chargeId)
      return q ? `${formatTallyCurrency(Math.abs(Number(q.amount)))} at ${q.counterparty_name ?? 'a store'}` : 'that charge'
    },
    [reads],
  )
  const chargesFor = useCallback(
    (t: TicketWithPages) => {
      const taken = Date.parse(t.taken_at)
      const span = 4 * 24 * 60 * 60 * 1000
      const out: { id: string; words: string; at: number }[] = []
      for (const r of reads?.history ?? []) {
        if (r.holderUserId !== t.taken_by || ticketByCharge.has(r.id)) continue
        const at = Date.parse(r.purchasedAt ?? r.postedAt)
        if (Math.abs(at - taken) <= span) out.push({ id: r.id, words: chargeWords(r.id), at })
      }
      return out.sort((a, b) => Math.abs(a.at - taken) - Math.abs(b.at - taken)).map(({ id, words }) => ({ id, words }))
    },
    [reads, ticketByCharge, chargeWords],
  )
  const ticketAct = useCallback(
    async (t: TicketWithPages, act: () => Promise<void>, words: string) => {
      setTicketBusy(t.id)
      try {
        await act()
        void load()
      } catch (e) {
        showToast(formatErrorMessage(e, words), 'error')
      } finally {
        setTicketBusy(null)
      }
    },
    [load, showToast],
  )

  useEffect(() => {
    if (!queue) return
    const ids = new Set<string>()
    for (const day of queue.days) {
      for (const card of day.cards) {
        for (const chip of card.suggestion.chips) if (chip.choice.kind === 'job') ids.add(chip.choice.jobId)
        for (const job of card.suggestion.clockedJobs) ids.add(job.jobId)
        for (const id of card.suggestion.scheduledJobs) ids.add(id)
        for (const n of card.suggestion.neighbours) ids.add(n.jobId)
        for (const line of card.suggestion.lines) for (const o of line.own) if (o.choice.kind === 'job') ids.add(o.choice.jobId)
        for (const h of card.sorted) for (const s of h.splits) ids.add(s.jobId)
      }
    }
    const missing = [...ids].filter((id) => !askedLabels.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) askedLabels.current.add(id)
    void fetchTallyJobLabels(missing, prefixMap)
      .then((found) => setLabels((prev) => ({ ...prev, ...found })))
      .catch(() => {
        for (const id of missing) askedLabels.current.delete(id)
      })
  }, [queue, prefixMap])

  const label = useCallback(
    (jobId: string) => labels[jobId] ?? (jobId === officeJobId ? 'Office' : 'a job'),
    [labels, officeJobId],
  )

  const pickDay = useCallback((card: TallyQueueCard, chip: TallySuggestion) => {
    setSelections((prev) => pickDayChip(prev, card, chip))
  }, [])

  const pickLine = useCallback((chargeId: string, choice: TallyChoice | null) => {
    setSelections((prev) => pickLineChoice(prev, chargeId, choice))
  }, [])

  const toggleByHours = useCallback((chargeId: string) => {
    setSelections((prev) => toggleLineByHours(prev, chargeId))
  }, [])

  const undoLines = useCallback(
    async (lines: readonly TallyUndoLine[]) => {
      if (lines.length === 0) return
      setUndoBusyIds((prev) => new Set([...prev, ...lines.map((l) => l.chargeId)]))
      let done = 0
      let failed = 0
      for (const line of lines) {
        try {
          await withSupabaseRetry(
            async () => supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', tallyUndoRpcArgs(line)),
            'tally team queue undo a line',
          )
          done += 1
        } catch {
          failed += 1
        }
      }
      setUndoBusyIds((prev) => {
        const next = new Set(prev)
        for (const l of lines) next.delete(l.chargeId)
        return next
      })
      const toast = tallyUndoToast(done, failed)
      showToast(toast.message, toast.type)
      if (done > 0) {
        void load()
        void refetchStale()
      }
    },
    [showToast, load, refetchStale],
  )

  /**
   * Undo a press: delete the manual payroll marks it made, so the sends are undecided again and a
   * payroll rule may still mark them later (a `false` mark would leave a tombstone rules skip). The
   * flags table admits payroll-access roles for every write (`20260906130000`), the bar's own gate.
   */
  const unmarkPaySends = useCallback(
    async (chargeIds: readonly string[]) => {
      let done = 0
      let error: string | null = null
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_tally_payroll_flags')
              .delete()
              .in('mercury_transaction_id', [...chargeIds])
              .eq('source', 'manual')
              .eq('is_payroll', true)
              .select('mercury_transaction_id'),
          'tally team queue undo pay sends',
        )
        done = (rows ?? []).length
      } catch (e) {
        error = formatErrorMessage(e, 'Could not undo the marks')
      }
      const toast = tallyPayUnmarkToast(done, chargeIds.length - done, error)
      showToast(toast.message, toast.type)
      if (done > 0) {
        void load()
        void refetchStale()
      }
    },
    [showToast, load, refetchStale],
  )

  const markPaySends = useCallback(
    async (group: TallyPaySendGroup) => {
      if (payBusyRef.current.has(group.holderId)) return
      payBusyRef.current.add(group.holderId)
      setPayBusyHolders(new Set(payBusyRef.current))
      // Every send at once; `set_tally_payroll_flag` refuses one already on a job, and keeps the rest.
      const results = await Promise.allSettled(
        group.sends.map((send) =>
          withSupabaseRetry(
            async () => supabase.rpc('set_tally_payroll_flag', { p_mercury_transaction_id: send.chargeId, p_is_payroll: true }),
            'tally team queue mark pay sends',
          ).then(() => send.chargeId),
        ),
      )
      payBusyRef.current.delete(group.holderId)
      setPayBusyHolders(new Set(payBusyRef.current))
      const done = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      const firstRefusal = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      const toast = tallyPayMarkToast(
        done.length,
        results.length - done.length,
        firstRefusal ? formatErrorMessage(firstRefusal.reason, 'Could not mark it') : null,
      )
      if (done.length > 0) showActionToast(toast.message, { label: 'Undo', onClick: () => void unmarkPaySends(done) }, { type: toast.type })
      else showToast(toast.message, toast.type)
      if (done.length > 0) {
        void load()
        void refetchStale()
      }
    },
    [showActionToast, showToast, unmarkPaySends, load, refetchStale],
  )

  const sortDay = useCallback(
    async (card: TallyQueueCard) => {
      const key = `${card.holderId}|${card.ymd}`
      setBusyCard(key)
      const errors = new Map<string, string>()
      const done: string[] = []
      for (const { charge } of card.charges) {
        const sel = selections.get(charge.id)
        const line = card.suggestion.lines.find((l) => l.chargeId === charge.id)
        if (!sel || !line) continue
        const rows = rowsForSelection(line, sel)
        if (!rows) {
          errors.set(charge.id, 'This split cannot be made on this day. Pick a job instead.')
          continue
        }
        try {
          await withSupabaseRetry(
            async () =>
              supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', {
                p_for_user_id: card.holderId,
                p_mercury_transaction_id: charge.id,
                p_rows: rows.map((r) => ({ job_id: r.jobId, amount: r.amount })) as unknown as Json,
              }),
            'tally team queue sort the day',
          )
          done.push(charge.id)
        } catch (e) {
          errors.set(charge.id, formatErrorMessage(e, 'Could not save this charge.'))
        }
      }
      setSelections((prev) => {
        const next = new Map(prev)
        for (const id of done) next.delete(id)
        return next
      })
      setLineErrors((prev) => {
        const next = new Map(prev)
        for (const { charge } of card.charges) next.delete(charge.id)
        for (const [id, msg] of errors) next.set(id, msg)
        return next
      })
      setBusyCard(null)
      const undo = { label: 'Undo', onClick: () => void undoLines(done.map((chargeId) => ({ chargeId, holderId: card.holderId }))) }
      if (done.length > 0 && errors.size === 0) showActionToast(`Sorted ${chargesWords(done.length)}.`, undo)
      else if (done.length > 0)
        showActionToast(`Sorted ${done.length} of ${done.length + errors.size}. The rest need another look.`, undo, { type: 'error' })
      else if (errors.size > 0) showToast('Nothing was sorted. The charges need another look.', 'error')
      if (done.length > 0) {
        // The tickets on these charges were in front of the sorter: the office has used them.
        void markTicketsUsedByCharge(done.filter((id) => ticketByCharge.has(id))).catch(() => undefined)
        void load()
        void refetchStale()
      }
    },
    [selections, showToast, showActionToast, undoLines, load, refetchStale, ticketByCharge],
  )

  const backcharge = useCallback(
    async (row: StaleStaffRow) => {
      if (!authUser?.id) {
        showToast('Sign in required', 'error')
        return
      }
      setBackchargeBusyId(row.mercury_transaction_id)
      try {
        await assignChargeToOfficeAsStaff({
          forUserId: row.target_user_id,
          transactionId: row.mercury_transaction_id,
          amount: Number(row.amount),
        })
        showToast('Transaction assigned to Office job.', 'success')
        void load()
        void refetchStale()
        const names = await fetchOffsetPersonNameOptions({ authUserId: authUser.id, ensureNames: [row.target_name] })
        setOffsetNames(names)
        setOffsetDraft(
          backchargeDraftForCharge({
            personName: row.target_name,
            counterparty: row.counterparty_name,
            amount: Number(row.amount),
            postedAt: row.posted_at,
          }),
        )
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not complete backcharge'), 'error')
      } finally {
        setBackchargeBusyId(null)
      }
    },
    [authUser?.id, showToast, load, refetchStale],
  )

  const initialAllocations = useMemo(() => (allocRow ? parseTallyJobSplitsJson(allocRow.job_splits) : []), [allocRow])

  const days = useMemo(() => {
    if (!queue) return []
    if (!person) return queue.days
    return queue.days
      .map((d) => ({ ...d, cards: d.cards.filter((c) => c.holderId === person) }))
      .filter((d) => d.cards.length > 0)
  }, [queue, person])

  const payGroups = useMemo(
    () => (canMarkPayroll ? tallyPaySendGroups(days.flatMap((d) => d.cards)) : []),
    [canMarkPayroll, days],
  )

  return (
    <div data-testid="tally-team-queue" style={{ padding: '0.5rem 0 1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }} role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'to-sort'} style={segmentStyle(view === 'to-sort')} onClick={() => setView('to-sort')}>
          {queue ? `To sort (${queue.charges})` : 'To sort'}
        </button>
        <button type="button" aria-pressed={view === 'sorted'} style={segmentStyle(view === 'sorted')} onClick={() => setView('sorted')}>
          {sortedRows ? `Sorted (${sortedRows.length})` : 'Sorted'}
        </button>
        <button type="button" aria-pressed={view === 'tickets'} style={segmentStyle(view === 'tickets')} onClick={() => setView('tickets')} data-testid="tally-team-tickets-tab">
          {ticketsTabLabel(reads ? ticketRows.length : null)}
        </button>
      </div>

      {loadError ? (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          {loadError}{' '}
          <button type="button" onClick={() => void load()} style={{ ...segmentStyle(false), minHeight: 28, padding: '0.2rem 0.6rem' }}>
            Try again
          </button>
        </div>
      ) : null}

      {view === 'tickets' ? (
        <TeamTicketsList
          rows={ticketRows}
          jobs={ticketJobs}
          chargeWords={chargeWords}
          chargesFor={chargesFor}
          busyId={ticketBusy}
          onOpen={setOpenTicket}
          onAnswer={(t, chargeId, yes) => void ticketAct(t, () => (yes ? answerTicketYes(t.id, chargeId) : answerTicketNo(t, chargeId)), 'The answer did not save.')}
          onPickCharge={(t, chargeId) => void ticketAct(t, () => answerTicketYes(t.id, chargeId, 'picked'), 'The charge did not save.')}
          onPaidOther={(t, how: TicketPaidOther) => void ticketAct(t, () => setTicketPaidOther(t.id, how), 'That did not save.')}
          onChangeCharge={(t, toJobId) =>
            void ticketAct(
              t,
              async () => {
                const w = reads?.history.find((r) => r.id === t.mercury_transaction_id)
                const holder = w?.holderUserId
                if (!w || !holder) throw new Error('That charge is not in the window any more.')
                await withSupabaseRetry(
                  async () =>
                    supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', {
                      p_for_user_id: holder,
                      p_mercury_transaction_id: w.id,
                      p_rows: [{ job_id: toJobId, amount: w.amount }] as unknown as Json,
                    }),
                  'tally team queue change to the ticket job',
                )
                await markTicketUsed(t.id)
              },
              'The charge did not move.',
            )
          }
          onLeave={(t) => void ticketAct(t, () => markTicketUsed(t.id), 'That did not save.')}
          onPickJob={(t) => {
            setPickJobFor(t)
            if (pickJobs === null) void loadJobsForTicketPick().then(setPickJobs)
          }}
          onRecordBill={(t) => {
            const houseId = (t as TicketWithPages & { po?: { supply_house_id: string | null } | null }).po?.supply_house_id
            if (houseId) navigate(`/materials?tab=supply-houses&house=${encodeURIComponent(houseId)}&ticket=${encodeURIComponent(t.id)}`)
            else showToast('That PO code names no supply house. Record the bill from Materials → Supply houses.', 'warning')
          }}
        />
      ) : view === 'sorted' ? (
        <TeamPurchasesSortedList
          rows={sortedRows ?? []}
          isNarrow={isNarrow}
          windowDays={TALLY_TEAM_SORTED_WINDOW_DAYS}
          onChangeJobs={(row) => setAllocRow(staffListRowFromSorted(row))}
          onInvoices={(row) => setInvoiceRow(staffListRowFromSorted(row))}
          onUndo={(row) => {
            const line = tallyUndoLineFromSortedRow(row)
            if (line) void undoLines([line])
          }}
          undoBusyIds={undoBusyIds}
          onToSort={() => setView('to-sort')}
        />
      ) : loading && !queue ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the team’s card charges…</p>
      ) : queue && queue.charges === 0 ? (
        <p data-testid="tally-team-empty" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Nothing to sort. Every card charge has a job.
        </p>
      ) : queue ? (
        <>
          <p data-testid="tally-team-through" style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-slate-500)', lineHeight: 1.5 }}>
            {queue.throughYmd ? `Everything is sorted through ${formatWorkDateYmdWeekdayShortFriendly(queue.throughYmd)}. ` : ''}
            {`${chargesWords(queue.charges)} on ${queue.dayCount} ${queue.dayCount === 1 ? 'day' : 'days'} to go.`}
            {staleCount != null ? ` The Dashboard counts ${staleCount} over ${TALLY_STALE_MIN_AGE_DAYS} days old.` : ''}
          </p>

          <div role="group" aria-label="Whose charges" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <button type="button" aria-pressed={person == null} style={segmentStyle(person == null)} onClick={() => setPerson(null)}>
              Everyone
            </button>
            {queue.people.map((p) => (
              <button
                key={p.holderId}
                type="button"
                data-testid="tally-team-person"
                aria-pressed={person === p.holderId}
                style={segmentStyle(person === p.holderId)}
                onClick={() => setPerson((cur) => (cur === p.holderId ? null : p.holderId))}
              >
                {`${p.holderName} ${p.charges}`}
              </button>
            ))}
          </div>

          {payGroups.map((group) => (
            <TallyPayBar
              key={group.holderId}
              group={group}
              busy={payBusyHolders.has(group.holderId)}
              onMark={() => void markPaySends(group)}
            />
          ))}

          {days.map((day) => (
            <div key={day.ymd}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0.75rem 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {formatWorkDateYmdWeekdayShortFriendly(day.ymd)}
              </h3>
              {day.cards.map((card) => (
                <TallyTeamDayCard
                  key={`${card.holderId}|${card.ymd}`}
                  card={card}
                  label={label}
                  selections={selections}
                  lineErrors={lineErrors}
                  busy={busyCard === `${card.holderId}|${card.ymd}`}
                  backchargeBusyId={backchargeBusyId}
                  undoBusyIds={undoBusyIds}
                  onPickDay={(chip) => pickDay(card, chip)}
                  onPickLine={pickLine}
                  onToggleByHours={toggleByHours}
                  onSortDay={() => void sortDay(card)}
                  onAnotherJob={setAllocRow}
                  onInvoices={setInvoiceRow}
                  onBackcharge={(row) => void backcharge(row)}
                  onUndo={(line) => void undoLines([line])}
                  ticketByCharge={ticketByCharge}
                  asksByCharge={asksByCharge}
                  onAnswerAsk={(t, chargeId, yes) => void ticketAct(t, () => (yes ? answerTicketYes(t.id, chargeId) : answerTicketNo(t, chargeId)), 'The answer did not save.')}
                  onOpenTicket={setOpenTicket}
                  onAddTicket={(row) => {
                    deskForRef.current = row
                    deskCapture.openFiles()
                  }}
                  onCopyReceiptLink={(row) => void copyReceiptLink(row)}
                  receiptLinkBusyId={receiptLinkBusyId}
                />
              ))}
            </div>
          ))}
        </>
      ) : null}

      <MercuryTransactionAllocationsModal
        open={allocRow !== null}
        onClose={() => setAllocRow(null)}
        transaction={allocRow ? mercuryTxRowFromStaffListRow(allocRow) : null}
        initialAllocations={initialAllocations}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={EMPTY_JOB_LABEL_BY_ID}
        usersOptions={[]}
        tallySelfService
        tallyActAsUserId={allocRow?.target_user_id ?? null}
        tallyActAsDisplayName={allocRow?.target_name?.trim() ? allocRow.target_name.trim() : null}
        nicknameByDebitCard={nicknameByDebitCard}
        nicknameByAccount={nicknameByAccount}
        recentPersonPicksStorageKey={null}
        onSaved={() => {
          setAllocRow(null)
          void load()
          void refetchStale()
        }}
      />

      <MercuryTransactionInvoiceLinkModal
        open={invoiceRow !== null}
        onClose={() => setInvoiceRow(null)}
        transaction={invoiceRow ? mercuryTxRowFromStaffListRow(invoiceRow) : null}
        tallySelfService
        tallyActAsUserId={invoiceRow?.target_user_id ?? null}
        onSaved={() => {
          void load()
          void refetchStale()
        }}
      />

      <input {...deskCapture.filesInput} />
      {openTicket ? <TicketWindow ticket={openTicket} jobs={ticketJobs} userId={authUser?.id ?? ''} io={ticketScreensIo} onClose={() => setOpenTicket(null)} onChanged={() => void load()} /> : null}
      {pickJobFor ? (
        <TallyChooseJobSheet
          jobs={pickJobs ?? []}
          onlyIds={null}
          selectedJobId={pickJobFor.job_id}
          viewerUserId={authUser?.id ?? null}
          onPick={(id) => {
            const t = pickJobFor
            setPickJobFor(null)
            void ticketAct(t, () => ticketScreensIo.changeJob(t.id, { job_id: id, also_job_ids: [], no_one_job: false, po_entry_id: null }), 'The job did not save.')
          }}
          onClose={() => setPickJobFor(null)}
        />
      ) : null}
      <PersonOffsetFormModal
        open={offsetDraft !== null}
        onClose={() => {
          setOffsetDraft(null)
          setOffsetNames(null)
        }}
        zIndex={1150}
        editingOffset={null}
        initialCreateDraft={offsetDraft}
        personNameOptions={offsetNames ?? []}
        onSaved={() => {
          showToast('Offset saved', 'success')
          void load()
        }}
        onError={(msg) => showToast(msg, 'error')}
      />
    </div>
  )
}
