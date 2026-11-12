import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  BILLS_SENT_GAP_LABEL,
  BILLS_SENT_ROUTE_CHIPS,
  billsSentAgainWords,
  billsSentCopyLabel,
  billsSentDayExtras,
  billsSentDays,
  billsSentFilter,
  billsSentGapFilter,
  billsSentGapHeading,
  billsSentGaps,
  billsSentLines,
  billsSentMoney,
  billsSentSumWords,
  billsSentTiles,
  billsSentTime,
  type BillsSentGap,
  type BillsSentInput,
  type BillsSentLine,
  type BillsSentRoute,
  type BillsSentSum,
} from '../../lib/billing/billsSent'
import { readBillsSent } from '../../lib/billing/billsSentIo'
import { openSentCopy } from '../../lib/sent/sentCopiesIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'

/**
 * Bills sent (punch list #327, PR 1): every bill that left the company, newest first under a band per day, one line
 * each time a bill goes. A line says the minute, the bill, the job, the amount, the person and each address, how it
 * went and who pressed send, and opens the copy as it went out. A day's band carries the bills that first went that
 * day and their total. The list is read from the sent copies the app already keeps (`lib/billing/billsSent.ts`), so
 * it starts the day those began, and it says so.
 *
 * PR 2: a send that kept no copy is still a line and says what it lacks (an older email with no address, a bill
 * entered from Housecall Pro with the day only, a text with the pay link). Above the days sits the strip of bills
 * that were made and have no send on record, so a bill that never went is seen and not left off the list.
 */

/** Sends read per step; *Show older sends* reads the next step. */
const STEP = 300

