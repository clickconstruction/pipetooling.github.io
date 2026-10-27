import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Money in: the bar under the Financials cards (punch list #191). Closed by
 * default — one line: Came in · Still expected · Last week still out, a red
 * RETURNED pill the only loud thing. Pressed, it opens to the week line: the
 * drawer shelf (checks typed in, not yet at the bank), last week's leftovers
 * as the amber first column, the days Monday to Friday and a quiet weekend
 * cell, every payment a chip on its day with its kind as a small tag. Every
 * chip is a door to the real window; a door the viewer cannot open (Banking,
 * for an assistant) is left off rather than drawn dead. The open/closed
 * choice is remembered per device. A word or pace chip is also the pen: its
 * press opens Write down their word (the Payment Chase's own sheet) with quick
 * days, and the save moves the chip. Drawn from to-dos/money-in-this-week/mockup.html.
 */
import { dayColumnLabel, dayWord, penAppliesTo, penContextLine, penQuickDays, type MoneyInDay, type MoneyInRow, type MoneyInWeekView } from '../lib/moneyInWeek'
import type { MoneyInSource } from '../lib/moneyInWeekLoad'
import { useMoneyInWeek } from '../hooks/useMoneyInWeek'
import type { FinancialItem } from '../lib/dashboardFinancials'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuth } from '../hooks/useAuth'
import { canAccessBanking } from '../lib/bankingAccess'
import { formatMoneyShortK } from '../lib/formatMoneyShortK'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../utils/dateUtils'
import SetPromisedPayDateModal from './jobs/SetPromisedPayDateModal'

export const MONEY_IN_OPEN_KEY = 'dashboard-money-in-open'

function readOpenPref(): boolean {
  try {
    return localStorage.getItem(MONEY_IN_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeOpenPref(open: boolean): void {
  try {
    localStorage.setItem(MONEY_IN_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* a private window still works; it just forgets */
  }
}

/** Whole dollars, the way the chips read: "$9,800". */
const dollars = (usd: number): string => `$${Math.round(usd).toLocaleString('en-US')}`

const DOOR_WORDS: Record<MoneyInRow['door'], string> = {
  deposits: 'Open deposits →',
  job: 'Open the job →',
  banking: 'Open Banking →',
  'return-case': 'Open the return case →',
}

const SOURCE_WORDS: Record<MoneyInSource, string> = {
  payments: 'what landed',
  drawer: 'the drawer',
  bank: 'the bank',
  returns: 'what came back',
  pile: 'the expected days',
  claims: 'their word',
  stripe: 'Stripe',
}

type ChipTone = { tagColor: string; bg: string; border: string; dashed?: boolean; amountWeight?: number; amountColor?: string }

function chipTone(kind: MoneyInRow['kind']): ChipTone {
  switch (kind) {
    case 'landed':
      return { tagColor: 'var(--text-green-800)', bg: 'var(--bg-green-tint)', border: 'var(--border-green)' }
    case 'returned':
      return { tagColor: 'var(--text-red-800)', bg: 'var(--bg-red-tint)', border: 'var(--border-red)' }
    case 'bank':
      return { tagColor: 'var(--text-link)', bg: 'var(--surface)', border: 'var(--border)' }
    case 'stripe-payout':
      return { tagColor: 'var(--text-link)', bg: 'var(--bg-blue-tint)', border: 'var(--border-blue)' }
    case 'sent-claim':
    case 'word':
      return { tagColor: 'var(--text-amber-800)', bg: 'var(--surface)', border: 'var(--border)' }
    case 'pace':
      return { tagColor: 'var(--text-faint)', bg: 'transparent', border: 'var(--border)', dashed: true, amountWeight: 600, amountColor: 'var(--text-700)' }
    case 'drawer':
      return { tagColor: 'var(--text-muted)', bg: 'var(--surface)', border: 'var(--border)' }
  }
}

function MoneyChip({
  row,
  todayYmd,
  canOpen,
  onDoor,
  onPen,
  movedWas,
}: {
  row: MoneyInRow
  todayYmd: string
  canOpen: (row: MoneyInRow) => boolean
  onDoor: (row: MoneyInRow) => void
  onPen?: (row: MoneyInRow) => void
  /** "was Thu, by pace" after the pen moved this chip. */
  movedWas?: string | null
}) {
  const tone = chipTone(row.kind)
  const open = canOpen(row)
  const pen = onPen && penAppliesTo(row) ? onPen : null
  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'left',
    marginTop: '0.375rem',
    padding: '0.3125rem 0.5rem 0.375rem',
    border: `1px ${tone.dashed ? 'dashed' : 'solid'} ${tone.border}`,
    borderRadius: 8,
    background: tone.bg,
    color: 'inherit',
    font: 'inherit',
    cursor: open ? 'pointer' : 'default',
  }
  const body = (
    <>
      <span style={{ display: 'block', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: tone.tagColor }}>
        {row.kind === 'landed' ? '✓ ' : ''}
        {row.tag}
      </span>
      <span style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, lineHeight: 1.25, marginTop: 1 }}>{row.payerName}</span>
      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: tone.amountWeight ?? 700, color: tone.amountColor, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
        {row.coversOpen ? 'covers ' : ''}
        {dollars(row.usd)}
      </span>
      {row.sub ? <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)', lineHeight: 1.35 }}>{row.sub}</span> : null}
      {movedWas || (row.wasYmd && row.dayYmd) ? (
        <span style={{ display: 'inline-block', marginTop: 3, fontSize: '0.65625rem', color: 'var(--text-faint)', border: '1px dashed var(--border)', borderRadius: 999, padding: '0 0.45rem', whiteSpace: 'nowrap' }}>
          {movedWas ?? `was ${dayWord(row.wasYmd!, todayYmd)}`}
        </span>
      ) : null}
      {open && row.kind !== 'landed' && !pen ? <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-link)', fontWeight: 600, marginTop: 2 }}>{DOOR_WORDS[row.door]}</span> : null}
    </>
  )
  if (pen) {
    const link: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }
    return (
      <div style={{ ...style, cursor: 'default' }} data-money-in-pen-chip>
        <button
          type="button"
          onClick={() => pen(row)}
          aria-label={`New date for ${row.payerName}, ${dollars(row.usd)}`}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
        >
          {body}
        </button>
        <span style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginTop: 2 }}>
          <button type="button" onClick={() => pen(row)} style={link}>
            New date ›
          </button>
          {open ? (
            <button type="button" onClick={() => onDoor(row)} style={link}>
              {DOOR_WORDS[row.door]}
            </button>
          ) : null}
        </span>
      </div>
    )
  }
  return open ? (
    <button type="button" onClick={() => onDoor(row)} aria-label={`${row.payerName}, ${dollars(row.usd)}: ${DOOR_WORDS[row.door].replace(' →', '')}`} style={style}>
      {body}
    </button>
  ) : (
    <div style={style}>{body}</div>
  )
}

