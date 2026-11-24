import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  billsPaidCellCount,
  billsPaidCellCredit,
  billsPaidCellLabel,
  billsPaidCellMoney,
  billsPaidChips,
  billsPaidCsv,
  billsPaidCsvFileName,
  billsPaidDayGroups,
  billsPaidDayHeading,
  billsPaidEmptyDay,
  billsPaidFilter,
  billsPaidGroupWords,
  billsPaidLines,
  billsPaidMonthCells,
  billsPaidMonthHtml,
  billsPaidMonthLabel,
  billsPaidMonthName,
  billsPaidMonthOf,
  billsPaidOpeningDay,
  billsPaidPayoutWords,
  billsPaidRange,
  billsPaidShiftMonth,
  billsPaidStepLabel,
  billsPaidSum,
  billsPaidTiles,
  billsPaidTime,
  billsPaidTookWords,
  isBillsPaidChip,
  plural,
  type BillsPaidCell,
  type BillsPaidChip,
  type BillsPaidHow,
  type BillsPaidLine,
  type BillsPaidPayoutAnswer,
  type BillsPaidSum,
} from '../../lib/billing/billsPaidDays'
import { readBillsPaid, readStripePayout, type BillsPaidRead } from '../../lib/billing/billsPaidIo'
import { billsSentRecordPath } from '../../lib/billing/billsSent'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { saveBlobAs } from '../../lib/storageSave'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatWorkDateYmdWeekdayShortFriendly, todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { AmountSmallCents } from '../AmountSmallCents'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { THUMB, billLink, chipStyle, jobLink, linePress, money, phoneButton, strong, tile, tileRow, tileSmall } from './billsSentLook'
import { MoneyText } from '../Money'

/**
 * Bills sent, the second view: By day paid (punch list #422, PR 3). The first view lists bills in the order they
 * went. This one answers one question, *what came in on a given day?*: a month of days, each with what came in,
 * and behind a picked day its total and its payments. A chip narrows the month to one way of paying, Stripe first,
 * which is what the owner asked for.
 *
 * Nothing here is a new record. A payment is a row of `jobs_ledger_payments` on the day it names
 * (`lib/billing/billsPaidDays.ts`, the reads `billsPaidIo.ts`), worded as the job window words it. The month, the
 * day and the chip ride in the address, so a day can be bookmarked or sent to someone.
 *
 * Values in place: a day's facts are one a line with the values in a column, and every value is the app's own
 * working out, so none is a press. The presses are the chips, the days and the bills' names.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** A way's pill. The colours sort the ways apart and say nothing more: a check is not worse than a card. */
