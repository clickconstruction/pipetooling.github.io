import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { Json } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
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

/**
 * Job Parts Tally → Transactions → Team (punch list #72, PR 2a): the office's queue of the team's
 * unsorted card charges, one card per person per day. Each card says the holder's day in words and
 * offers the day's chips with the likely one first; nothing is selected until the sorter taps.
 * *Sort the day* writes each selected charge through the staff split RPC, one call per charge.
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

export function TallyTeamQueue() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
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
  const [view, setView] = useState<'to-sort' | 'sorted'>('to-sort')
  const [person, setPerson] = useState<string | null>(null)
  const [selections, setSelections] = useState<Map<string, TallyLineSelection>>(() => new Map())
  const [lineErrors, setLineErrors] = useState<Map<string, string>>(() => new Map())
  const [busyCard, setBusyCard] = useState<string | null>(null)
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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the team’s card charges.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const queue = useMemo(
    () => (reads ? buildTallyTeamQueue({ ...reads, officeJobId, nowMs: loadedAt }) : null),
    [reads, officeJobId, loadedAt],
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
          errors.set(charge.id, e instanceof Error ? e.message : 'Could not save this charge.')
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
      if (done.length > 0 && errors.size === 0) showToast(`Sorted ${chargesWords(done.length)}.`, 'success')
      else if (done.length > 0) showToast(`Sorted ${done.length} of ${done.length + errors.size}. The rest need another look.`, 'error')
      else if (errors.size > 0) showToast('Nothing was sorted. The charges need another look.', 'error')
      if (done.length > 0) {
        void load()
        void refetchStale()
      }
    },
    [selections, showToast, load, refetchStale],
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
        showToast(e instanceof Error ? e.message : 'Could not complete backcharge', 'error')
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

  return (
    <div data-testid="tally-team-queue" style={{ padding: '0.5rem 0 1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }} role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'to-sort'} style={segmentStyle(view === 'to-sort')} onClick={() => setView('to-sort')}>
          {queue ? `To sort (${queue.charges})` : 'To sort'}
        </button>
        <button type="button" aria-pressed={view === 'sorted'} style={segmentStyle(view === 'sorted')} onClick={() => setView('sorted')}>
          {sortedRows ? `Sorted (${sortedRows.length})` : 'Sorted'}
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

      {view === 'sorted' ? (
        <TeamPurchasesSortedList
          rows={sortedRows ?? []}
          isNarrow={isNarrow}
          windowDays={TALLY_TEAM_SORTED_WINDOW_DAYS}
          onChangeJobs={(row) => setAllocRow(staffListRowFromSorted(row))}
          onInvoices={(row) => setInvoiceRow(staffListRowFromSorted(row))}
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
                  onPickDay={(chip) => pickDay(card, chip)}
                  onPickLine={pickLine}
                  onToggleByHours={toggleByHours}
                  onSortDay={() => void sortDay(card)}
                  onAnotherJob={setAllocRow}
                  onInvoices={setInvoiceRow}
                  onBackcharge={(row) => void backcharge(row)}
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