/** The open line's columns: Monday to Friday, then Saturday and Sunday as one quiet cell. */
function weekCells(days: MoneyInDay[]): Array<{ key: string; label: string; landedUsd: number; expectedUsd: number; rows: MoneyInRow[]; isToday: boolean; quiet: boolean }> {
  const weekdays = days.slice(0, 5).map((d) => ({ key: d.ymd, label: dayColumnLabel(d.ymd), landedUsd: d.landedUsd, expectedUsd: d.expectedUsd, rows: d.rows, isToday: d.isToday, quiet: false }))
  const weekend = days.slice(5)
  return [
    ...weekdays,
    {
      key: 'weekend',
      label: 'Sat · Sun',
      landedUsd: weekend.reduce((s, d) => s + d.landedUsd, 0),
      expectedUsd: weekend.reduce((s, d) => s + d.expectedUsd, 0),
      rows: weekend.flatMap((d) => d.rows),
      isToday: weekend.some((d) => d.isToday),
      quiet: true,
    },
  ]
}

/** "week of Mon Oct 26". */
function weekOfWords(mondayYmd: string): string {
  const d = new Date(`${mondayYmd}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return `week of ${d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '')}`
}

/** "Monday 9:40 AM". */
function readAtWords(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ }).replace(',', '')
}

export function MoneyInStripView({
  view,
  failed,
  loading,
  readAtIso,
  canOpenBanking,
  onDoor,
  onOpenDeposits,
  onPen,
  moved,
}: {
  view: MoneyInWeekView | null
  failed: MoneyInSource[]
  loading: boolean
  readAtIso: string | null
  canOpenBanking: boolean
  onDoor: (row: MoneyInRow) => void
  onOpenDeposits: () => void
  /** The pen: a word or pace chip's press, to write down a new day. */
  onPen?: (row: MoneyInRow) => void
  /** Job id → "was Thu, by pace" for chips the pen moved this visit. */
  moved?: ReadonlyMap<string, string>
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(readOpenPref)
  const toggle = () => {
    const next = !open
    writeOpenPref(next)
    setOpen(next)
  }
  const canOpen = (row: MoneyInRow): boolean => row.door !== 'banking' || canOpenBanking

  const frame: CSSProperties = {
    marginTop: '0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxSizing: 'border-box',
    width: '100%',
    color: 'inherit',
  }
  const quiet: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }

  if (!view) {
    return (
      <div role="status" style={{ ...frame, padding: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
        <span style={quiet}>Money in</span> · {loading ? 'reading the week…' : "couldn't read the week. Reload to try again."}
      </div>
    )
  }

  const seg: CSSProperties = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', color: 'var(--text-700)' }
  const strong: CSSProperties = { fontWeight: 700, color: 'var(--text-base)' }

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        style={{ ...frame, textAlign: 'left', font: 'inherit', padding: '0.5rem 1rem', display: 'flex', gap: '0.875rem', alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }}
      >
        <span style={quiet}>Money in</span>
        <span style={seg}>
          <span style={{ color: 'var(--text-green-800)', fontWeight: 700 }}>✓</span> Came in <span style={strong}>{formatMoneyShortK(view.cameIn.usd)}</span> · {view.cameIn.count}
        </span>
        <span style={seg}>
          Still expected <span style={strong}>{formatMoneyShortK(view.expected.usd)}</span> · {view.expected.count}
        </span>
        <span style={{ ...seg, border: '1px solid var(--border-amber-soft)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.125rem 0.75rem' }}>
          Last week still out <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>{formatMoneyShortK(view.carried.stillOutUsd)}</span> · {view.carried.count}
          {view.returnedCount > 0 ? (
            <span style={{ marginLeft: '0.4rem', padding: '0 0.375rem', borderRadius: 999, fontSize: '0.65625rem', fontWeight: 700, letterSpacing: '0.04em', background: 'var(--bg-red-100)', color: 'var(--text-red-800)' }}>
              {view.returnedCount} RETURNED
            </span>
          ) : null}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>Open ▾</span>
      </button>
    )
  }

  const cells = weekCells(view.days)
  const shelfMax = isMobile ? 2 : 4
  const colBase: CSSProperties = isMobile
    ? { borderBottom: '1px solid var(--border)', padding: '0.5rem 0.75rem 0.75rem', minWidth: 0 }
    : { borderRight: '1px solid var(--border)', padding: '0.5rem 0.5rem 0.75rem', minWidth: 0 }
  const shownCells = isMobile ? cells.filter((c) => c.rows.length > 0 || c.isToday) : cells
  const colHead: CSSProperties = { display: 'flex', gap: '0.375rem', alignItems: 'baseline', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
  const colSum: CSSProperties = { marginLeft: 'auto', fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  const emptyLine: CSSProperties = { marginTop: '0.625rem', fontSize: '0.71875rem', color: 'var(--text-faint)' }
  const weekOf = weekOfWords(view.weekMondayYmd)

  return (
    <section aria-label="Money in this week" style={{ ...frame, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.625rem 1rem 0.5rem' }}>
        <span style={quiet}>Money in</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>· {weekOf}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{isMobile ? '' : readAtWords(readAtIso)}</span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Close ▴
        </button>
      </div>

      {view.drawer.count > 0 || view.drawer.olderUnbankedCount > 0 ? (
        <div style={{ margin: '0 0.625rem 0.625rem', border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.4375rem 0.75rem', display: 'flex', gap: '0.625rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78125rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>In the drawer</span>
          {view.drawer.count > 0 ? (
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-base)', fontVariantNumeric: 'tabular-nums' }}>{dollars(view.drawer.usd)}</span> · {view.drawer.count} check{view.drawer.count === 1 ? '' : 's'} recorded, not yet deposited
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>No new checks waiting.</span>
          )}
          {view.drawer.rows.slice(0, shelfMax).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onDoor(r)}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 999, padding: '0.125rem 0.625rem', font: 'inherit', fontSize: '0.75rem', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {r.payerName}
              {r.reference ? ` · #${r.reference}` : ''} · <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{dollars(r.usd)}</span>
              {r.eventYmd ? ` · ${dayWord(r.eventYmd, view.todayYmd)}` : ''}
            </button>
          ))}
          {view.drawer.count > shelfMax ? <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>+{view.drawer.count - shelfMax} more</span> : null}
          <button
            type="button"
            onClick={onOpenDeposits}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Open deposits →
          </button>
          <span style={{ flexBasis: '100%', color: 'var(--text-faint)', fontSize: '0.71875rem' }}>
            {view.drawer.count > 0 ? "No day on the line until they're deposited." : ''}
            {view.drawer.olderUnbankedCount > 0
              ? `${view.drawer.count > 0 ? ' ' : ''}${view.drawer.olderUnbankedCount} older check${view.drawer.olderUnbankedCount === 1 ? '' : 's'} never reached the bank. They wait in deposits.`
              : ''}
          </span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(160px, 195px) repeat(5, minmax(0, 1fr)) minmax(0, 0.75fr)', borderTop: '1px solid var(--border)' }}>
        <div style={{ ...colBase, background: 'var(--bg-amber-tint)', ...(isMobile ? {} : { borderRight: '1px solid var(--border-amber-soft)' }) }}>
          <div style={{ ...colHead, color: 'var(--text-amber-800)' }}>
            Last week
            <span style={{ ...colSum, color: 'var(--text-amber-800)' }}>{view.carried.count > 0 ? `${formatMoneyShortK(view.carried.stillOutUsd)} still out` : '—'}</span>
          </div>
          {view.carried.rows.length === 0 ? <div style={{ ...emptyLine, color: 'var(--text-amber-800)' }}>Everything expected last week landed.</div> : null}
          {view.carried.rows.map((r) => (
            <MoneyChip key={r.key} row={r} todayYmd={view.todayYmd} canOpen={canOpen} onDoor={onDoor} onPen={onPen} movedWas={r.jobId ? moved?.get(r.jobId) : null} />
          ))}
        </div>
        {shownCells.map((c) => (
          <div
            key={c.key}
            style={{
              ...colBase,
              background: c.isToday ? 'var(--bg-subtle)' : c.quiet ? 'var(--bg-muted)' : undefined,
              boxShadow: c.isToday ? 'inset 0 2px 0 var(--text-link)' : undefined,
            }}
          >
            <div style={{ ...colHead, color: c.isToday ? 'var(--text-link)' : colHead.color }}>
              {c.label}
              {c.isToday ? ' · today' : ''}
              <span style={colSum}>
                {c.landedUsd > 0 ? <span style={{ color: 'var(--text-green-800)' }}>✓ {formatMoneyShortK(c.landedUsd)}</span> : null}
                {c.landedUsd > 0 && c.expectedUsd > 0 ? ' + ' : ''}
                {c.expectedUsd > 0 ? formatMoneyShortK(c.expectedUsd) : null}
                {c.landedUsd === 0 && c.expectedUsd === 0 ? '—' : null}
              </span>
            </div>
            {c.rows.map((r) => (
              <MoneyChip key={r.key} row={r} todayYmd={view.todayYmd} canOpen={canOpen} onDoor={onDoor} onPen={onPen} movedWas={r.jobId ? moved?.get(r.jobId) : null} />
            ))}
            {c.rows.length === 0 ? <div style={emptyLine}>{c.quiet ? 'Quiet. Banks are closed.' : 'Nothing yet.'}</div> : null}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '0.375rem 1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.71875rem', color: 'var(--text-faint)' }}>
        <span>
          <span style={{ color: 'var(--text-green-800)', fontWeight: 700 }}>✓ green</span> landed
        </span>
        <span>
          <span style={{ color: 'var(--text-red-800)', fontWeight: 700 }}>red</span> came back
        </span>
        <span>
          <span style={{ color: 'var(--text-amber-800)', fontWeight: 700 }}>amber</span> their word
        </span>
        <span>dashed = a guess by pace</span>
        {failed.length > 0 ? (
          <span style={{ color: 'var(--text-amber-800)' }}>Couldn't read {failed.map((s) => SOURCE_WORDS[s]).join(', ')}. The rest is live.</span>
        ) : (
          <span>Each source reads on its own. One being down never blanks the rest.</span>
        )}
      </div>
    </section>
  )
}

