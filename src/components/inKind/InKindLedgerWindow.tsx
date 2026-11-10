/**
 * The ledger for one partner (punch list #301): the deal in a sentence, what its jobs came to, what has been paid in
 * kind and what is left, each thing given as a line with what it counts as and the bills it went to, and the bills
 * oldest first. The same window from every door.
 */
import { useMemo, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import ConfirmDialog from '../ConfirmDialog'
import { EmptyState } from '../EmptyState'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { inKindTotals, liveLines, lineStanding, monthYearShort, type InKindLine, type InKindMonth } from '../../lib/inKind/inKindLedger'
import { removeInKindLine, setInKindLineCost, type InKindLedgerData, type InKindLedgerJob } from '../../lib/inKind/inKindIo'
import {
  IN_KIND_ADD_LINE,
  IN_KIND_CHANGE_TERMS,
  IN_KIND_OVERHEAD,
  aheadWords,
  byHandWords,
  dayWords,
  jobLabel,
  jobLine,
  jobsWord,
  kindWords,
  leftWords,
  lineWentWords,
  linesWord,
  monthEarlyPress,
  monthOpenPress,
  monthStateWords,
  takeBackWords,
  termsSentence,
  unbilledWords,
  usd,
} from '../../lib/inKind/inKindWords'
import { amberStrip, bluePress, linePress, meterParts, noteStrip, pill, quietPress, statBox, statKey, statSub, statValue } from './inKindStyles'

export interface InKindLedgerIo {
  removeLine: (lineId: string) => Promise<void>
  setLineCost: (lineId: string, costJobId: string | null) => Promise<void>
}
const REAL_IO: InKindLedgerIo = { removeLine: removeInKindLine, setLineCost: setInKindLineCost }

const jobOpen = (j: InKindLedgerJob): number => Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))
const billDay = (j: InKindLedgerJob): string => j.invoices.map((i) => i.billed_at ?? '').filter(Boolean).sort()[0] ?? j.created_at ?? ''