const HOW_LOOKS: Readonly<Record<BillsPaidHow, { background: string; color: string }>> = {
  stripe: { background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' },
  check: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  bank: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  cash: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  other: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }
const YMD = /^\d{4}-\d{2}-\d{2}$/

function SumTile({ label, sum, testId, phone, tint = false }: { label: string; sum: BillsPaidSum; testId: string; phone: boolean; tint?: boolean }) {
  return (
    <div style={tint ? { ...tile, background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)' } : tile} data-testid={testId}>
      <span style={tint ? { ...tileSmall, color: 'var(--text-green-800)' } : tileSmall}>{label}</span>
      <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>{plural(sum.payments, 'payment')}</b>{' '}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', ...(phone ? { display: 'block' } : {}) }}>
        <AmountSmallCents value={sum.total} />
      </span>
    </div>
  )
}

/** One day of the month: its number, what came in, and how many payments. The press picks the day. */
function DayCell({ cell, picked, phone, onPick }: { cell: BillsPaidCell; picked: boolean; phone: boolean; onPick: (ymd: string) => void }) {
  const has = cell.sum.payments > 0
  const style: CSSProperties = {
    fontFamily: 'inherit',
    display: 'grid',
    alignContent: 'start',
    gap: 1,
    minHeight: phone ? 50 : 58,
    padding: phone ? '3px' : '4px 5px',
    borderRadius: 6,
    textAlign: 'left',
    minWidth: 0,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    ...(has ? { background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)', color: 'var(--text-green-800)' } : {}),
    ...(cell.today ? { boxShadow: 'inset 0 0 0 2px var(--text-blue-700)' } : {}),
    ...(picked ? { background: 'var(--text-strong)', borderColor: 'var(--text-strong)', color: 'var(--surface)' } : {}),
    ...(cell.later ? { background: 'var(--bg-subtle)', borderStyle: 'dashed', cursor: 'default' } : {}),
  }
  const inside = picked ? 'var(--surface)' : 'var(--text-strong)'
  // A day that holds a credit in kind and no money: marked, never green, since nothing came in. A phone's cell takes the word alone.
  const credit = billsPaidCellCredit(cell, phone)
  return (
    <button type="button" data-testid="bills-paid-cell" data-day={cell.ymd} disabled={cell.later} aria-pressed={picked} aria-label={billsPaidCellLabel(cell)} onClick={() => onPick(cell.ymd)} style={style}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{cell.day}</span>
      {has ? (
        <>
          <span style={{ fontSize: phone ? '0.6875rem' : '0.75rem', fontWeight: 800, color: inside, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: phone ? '-0.02em' : undefined }}><MoneyText text={billsPaidCellMoney(cell.sum.total, phone)} /></span>
          {phone ? null : <span style={{ fontSize: '0.65625rem', color: picked ? 'var(--surface)' : 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{billsPaidCellCount(cell.sum)}</span>}
        </>
      ) : credit ? (
        <span data-testid="bills-paid-cell-credit" style={{ fontSize: '0.65625rem', color: picked ? 'var(--surface)' : 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: phone ? '-0.02em' : undefined }}>
          {credit}
        </span>
      ) : null}
    </button>
  )
}

/** One payment of the picked day: the bill and the job, the amount, then the way and how long the money took. */
function PaidLine({ line, phone }: { line: BillsPaidLine; phone: boolean }) {
  const look = HOW_LOOKS[line.how]
  // On a phone each name that is a press stands a fingertip tall.
  const press = linePress(phone)
  const time = billsPaidTime(line)
  const took = billsPaidTookWords(line)
  return (
    <div data-testid="bills-paid-line" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.05rem 0.6rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', minWidth: 0 }}>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {line.billId ? (
          <Link to={billsSentRecordPath(line.billId)} style={{ ...billLink, ...press }} title="Open every send of this bill">
            {line.what}
          </Link>
        ) : (
          <b style={strong}>{line.what}</b>
        )}
        {line.jobWords ? (
          <>
            {' · '}
            {line.jobTo ? (
              <Link to={line.jobTo} style={{ ...jobLink, ...press }}>
                {line.jobWords}
              </Link>
            ) : (
              line.jobWords
            )}
          </>
        ) : null}
        {line.payer ? ` · ${line.payer}` : ''}
      </div>
      <div style={line.inKind ? { ...money, color: 'var(--text-muted)' } : money}>
        <AmountSmallCents value={line.amount} />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, borderRadius: 999, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap', background: look.background, color: look.color }}>{line.wayWords}</span>
        {time ? (
          <span>
            Paid <WorkedOutValue>{time}</WorkedOutValue>
          </span>
        ) : null}
        {line.sentYmd ? (
          <span>
            Sent <WorkedOutValue>{formatWorkDateYmdWeekdayShortFriendly(line.sentYmd)}</WorkedOutValue>
          </span>
        ) : null}
        {took ? <span>{took}</span> : null}
        {line.partOfBill ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>Part of the bill. The bill is still open.</span> : null}
        {line.inKind ? <span>A credit in kind. Not added to the day.</span> : null}
      </div>
    </div>
  )
}

export function BillsPaidByDay() {
  const phone = useIsMobile()
  const { showToast } = useToastContext()
  const [params, setParams] = useSearchParams()
  const today = todayYmdInAppTz()
  const howParam = params.get('how')
  const how: BillsPaidChip = isBillsPaidChip(howParam) ? howParam : 'all'
  const dayParam = YMD.test(params.get('day') ?? '') ? (params.get('day') as string) : ''
  const thisMonth = billsPaidMonthOf(today)
  const asked = billsPaidMonthOf(params.get('month')) || billsPaidMonthOf(dayParam) || thisMonth
  // A month that has not come holds nothing: the view never opens past this one.
  const month = asked > thisMonth ? thisMonth : asked

  const [read, setRead] = useState<{ month: string; data: BillsPaidRead } | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)
  // Null until Stripe's answer is in, or when a caller hands back none: the tile is drawn only on an answer.
  const [payout, setPayout] = useState<BillsPaidPayoutAnswer | null>(null)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void readBillsPaid(billsPaidRange(month, today))
      .then((data) => {
        if (cancelled) return
        setRead({ month, data })
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, 'The payments did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, today, tries])
  const retry = useCallback(() => setTries((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    void readStripePayout().then((p) => {
      if (!cancelled) setPayout(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The month on the screen is the month that was read: a month still on its way draws nothing of the last one.
  const data = read && read.month === month ? read.data : null
  const lines = useMemo(() => (data ? billsPaidLines(data) : []), [data])
  const shown = useMemo(() => billsPaidFilter(lines, how), [lines, how])
  const chips = useMemo(() => billsPaidChips(lines), [lines])
  const grid = useMemo(() => billsPaidMonthCells(shown, month, today), [shown, month, today])
  const tiles = useMemo(() => billsPaidTiles(shown, month, today), [shown, month, today])
  const day = dayParam && billsPaidMonthOf(dayParam) === month && dayParam <= today ? dayParam : billsPaidOpeningDay(shown, month, today)
  const dayLines = useMemo(() => shown.filter((l) => l.ymd === day), [shown, day])
  const everyWay = useMemo(() => lines.filter((l) => l.ymd === day), [lines, day])
  const daySum = billsPaidSum(dayLines)
  const everySum = billsPaidSum(everyWay)
  const groups = useMemo(() => billsPaidDayGroups(dayLines), [dayLines])
  const monthLines = useMemo(() => shown.filter((l) => billsPaidMonthOf(l.ymd) === month), [shown, month])
  const chipLabel = how === 'all' ? '' : (chips.find((c) => c.key === how)?.label ?? '')
  const tail = how === 'all' ? '' : ` · ${chipLabel}`

  /** The address carries the view's own state: a day, a month and a chip. Each change is one step back. */
  const go = useCallback(
    (patch: { day?: string; month?: string; how?: BillsPaidChip }) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('view', 'paid')
        if (patch.how !== undefined) {
          if (patch.how === 'all') next.delete('how')
          else next.set('how', patch.how)
        }
        if (patch.month !== undefined) {
          next.set('month', patch.month)
          next.delete('day')
        }
        if (patch.day !== undefined) {
          next.set('day', patch.day)
          next.delete('month')
        }
        return next
      })
    },
    [setParams],
  )

  const printMonth = () => {
    if (!openHtmlPrintWindow(billsPaidMonthHtml(shown, { month, how, printedAtIso: new Date().toISOString() }))) showToast('The print window was blocked. Allow pop-ups for this site and press it again.', 'error')
  }
  const saveCsv = () => {
    // The byte order mark lets a spreadsheet read the file's accents and dots as written.
    saveBlobAs(new Blob(['﻿', billsPaidCsv(monthLines)], { type: 'text/csv;charset=utf-8' }), billsPaidCsvFileName(month, how))
  }
  const outPress: CSSProperties = phone ? phoneButton : { ...chipStyle(false), borderRadius: 6, fontWeight: 700, color: 'var(--text-strong)' }
  const outRow =
    data != null && monthLines.length > 0 ? (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: phone ? 'flex-start' : 'flex-end' }} data-testid="bills-paid-out">
        <button type="button" onClick={printMonth} style={outPress}>
          Print
        </button>
        <button type="button" onClick={saveCsv} style={outPress}>
          Download CSV
        </button>
      </div>
    ) : null

  const empty = billsPaidEmptyDay({ ymd: day, how, everyWay: everySum.payments, todayYmd: today })
  // A month step names the month it opens, and each sits at its own edge of the card, so neither moves as the month's name changes width.
  const step: CSSProperties = { ...outPress, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', whiteSpace: 'nowrap', ...(phone ? { minWidth: THUMB, padding: '0 0.6rem' } : {}) }
  const chevron: CSSProperties = { fontSize: '1.15em', lineHeight: 1, fontWeight: 400 }
  const before = billsPaidShiftMonth(month, -1)
  const after = billsPaidShiftMonth(month, 1)
  const atLatest = month >= thisMonth
  const tileCount = (tiles.today ? 2 : 0) + 1 + (payout ? 1 : 0)

  return (
    <section aria-label="Bills paid, by day" data-testid="bills-paid-view" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {phone ? null : outRow}
      <div data-testid="bills-paid-tiles" style={tileRow(phone, tileCount)}>
        {tiles.today ? <SumTile label={`Today${tail}`} sum={tiles.today} testId="bills-paid-tile-today" phone={phone} /> : null}
        {tiles.week ? <SumTile label={`This week${tail}`} sum={tiles.week} testId="bills-paid-tile-week" phone={phone} /> : null}
        <SumTile label={`${billsPaidMonthName(month)}${tail}`} sum={tiles.month} testId="bills-paid-tile-month" phone={phone} tint />
        {payout?.state === 'coming' ? (
          <div style={tile} data-testid="bills-paid-tile-payout" title="What Stripe sends to the bank next, after Stripe’s fee. It is less than the Stripe payments it carries.">
            <span style={tileSmall}>Next Stripe payout to the bank</span>
            <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem', fontVariantNumeric: 'tabular-nums' }}>
              <AmountSmallCents value={payout.usd} />
            </b>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', ...(phone ? { display: 'block' } : {}) }}>{payout.arrivalYmd ? formatWorkDateYmdWeekdayShortFriendly(payout.arrivalYmd) : 'on its way'}</span>
          </div>
        ) : payout ? (
          // No payout is an answer too: the tile keeps its place and says which, so it never reads as a tile gone missing.
          <div style={tile} data-testid="bills-paid-tile-payout" title={payout.state === 'none' ? 'Stripe has no payout to the bank on its way. A payment joins the next one once Stripe has cleared it.' : 'Stripe was asked for its next payout and gave no answer. Open the page again to ask once more.'}>
            <span style={tileSmall}>Next Stripe payout to the bank</span>
            <b style={{ color: 'var(--text-700)', fontSize: '0.875rem' }}>{billsPaidPayoutWords(payout)}</b>
          </div>
        ) : null}
      </div>
      <div role="group" aria-label="How it was paid" style={phone ? { display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.15rem', WebkitOverflowScrolling: 'touch' } : { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {chips.map((c) => (
          <button key={c.key} type="button" aria-pressed={how === c.key} onClick={() => go({ how: c.key })} style={chipStyle(how === c.key, phone)}>
            {c.label}
          </button>
        ))}
      </div>
      {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="bills-paid" idempotent busy={reading} /> : null}
      {data == null && !failure ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : data != null ? (
        // The month and its day sit side by side only when each has room: a day's cell must hold four digits whole.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 28rem), 1fr))', gap: '0.6rem', alignItems: 'start' }}>
          <div style={{ ...panel, padding: phone ? '0.4rem' : '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: '0.5rem', padding: '0 0.1rem 0.4rem' }}>
              <span style={{ justifySelf: 'start' }}>
                <button type="button" data-testid="bills-paid-step-back" onClick={() => go({ month: before })} aria-label={billsPaidMonthLabel(before)} title={`Open ${billsPaidMonthLabel(before)}`} style={step}>
                  <span aria-hidden="true" style={chevron}>
                    ‹
                  </span>
                  {billsPaidStepLabel(month, -1)}
                </button>
              </span>
              <span style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', minWidth: 0 }}>
                <b style={{ color: 'var(--text-strong)', fontSize: '0.875rem' }} data-testid="bills-paid-month">
                  {billsPaidMonthLabel(month)}
                </b>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
                  <AmountSmallCents value={tiles.month.total} />
                </span>
              </span>
              <span style={{ justifySelf: 'end' }}>
                {atLatest ? null : (
                  <button type="button" data-testid="bills-paid-step-on" onClick={() => go({ month: after })} aria-label={billsPaidMonthLabel(after)} title={`Open ${billsPaidMonthLabel(after)}`} style={step}>
                    {billsPaidStepLabel(month, 1)}
                    <span aria-hidden="true" style={chevron}>
                      ›
                    </span>
                  </button>
                )}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
              {WEEKDAYS.map((w) => (
                <div key={w} style={{ fontSize: '0.65625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', padding: '2px 0' }}>
                  {w}
                </div>
              ))}
              {Array.from({ length: grid.blanks }, (_, i) => (
                <span key={`blank-${i}`} aria-hidden="true" />
              ))}
              {grid.cells.map((cell) => (
                <DayCell key={cell.ymd} cell={cell} picked={cell.ymd === day} phone={phone} onPick={(ymd) => go({ day: ymd })} />
              ))}
            </div>
            <p style={{ margin: '0.5rem 0.1rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }} data-testid="bills-paid-foot">
              A figure is what came in that day. The ring is today. Stripe’s fee is not taken off. A refund made in Stripe is not shown. All times are Central.
              {data.more ? ' This month holds more payments than one read takes. Its first days may be short.' : ''}
            </p>
          </div>
          <div style={{ ...panel, padding: '0.6rem 0.75rem' }} data-testid="bills-paid-day">
            <h2 style={{ margin: '0 0 0.4rem', fontSize: '0.9375rem', color: 'var(--text-strong)' }}>{billsPaidDayHeading(day, today)}</h2>
            {dayLines.length === 0 ? (
              <EmptyState
                compact
                finger={phone}
                main={empty.main}
                next={empty.next === 'Show every way that day' ? { label: empty.next, onPress: () => go({ how: 'all' }) } : empty.next === 'Go to today' ? { label: empty.next, onPress: () => go({ day: today }) } : undefined}
              />
            ) : (
              <>
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>
                  <ValueLines>
                    <ValueLine label={how === 'all' ? 'Came in' : `Came in · ${chipLabel}`}>
                      <WorkedOutValue>
                        <AmountSmallCents value={daySum.total} />
                      </WorkedOutValue>
                    </ValueLine>
                    <ValueLine label="Payments">
                      <WorkedOutValue>{daySum.payments}</WorkedOutValue>
                    </ValueLine>
                    {how !== 'all' && everySum.payments > daySum.payments ? (
                      <ValueLine label="Every way that day">
                        <WorkedOutValue>
                          <AmountSmallCents value={everySum.total} />
                        </WorkedOutValue>{' '}
                        <button
                          type="button"
                          onClick={() => go({ how: 'all' })}
                          style={{ fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, border: 'none', background: 'transparent', padding: 0, marginLeft: '0.4rem', cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2, ...(phone ? { minHeight: THUMB } : {}) }}
                        >
                          Show
                        </button>
                      </ValueLine>
                    ) : null}
                  </ValueLines>
                </div>
                {groups.map((g) => {
                  const words = billsPaidGroupWords(g)
                  return (
                    <div key={g.lines[0]?.id ?? 'group'}>
                      {words ? (
                        <div data-testid="bills-paid-deposit" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem 0.5rem', marginTop: '0.35rem', padding: '0.25rem 0.5rem', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                          <span>{words}</span>
                          <b style={{ ...strong, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                            <AmountSmallCents value={g.total} />
                          </b>
                        </div>
                      ) : null}
                      {g.lines.map((l) => (
                        <PaidLine key={l.id} line={l} phone={phone} />
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      ) : null}
      {phone ? outRow : null}
    </section>
  )
}

export default BillsPaidByDay