/** The data-bound bar the Financials section mounts under its cards. */
export default function DashboardMoneyInStrip({ ar, collections }: { ar: ReadonlyArray<FinancialItem>; collections: ReadonlyArray<FinancialItem> }) {
  const arItems = useMemo(() => [...ar], [ar])
  const collectionsItems = useMemo(() => [...collections], [collections])
  const { view, failed, loading, readAtIso, refresh } = useMoneyInWeek(true, arItems, collectionsItems)
  const { role } = useAuth()
  const navigate = useNavigate()
  const jobDetailModal = useJobDetailModal()
  const [penRow, setPenRow] = useState<MoneyInRow | null>(null)
  const [moved, setMoved] = useState<ReadonlyMap<string, string>>(() => new Map())
  const onDoor = (row: MoneyInRow) => {
    if (row.door === 'job' && row.jobId && jobDetailModal) {
      jobDetailModal.openJobDetail({ jobId: row.jobId, prefillRowLabel: row.payerName })
      return
    }
    if (row.door === 'banking') {
      navigate('/banking')
      return
    }
    navigate('/accounts-receivable')
  }
  const todayYmd = view?.todayYmd ?? todayYmdInAppTz()
  return (
    <>
      <MoneyInStripView
        view={view}
        failed={failed}
        loading={loading}
        readAtIso={readAtIso}
        canOpenBanking={canAccessBanking(role)}
        onDoor={onDoor}
        onOpenDeposits={() => navigate('/accounts-receivable')}
        onPen={setPenRow}
        moved={moved}
      />
      {penRow?.jobId ? (
        <SetPromisedPayDateModal
          jobId={penRow.jobId}
          jobLabel={`${penRow.payerName} · ${dollars(penRow.usd)} open`}
          initialYmd={penRow.kind === 'word' ? penRow.eventYmd : null}
          quickDays={penQuickDays(todayYmd)}
          contextLine={penContextLine(penRow)}
          onClose={() => setPenRow(null)}
          onSaved={() => {
            const was = penRow.kind === 'word' ? penRow.eventYmd : (penRow.wasYmd ?? penRow.dayYmd)
            if (penRow.jobId && was) {
              const jobId = penRow.jobId
              const words = `was ${dayWord(was, todayYmd)}${penRow.kind === 'pace' ? ', by pace' : ''}`
              setMoved((m) => new Map(m).set(jobId, words))
            }
            refresh()
          }}
        />
      ) : null}
    </>
  )
}