export default function InKindLedgerWindow({
  data,
  onClose,
  onChanged,
  onAddLine,
  onChangeTerms,
  months = [],
  onEnterMonth,
  io = REAL_IO,
}: {
  data: InKindLedgerData
  onClose: () => void
  /** A write landed; the owner reads the deal again and hands the new data back in. */
  onChanged: () => void
  onAddLine: () => void
  onChangeTerms: () => void
  /** A monthly deal's months, newest first; empty for a deal with no schedule. */
  months?: InKindMonth[]
  /** Opens the window that enters a month with no line. */
  onEnterMonth?: (month: string) => void
  io?: InKindLedgerIo
}) {
  const toast = useToastContext()
  const { arrangement, jobs, lines, payments, costJobs } = data
  const [takeBack, setTakeBack] = useState<InKindLine | null>(null)
  const [busy, setBusy] = useState(false)
  const [showByHand, setShowByHand] = useState(false)
  const [showGone, setShowGone] = useState(false)

  const totals = useMemo(() => inKindTotals(jobs, lines, payments), [jobs, lines, payments])
  const live = useMemo(() => liveLines(lines), [lines])
  const gone = useMemo(() => lines.filter((l) => l.removed_at), [lines])
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => billDay(a).localeCompare(billDay(b))), [jobs])
  const nextJobId = useMemo(() => sortedJobs.find((j) => j.status === 'billed' && jobOpen(j) > 0.005)?.id ?? null, [sortedJobs])
  const byHand = useMemo(() => payments.filter((p) => !p.line_id), [payments])
  const ended = Boolean(arrangement.ended_at)
  const { paidPct } = meterParts(totals.paidInKind, totals.work)
  const ahead = aheadWords(totals.ahead)
  const handWords = byHandWords(totals)

  const doTakeBack = async () => {
    if (!takeBack) return
    setBusy(true)
    try {
      await io.removeLine(takeBack.id)
      toast.showToast(`The line for ${usd(takeBack.amount)} is taken back.`, 'success')
      setTakeBack(null)
      onChanged()
    } catch (e) {
      toast.showToast(formatErrorMessage(e, 'The line was not taken back.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const toOverhead = async (line: InKindLine) => {
    setBusy(true)
    try {
      await io.setLineCost(line.id, null)
      toast.showToast('The line now counts as overhead.', 'success')
      onChanged()
    } catch (e) {
      toast.showToast(formatErrorMessage(e, 'The line was not changed.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const lineRow = (l: InKindLine, struck: boolean) => {
    const went = payments.filter((p) => p.line_id === l.id)
    const standing = lineStanding(l, payments)
    const costJob = l.cost_job_id ? costJobs.get(l.cost_job_id) : null
    return (
      <div key={l.id} data-testid="in-kind-line" style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid var(--border)', opacity: struck ? 0.6 : 1 }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)', textDecoration: struck ? 'line-through' : 'none' }}>
            <b>{dayWords(l.given_on)}</b> <span style={pill(l.cost_job_id ? 'blue' : 'grey')}>{l.cost_job_id ? (costJob ? jobLine(costJob) : 'A job') : IN_KIND_OVERHEAD}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)', marginTop: 2 }}>{l.memo}</div>
          {!struck ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {lineWentWords(l.amount, went.map((p) => ({ label: jobLabel(jobById.get(p.job_id) ?? {}), amount: p.amount })), standing.onNoBill)}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Taken back.</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <b style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)', textDecoration: struck ? 'line-through' : 'none' }}>{usd(l.amount)}</b>
          {!struck && !ended ? (
            <div style={{ display: 'flex', gap: 2 }}>
              {l.cost_job_id ? (
                <button type="button" disabled={busy} onClick={() => void toOverhead(l)} style={quietPress}>
                  Count as overhead
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => setTakeBack(l)} style={{ ...quietPress, color: 'var(--text-red-700)' }}>
                Take back
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const confirmWords = takeBack ? takeBackWords(takeBack.amount, payments.filter((p) => p.line_id === takeBack.id).length) : null

  return (
    <ResponsiveModalShell
      title={`${arrangement.partner_name || 'In kind'} · ${arrangement.what_given}`}
      onRequestClose={onClose}
      maxWidthDesktop={880}
      fullScreenKey="in-kind-ledger"
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={quietPress}>
            Close
          </button>
          {!ended ? (
            <>
              <button type="button" onClick={onChangeTerms} style={linePress}>
                {IN_KIND_CHANGE_TERMS}
              </button>
              <button type="button" onClick={onAddLine} style={bluePress()} data-testid="in-kind-ledger-add-line">
                {IN_KIND_ADD_LINE}
              </button>
            </>
          ) : null}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>In kind · {kindWords(arrangement)}</div>
        <div style={noteStrip}>
          {termsSentence(arrangement)}
          {arrangement.note.trim() ? <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>{arrangement.note.trim()}</div> : null}
        </div>
        <div role="img" aria-label={`${usd(totals.paidInKind)} of ${usd(totals.work)} paid in kind`} style={{ height: 10, borderRadius: 9999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <div style={{ width: `${paidPct}%`, height: '100%', background: '#16a34a' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={statBox}>
            <span style={statKey}>Our work</span>
            <span style={statValue}>{usd(totals.work)}</span>
            <span style={statSub}>{jobsWord(totals.jobCount)}</span>
          </div>
          <div style={statBox}>
            <span style={statKey}>Paid in kind so far</span>
            <span style={statValue}>{usd(totals.paidInKind)}</span>
            <span style={statSub}>{linesWord(live.length)}</span>
          </div>
          <div style={statBox}>
            <span style={statKey}>Still to come</span>
            <span style={statValue}>{usd(totals.left)}</span>
            <span style={statSub}>{leftWords(totals)}</span>
          </div>
        </div>
        {unbilledWords(totals) ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{unbilledWords(totals)}</div> : null}
        {ahead ? <div style={amberStrip}>{ahead}</div> : null}

        {months.length > 0 ? (
          <div data-testid="in-kind-months">
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>Month by month</div>
            {months.map((m) => (
              <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '7px 8px', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', background: m.state === 'due' ? 'var(--bg-amber-tint)' : 'transparent' }}>
                <span style={{ color: 'var(--text-strong)' }}>
                  <b>{monthYearShort(m.month)}</b>
                  {m.bankPaid != null ? <span style={{ color: 'var(--text-muted)' }}> · {usd(m.bankPaid)} left the bank</span> : null}
                </span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: m.state === 'due' ? 'var(--text-amber-800)' : 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {monthStateWords(m.state, m.line?.amount ?? 0)}
                  {m.state === 'due' && onEnterMonth && !ended ? (
                    <button type="button" onClick={() => onEnterMonth(m.month)} style={bluePress()}>
                      {monthOpenPress(m.month)}
                    </button>
                  ) : null}
                  {m.state === 'waiting' && onEnterMonth && !ended ? (
                    <button type="button" onClick={() => onEnterMonth(m.month)} style={quietPress} data-testid="in-kind-month-early-press">
                      {monthEarlyPress}
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>What was given</div>
          {live.length === 0 ? (
            ended ? (
              <EmptyState compact main="Nothing was given on this arrangement." />
            ) : (
              <EmptyState compact main="Nothing given yet." next={{ label: IN_KIND_ADD_LINE, onPress: onAddLine }} tail="when something is." />
            )
          ) : (
            live.map((l) => lineRow(l, false))
          )}
          {live.length > 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
              {usd(totals.asOverhead)} counts as overhead. {usd(totals.onJobs)} counts on a job.
            </div>
          ) : null}
          {gone.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              <button type="button" onClick={() => setShowGone((v) => !v)} style={quietPress} aria-expanded={showGone}>
                {showGone ? 'Hide' : 'Show'} {linesWord(gone.length)} taken back
              </button>
              {showGone ? gone.map((l) => lineRow(l, true)) : null}
            </div>
          ) : null}
        </div>

        {handWords ? (
          <div>
            <div style={noteStrip}>
              {handWords}{' '}
              <button type="button" onClick={() => setShowByHand((v) => !v)} style={quietPress} aria-expanded={showByHand}>
                {showByHand ? 'Hide them' : 'Show them'}
              </button>
            </div>
            {showByHand
              ? byHand.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                    <span style={{ minWidth: 0 }}>
                      <b>{dayWords(p.paid_on)}</b> {jobLabel(jobById.get(p.job_id) ?? {})}
                      {p.note ? <span style={{ color: 'var(--text-muted)' }}> · {p.note}</span> : null}
                    </span>
                    <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{usd(p.amount)}</b>
                  </div>
                ))
              : null}
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>The bills it pays, oldest first</div>
          {sortedJobs.length === 0 ? (
            ended ? (
              <EmptyState compact main="An ended arrangement pays no job." />
            ) : (
              <EmptyState compact main="No job is on this arrangement." next={{ label: IN_KIND_CHANGE_TERMS, onPress: onChangeTerms }} tail="to pick its jobs." />
            )
          ) : (
            sortedJobs.map((j) => {
              const open = jobOpen(j)
              const paid = j.status === 'paid' || (j.status === 'billed' && open <= 0.005)
              const billed = j.status === 'billed'
              return (
                <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                  <span style={{ minWidth: 0, color: 'var(--text-strong)', fontWeight: j.id === nextJobId ? 700 : 400 }}>
                    {jobLine(j)}
                    {j.id === nextJobId ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · next in line</span> : null}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {paid ? (
                      <>
                        {usd(Number(j.revenue ?? 0))} <span style={pill('green')}>Paid</span>
                      </>
                    ) : billed ? (
                      <>
                        <b>{usd(open)} left</b> <span style={pill(j.id === nextJobId ? 'amber' : 'grey')}>of {usd(Number(j.revenue ?? 0))}</span>
                      </>
                    ) : (
                      <>
                        {usd(Number(j.revenue ?? 0))} <span style={pill('grey')}>not billed yet</span>
                      </>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
      {takeBack && confirmWords ? (
        <ConfirmDialog title={confirmWords.title} body={confirmWords.body} confirmLabel={busy ? 'Taking it back…' : confirmWords.confirmLabel} cancelLabel="Keep it" onConfirm={() => void doTakeBack()} onCancel={() => setTakeBack(null)} />
      ) : null}
    </ResponsiveModalShell>
  )
}