const input: CSSProperties = { font: 'inherit', fontSize: '0.9375rem', width: '100%', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }
const tile: CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', minWidth: 0 }
const tileSmall: CSSProperties = { display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' }
const dayHead: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.1rem 0.6rem',
  margin: '0.75rem 0 0.25rem',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  borderLeft: '3px solid var(--text-blue-700)',
  color: 'var(--text-strong)',
  fontSize: '0.875rem',
  fontWeight: 800,
}
const small: CSSProperties = { color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }
const lineBox: CSSProperties = { display: 'grid', gap: '0.05rem 0.6rem', padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem', minWidth: 0, marginTop: '0.25rem' }
const strong: CSSProperties = { color: 'var(--text-strong)', fontWeight: 700 }
const money: CSSProperties = { ...strong, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
const press: CSSProperties = { font: 'inherit', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
const jobLink: CSSProperties = { color: 'var(--text-green-700)', fontWeight: 600, textDecoration: 'none' }

const ROUTE_COLORS: Readonly<Record<BillsSentRoute, { background: string; color: string }>> = {
  email: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  printed: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  statement: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  text: { background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' },
  housecall_pro: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  other: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}

function chipStyle(pressed: boolean): CSSProperties {
  return {
    font: 'inherit',
    padding: '0.2rem 0.7rem',
    fontSize: '0.8125rem',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: pressed ? 700 : 500,
    border: `1px solid ${pressed ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: pressed ? 'var(--text-strong)' : 'var(--surface)',
    color: pressed ? 'var(--surface)' : 'var(--text-700)',
  }
}

function Tile({ label, sum, testId }: { label: string; sum: BillsSentSum; testId: string }) {
  return (
    <div style={tile} data-testid={testId}>
      <span style={tileSmall}>{label}</span>
      <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
        {sum.bills} {sum.bills === 1 ? 'bill' : 'bills'}
      </b>{' '}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{billsSentMoney(sum.total)}</span>
    </div>
  )
}

function Line({ line, phone, onOpen }: { line: BillsSentLine; phone: boolean; onOpen: (line: BillsSentLine) => void }) {
  const colors = ROUTE_COLORS[line.route]
  const again = billsSentAgainWords(line)
  const time = line.dayOnly ? 'Day only' : billsSentTime(line.atIso)
  const span: CSSProperties = phone ? { gridColumn: '1 / -1', minWidth: 0 } : { gridColumn: '2 / -1', minWidth: 0 }
  const kept = !!line.copy?.copyPath
  // The payer is on the line above: the name is said again only when the copy went to someone else, or names no address.
  const toName = line.toAddresses.length > 0 && line.toName === line.payer ? '' : line.toName
  return (
    <div data-testid="bills-sent-line" style={{ ...lineBox, gridTemplateColumns: phone ? 'minmax(0, 1fr) auto' : '4.6rem minmax(0, 1fr) auto' }}>
      <div style={phone ? { ...strong, gridColumn: '1 / -1', fontVariantNumeric: 'tabular-nums' } : { ...strong, gridRow: '1 / span 3', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{time}</div>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <b style={strong}>{line.what}</b>
        {line.jobWords ? (
          <>
            {' · '}
            {line.jobTo ? (
              <Link to={line.jobTo} style={jobLink}>
                {line.jobWords}
              </Link>
            ) : (
              line.jobWords
            )}
          </>
        ) : null}
        {line.payer ? ` · ${line.payer}` : ''}
      </div>
      <div style={line.counts ? money : { ...money, color: 'var(--text-muted)' }}>{line.amount != null ? billsSentMoney(line.amount) : ''}</div>
      {line.toAddresses.length > 0 || line.toName ? (
        <div style={{ ...span, color: 'var(--text-700)', overflowWrap: 'anywhere' }} data-testid="bills-sent-to">
          To {toName}
          {toName && line.toAddresses.length > 0 ? ' · ' : ''}
          <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{line.toAddresses.join(', ')}</span>
          {line.copyTo.length > 0 ? (
            <>
              {' · copy to '}
              <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{line.copyTo.join(', ')}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {line.note ? <div style={{ ...span, color: 'var(--text-700)' }}>{line.note}</div> : null}
      <div style={{ ...span, display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, borderRadius: 999, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap', background: colors.background, color: colors.color }}>{line.routeWords}</span>
        {line.by ? <span>by {line.by}</span> : null}
        {again ? <span>{again}</span> : null}
        {line.delivery ? <span style={{ color: line.delivery === 'Delivered' ? 'var(--text-green-700)' : 'var(--text-red-700)', fontWeight: 600 }}>{line.delivery}</span> : null}
        {line.paid ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>Paid since</span> : null}
        {kept ? (
          <button type="button" style={press} onClick={() => onOpen(line)} title="Open the copy as it went out">
            {line.route === 'printed' ? 'Copy as printed' : 'Copy as sent'}
          </button>
        ) : line.copy ? (
          <span style={{ color: 'var(--text-amber-800)' }}>The copy was not kept. This line is the record.</span>
        ) : null}
      </div>
    </div>
  )
}

/** How many open gaps the strip shows before *Show all*. */
const GAPS_SHOWN = 5

const gapBox: CSSProperties = { border: '1px solid var(--border-amber, var(--border-strong))', background: 'var(--bg-amber-tint)', borderRadius: 10, padding: '0.55rem 0.7rem', fontSize: '0.8125rem', minWidth: 0 }
const gapRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', paddingTop: '0.4rem', marginTop: '0.4rem', borderTop: '1px dashed var(--border-strong)' }

function GapRow({ gap }: { gap: BillsSentGap }) {
  return (
    <div style={gapRow} data-testid="bills-sent-gap">
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <b style={strong}>Bill</b>
        {gap.jobWords ? (
          <>
            {' · '}
            {gap.jobTo ? (
              <Link to={gap.jobTo} style={jobLink}>
                {gap.jobWords}
              </Link>
            ) : (
              gap.jobWords
            )}
          </>
        ) : null}
        {gap.payer ? ` · ${gap.payer}` : ''}
      </div>
      <div style={money}>{gap.amount != null ? billsSentMoney(gap.amount) : ''}</div>
      <div style={{ gridColumn: '1 / -1', color: 'var(--text-700)' }}>
        {gap.billedWords} {gap.paid ? 'Paid since. The app sent nothing for this bill.' : 'Not paid. The app has no email, text or print for this bill.'}
      </div>
    </div>
  )
}

/**
 * The strip above the days: the open bills with no send on record, then the paid ones behind a press. A bill may
 * have been handed over on site or sent from someone's own mailbox, and the strip says the app cannot know.
 */
function GapStrip({ open, paid, expanded }: { open: BillsSentGap[]; paid: BillsSentGap[]; expanded: boolean }) {
  const [all, setAll] = useState(false)
  const [showPaid, setShowPaid] = useState(false)
  if (open.length === 0 && paid.length === 0) return null
  const shown = all || expanded ? open : open.slice(0, GAPS_SHOWN)
  return (
    <div style={gapBox} data-testid="bills-sent-gaps">
      <b style={{ color: 'var(--text-amber-800)' }}>{open.length > 0 ? billsSentGapHeading(open.length) : 'Every open bill has a send on record'}</b>
      {open.length > 0 ? <div style={{ color: 'var(--text-700)' }}>The app made these bills and sent nothing for them. One may have been handed over or sent from a mailbox the app cannot see.</div> : null}
      {shown.map((g) => (
        <GapRow key={g.billId} gap={g} />
      ))}
      {open.length > shown.length ? (
        <div style={{ marginTop: '0.4rem' }}>
          <button type="button" style={press} onClick={() => setAll(true)}>
            Show all {open.length}
          </button>
        </div>
      ) : null}
      {paid.length > 0 ? (
        <div style={{ marginTop: '0.4rem', color: 'var(--text-700)' }}>
          {paid.length === 1 ? '1 more bill was paid with no send on record.' : `${paid.length} more bills were paid with no send on record.`}{' '}
          <button type="button" style={press} onClick={() => setShowPaid((v) => !v)} aria-expanded={showPaid}>
            {showPaid ? 'Hide them' : 'Show them'}
          </button>
        </div>
      ) : null}
      {showPaid ? paid.map((g) => <GapRow key={g.billId} gap={g} />) : null}
    </div>
  )
}

export function BillsSentLedger() {
  const { showToast } = useToastContext()
  const phone = useIsMobile()
  const [route, setRoute] = useState<BillsSentRoute | 'all' | 'gap'>('all')
  const [typed, setTyped] = useState('')
  const [limit, setLimit] = useState(STEP)
  const [data, setData] = useState<BillsSentInput | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void readBillsSent({ limit })
      .then((read) => {
        if (cancelled) return
        setData(read)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, 'The bills sent did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit, tries])
  const retry = useCallback(() => setTries((n) => n + 1), [])

  const today = todayYmdInAppTz()
  const lines = useMemo(() => (data ? billsSentLines(data) : []), [data])
  const tiles = useMemo(() => billsSentTiles(lines, today), [lines, today])
  const shown = useMemo(() => billsSentFilter(lines, route, typed), [lines, route, typed])
  const days = useMemo(() => billsSentDays(shown, today), [shown, today])
  const gaps = useMemo(() => (data ? billsSentGaps(data, lines) : { open: [], paid: [] }), [data, lines])
  const gapsShown = useMemo(() => ({ open: billsSentGapFilter(gaps.open, typed), paid: billsSentGapFilter(gaps.paid, typed) }), [gaps, typed])
  // The strip rides with every bill (All) and is the whole list under its own chip; a route chip shows that route alone.
  const stripVisible = (route === 'all' || route === 'gap') && gapsShown.open.length + gapsShown.paid.length > 0
  const narrowed = route !== 'all' || typed.trim() !== ''
  const clear = () => {
    setTyped('')
    setRoute('all')
  }
  const open = useCallback(
    async (line: BillsSentLine) => {
      const ok = await openSentCopy(line.copy, billsSentCopyLabel(line))
      if (!ok) showToast('Could not open the copy. Allow pop-ups for this site and press it again.', 'error')
    },
    [showToast],
  )

  return (
    <section aria-label="Bills sent" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.4rem' }}>
        <Tile label="Today" sum={tiles.today} testId="bills-sent-tile-today" />
        <Tile label="This week" sum={tiles.week} testId="bills-sent-tile-week" />
        {gaps.open.length > 0 ? (
          <div style={{ ...tile, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber, var(--border-strong))' }} data-testid="bills-sent-tile-gaps">
            <span style={{ ...tileSmall, color: 'var(--text-amber-800)' }}>{BILLS_SENT_GAP_LABEL}</span>
            <b style={{ color: 'var(--text-amber-800)', fontSize: '0.9375rem' }}>{gaps.open.length}</b>
          </div>
        ) : null}
      </div>
      <input type="search" value={typed} onChange={(ev) => setTyped(ev.target.value)} placeholder="Find a bill: a job, a customer, an address, a bill number" aria-label="Find a bill" style={input} />
      <div role="group" aria-label="How it went" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {BILLS_SENT_ROUTE_CHIPS.map((c) => (
          <button key={c.key} type="button" aria-pressed={route === c.key} onClick={() => setRoute(c.key)} style={chipStyle(route === c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="bills-sent" idempotent busy={reading} /> : null}
      {stripVisible ? <GapStrip open={gapsShown.open} paid={gapsShown.paid} expanded={route === 'gap'} /> : null}
      {data == null && !failure ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : route === 'gap' && stripVisible ? null : data != null && shown.length === 0 ? (
        <div data-testid="bills-sent-empty">
          {narrowed ? (
            <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sends', query: typed.trim() }), { onPress: clear })} />
          ) : (
            <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'bills sent', page: { label: 'Open the Pipeline', tail: 'to send the first.' } }), { to: '/jobs?tab=stages' })} />
          )}
        </div>
      ) : (
        <div>
          {days.map((day) => {
            const extras = billsSentDayExtras(day)
            return (
              <div key={day.ymd || 'none'}>
                <h2 style={dayHead} data-testid="bills-sent-day">
                  <span>{day.label}</span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{billsSentSumWords(day.sum)}</span>
                  {extras ? <span style={small}>{extras}</span> : null}
                </h2>
                {day.lines.map((line) => (
                  <Line key={line.id} line={line} phone={phone} onOpen={(l) => void open(l)} />
                ))}
              </div>
            )
          })}
        </div>
      )}
      {data != null && [data.copies.length, data.stripeRows?.length ?? 0, data.stamps?.length ?? 0].some((n) => n >= limit) ? (
        <div>
          <button type="button" onClick={() => setLimit((n) => n + STEP)} disabled={reading} style={{ ...chipStyle(false), borderRadius: 6 }}>
            {reading ? 'Reading…' : 'Show older sends'}
          </button>
        </div>
      ) : null}
      {data != null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }} data-testid="bills-sent-foot">
          All times are Central. A day’s total counts each bill once, on the day it first went. A send before Oct 5, 2026 has its time and no address, because the app kept no copy then.
        </p>
      ) : null}
    </section>
  )
}

export default BillsSentLedger
