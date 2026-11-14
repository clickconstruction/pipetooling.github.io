/**
 * Jobs → Subs → Ledger (punch list #347, PR 2): every payment and back-charge made against a sub sheet as one
 * dated line, newest first, under its month with the month's total. The screen to hold beside a bank statement.
 *
 * It reads what the Pay view already holds: the page's `laborJobs`, each with its `payments` and `payment_events`.
 * Nothing is fetched for it but the roster that says whose a sheet is (the Pay view's own hook), and nothing is
 * written. A job's name opens the sheet, where a payment's Date sent and memo are edited.
 *
 * At a desk it is a table. On a phone each line is a card and Print and the file move under the list.
 *
 * PR 3: the same lines **By sub**. One row per person, and a name (or the Paid to picker) opens that person's
 * statement with what we owed after each line. People → Subs mounts this too, opening on By sub.
 */
import { useMemo, useState } from 'react'
import type { LaborJob } from '../../types/laborJob'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'
import { sheetLabel } from '../../lib/jobs/subPaymentMoveRemove'
import { buildSheetPartiesLookup, sheetParties } from '../../lib/subWorkOrders/sheetParties'
import {
  buildLedgerLines,
  buildLedgerTraces,
  buildSubStatement,
  filterLedger,
  ledgerBySub,
  ledgerBySubTotals,
  ledgerDayWords,
  ledgerHowPaidWords,
  ledgerSubKeyFromParam,
  ledgerSubParam,
  overPaidWords,
  statementCheckWords,
  subStatementCsv,
  subStatementCsvFileName,
  subStatementHtml,
  weOweWords,
  ledgerMonths,
  ledgerPaidToOptions,
  ledgerPaidWords,
  ledgerPeriodRange,
  ledgerTotals,
  leftOnSheetWords,
  LEDGER_PERIODS,
  subPaymentsCsv,
  subPaymentsCsvFileName,
  subPaymentsLedgerHtml,
  type LedgerLine,
  type LedgerPeriodKey,
  type LedgerRow,
  type LedgerSheet,
} from '../../lib/subWorkOrders/subPaymentsLedger'
import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { useToastContext } from '../../contexts/ToastContext'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { saveBlobAs } from '../../lib/storageSave'
import { calendarYmdInAppTzFromIso, formatDenverDateTimeShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { AmountSmallCents } from '../AmountSmallCents'
import { EmptyState } from '../EmptyState'
import { SubLedgerPeople, SubLedgerStatement } from './SubLedgerBySub'
import { chip, field, jobLink, outPress, pill, td, th, tile, tileLabel, tileSub } from './subLedgerStyles'

export type LedgerGrouping = 'date' | 'sub'

export type SubPaymentsLedgerProps = {
  error?: string | null
  laborJobs: LaborJob[]
  laborJobsLoading: boolean
  laborJobNamesByJobId: Record<string, string>
  laborJobAssigneesByJobId: Map<string, { personId: string; personName: string | null }[]>
  /** Open a sheet's own window, where its payments are edited. */
  onOpenSheet: (job: LaborJob) => void
  /** The Pay view, where a payment is recorded: the empty ledger's way out. */
  onOpenPay: () => void
  /** Which grouping shows. Left out, the ledger keeps its own and opens on `initialBy` (By date). */
  by?: LedgerGrouping
  onByChange?: (by: LedgerGrouping) => void
  initialBy?: LedgerGrouping
  /** The person whose statement is open, as the address carries them (`ledgerSubParam`). Left out, the ledger keeps its own. */
  sub?: string | null
  onSubChange?: (sub: string | null) => void
  /** People → Subs' Balance due by person id, for the statement's check. Left out, the foot says what we owe and checks nothing. */
  balanceDueByPersonId?: ReadonlyMap<string, number>
}

/** The amount cell: a payment plain, a back-charge red with its minus sign. */
function Amount({ line }: { line: LedgerLine }) {
  return line.amount < 0 ? (
    <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>
      −<AmountSmallCents value={-line.amount} />
    </span>
  ) : (
    <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>
      <AmountSmallCents value={line.amount} />
    </span>
  )
}

function Left({ line }: { line: LedgerLine }) {
  if (line.leftOnSheet === 0) return <span style={pill('green')}>paid in full</span>
  if (line.leftOnSheet < 0) return <span style={{ color: 'var(--text-green-700)' }}>{leftOnSheetWords(line.leftOnSheet)}</span>
  return <AmountSmallCents value={line.leftOnSheet} />
}

export function SubPaymentsLedger({ error, laborJobs, laborJobsLoading, laborJobNamesByJobId, laborJobAssigneesByJobId, onOpenSheet, onOpenPay, by: byProp, onByChange, initialBy, sub: subProp, onSubChange, balanceDueByPersonId }: SubPaymentsLedgerProps) {
  const narrow = useIsNarrowScreen()
  const { showToast } = useToastContext()
  const { roster } = useRosterSubKinds()
  const today = todayYmdInAppTz()
  const [period, setPeriod] = useState<LedgerPeriodKey>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ownPaidToKey, setOwnPaidToKey] = useState('')
  const [search, setSearch] = useState('')
  const [ownBy, setOwnBy] = useState<LedgerGrouping>(initialBy ?? 'date')
  const by = byProp ?? ownBy
  const setBy = (next: LedgerGrouping) => {
    setOwnBy(next)
    onByChange?.(next)
  }

  /** Every sheet as the ledger reads it: whose it is by the Pay view's rule, which job, what was agreed. */
  const sheets = useMemo<LedgerSheet[]>(() => {
    const lookup = buildSheetPartiesLookup(roster)
    return laborJobs.map((job) => {
      const parties = sheetParties(job, laborJobAssigneesByJobId.get(job.id), lookup)
      return {
        id: job.id,
        paidTo: parties.label || job.assigned_to_name || 'nobody named',
        paidToKey: parties.key || `sheet:${job.id}`,
        crew: roster.length > 0 && parties.crew,
        job: sheetLabel(job, laborJobNamesByJobId),
        address: (job.address ?? '').trim(),
        agreed: subLaborJobBalance(job).totalCost,
        day: (job.job_date ?? '').slice(0, 10) || (job.created_at ? calendarYmdInAppTzFromIso(job.created_at) : ''),
        payments: job.payments ?? [],
        events: job.payment_events ?? [],
      }
    })
  }, [laborJobs, laborJobAssigneesByJobId, laborJobNamesByJobId, roster])
  const jobById = useMemo(() => new Map(laborJobs.map((j) => [j.id, j])), [laborJobs])

  const allLines = useMemo(() => buildLedgerLines(sheets), [sheets])
  const allTraces = useMemo(() => buildLedgerTraces(sheets), [sheets])
  /** Everyone a sheet is for, paid yet or not: the Paid to picker and the statement's address read this. */
  const paidToOptions = useMemo(() => ledgerPaidToOptions(sheets.map((s) => ({ paidToKey: s.paidToKey, paidTo: s.paidTo, crew: s.crew }))), [sheets])
  // The person picked. With an address handed in (`sub`), that is the truth, so a link to one sub's statement opens it.
  const paidToKey = subProp !== undefined ? ledgerSubKeyFromParam(subProp, paidToOptions.map((o) => o.key)) : ownPaidToKey
  const setPaidToKey = (key: string) => {
    setOwnPaidToKey(key)
    onSubChange?.(key ? ledgerSubParam(key) : null)
  }
  const range = useMemo(() => ledgerPeriodRange(period, today, { from, to }), [period, today, from, to])
  const shownLines = useMemo(() => filterLedger(allLines, { ...range, paidToKey, search }), [allLines, range, paidToKey, search])
  const shownTraces = useMemo(() => filterLedger(allTraces, { ...range, paidToKey, search }), [allTraces, range, paidToKey, search])
  const months = useMemo(() => ledgerMonths([...shownLines, ...shownTraces] as LedgerRow[]), [shownLines, shownTraces])
  const totals = useMemo(() => ledgerTotals(shownLines), [shownLines])
  const subRows = useMemo(() => ledgerBySub(sheets, shownLines, { paidToKey, search }), [sheets, shownLines, paidToKey, search])
  const subTotals = useMemo(() => ledgerBySubTotals(subRows), [subRows])
  /** By sub with a person picked is that person's statement. It reads the period and never the search: a line left out would break the running figure. */
  const statement = useMemo(() => (by === 'sub' && paidToKey ? buildSubStatement(sheets, paidToKey, range) : null), [by, paidToKey, sheets, range])
  const statementCheck = useMemo(() => {
    if (!statement) return null
    const personId = statement.key.startsWith('id:') ? statement.key.slice(3) : ''
    const known = balanceDueByPersonId && personId && !statement.crew ? (balanceDueByPersonId.get(personId) ?? null) : null
    return statementCheckWords(statement, known)
  }, [statement, balanceDueByPersonId])
  /** The lines in the screen's order, for the file. */
  const orderedLines = useMemo(() => months.flatMap((m) => m.rows).filter((r): r is LedgerLine => r.kind !== 'trace'), [months])

  const periodLabel = period === 'custom' ? [from ? ledgerDayWords(from, true) : 'the start', to ? ledgerDayWords(to, true) : 'today'].join(' to ') : (LEDGER_PERIODS.find((p) => p.key === period)?.label ?? 'All')
  const paidToLabel = paidToOptions.find((o) => o.key === paidToKey)?.label ?? ''
  const shownWords = [`${periodLabel}.`, paidToLabel ? `Paid to ${paidToLabel}.` : '', search.trim() ? `Search “${search.trim()}”.` : ''].filter(Boolean).join(' ')

  const printList = () => {
    const html = statement
      ? subStatementHtml(statement, { periodWords: `${periodLabel}.`, checkWords: statementCheck?.words ?? '', printedWords: formatDenverDateTimeShort(Date.now()) })
      : subPaymentsLedgerHtml(months, totals, { shownWords, printedWords: formatDenverDateTimeShort(Date.now()) })
    if (!openHtmlPrintWindow(html)) showToast('The print window was blocked. Allow pop-ups for this site and press it again.', 'error')
  }
  const saveCsv = () =>
    statement
      ? saveBlobAs(new Blob(['﻿', subStatementCsv(statement)], { type: 'text/csv;charset=utf-8' }), subStatementCsvFileName(statement.name, today))
      : saveBlobAs(new Blob(['﻿', subPaymentsCsv(orderedLines)], { type: 'text/csv;charset=utf-8' }), subPaymentsCsvFileName(today))
  const nothingToSend = statement ? statement.entries.length === 0 : orderedLines.length === 0
  const withYear = period === 'all' || period === 'custom'

  const openSheet = (sheetId: string) => {
    const job = jobById.get(sheetId)
    if (job) onOpenSheet(job)
  }
  const dayCell = (r: LedgerLine) => (
    <>
      <span style={{ fontWeight: r.recorded ? 400 : 700, color: r.recorded ? 'var(--text-muted)' : 'var(--text-strong)' }}>{ledgerDayWords(r.ymd, r.ymd.slice(0, 4) !== today.slice(0, 4))}</span>
      {r.kind === 'payment' && (r.recorded || !r.ymd) ? (
        <span title="This payment was saved with no Date sent. The day shown is the day it was recorded. Open the sheet to set the date." style={{ ...pill('amber'), marginLeft: narrow ? 6 : 0, display: narrow ? 'inline-block' : 'block', width: 'fit-content', marginTop: narrow ? 0 : 2 }}>
          no date sent
        </span>
      ) : r.kind === 'backcharge' ? (
        <span style={{ display: narrow ? 'inline' : 'block', marginLeft: narrow ? 6 : 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>recorded</span>
      ) : null}
    </>
  )

  const outPresses = (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <button type="button" onClick={printList} disabled={nothingToSend} style={outPress}>
        {statement ? 'Print the statement' : 'Print'}
      </button>
      <button type="button" onClick={saveCsv} disabled={nothingToSend} style={outPress}>
        Download CSV
      </button>
    </span>
  )

  const empty =
    allLines.length === 0 ? (
      <EmptyState main="Nothing has been paid on a sub sheet yet." next={{ label: 'Pay', onPress: onOpenPay }} tail="is where a payment is recorded." />
    ) : search.trim() ? (
      <EmptyState main={`Nothing here matches “${search.trim()}”.`} next={{ label: 'Clear the search', onPress: () => setSearch('') }} />
    ) : paidToKey ? (
      <EmptyState main={`Nothing was paid to ${paidToLabel || 'them'} in this period.`} next={{ label: 'Show everyone', onPress: () => setPaidToKey('') }} orNext={period === 'all' ? undefined : { label: 'show all dates', onPress: () => setPeriod('all') }} />
    ) : (
      <EmptyState main="Nothing was paid in this period." next={{ label: 'Show all dates', onPress: () => setPeriod('all') }} />
    )

  return (
    <div data-sub-payments-ledger>
      {error ? <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <span role="group" aria-label="Group the ledger" style={{ display: 'inline-flex', gap: 4 }}>
          <button type="button" aria-pressed={by === 'date'} onClick={() => setBy('date')} style={chip(by === 'date')}>
            By date
          </button>
          <button type="button" aria-pressed={by === 'sub'} onClick={() => setBy('sub')} style={chip(by === 'sub')}>
            By sub
          </button>
        </span>
        {statement ? (
          <span data-statement-head style={{ flex: '1 1 220px', minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setPaidToKey('')} style={{ ...jobLink, fontSize: '0.8125rem' }}>
              ‹ Everyone
            </button>
            <strong style={{ fontSize: '1rem', color: 'var(--text-strong)' }}>{statement.name || 'Statement'}</strong>
            {statement.crew ? <span style={pill('gray')}>crew</span> : null}
          </span>
        ) : (
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a sub, a job, a memo, an amount…" aria-label="Search the ledger" style={{ ...field, flex: '1 1 220px' }} />
        )}
        {narrow ? null : outPresses}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {LEDGER_PERIODS.map((p) => (
          <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} style={chip(period === p.key)}>
            {p.label}
          </button>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <input type="date" aria-label="From" value={period === 'custom' ? from : ''} onChange={(e) => { setFrom(e.target.value); setPeriod('custom') }} style={{ ...field, padding: '0.2rem 0.4rem', fontSize: '0.78rem' }} />
          to
          <input type="date" aria-label="To" value={period === 'custom' ? to : ''} onChange={(e) => { setTo(e.target.value); setPeriod('custom') }} style={{ ...field, padding: '0.2rem 0.4rem', fontSize: '0.78rem' }} />
        </span>
        <select aria-label="Paid to" value={paidToKey} onChange={(e) => setPaidToKey(e.target.value)} style={{ ...field, maxWidth: narrow ? '100%' : 260 }}>
          <option value="">Paid to: everyone</option>
          {paidToOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
              {o.crew ? ' (crew)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 12 }}>
        <div style={tile} data-ledger-tile="paid">
          <span style={tileLabel}>Paid in this period</span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--text-strong)' }}>
            <AmountSmallCents value={totals.paidTotal} />
          </strong>
          <span style={tileSub}>{ledgerPaidWords(totals)}</span>
        </div>
        <div style={tile} data-ledger-tile="backcharged">
          <span style={tileLabel}>Back-charged</span>
          <strong style={{ fontSize: '1.15rem', color: totals.backcharges ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
            <AmountSmallCents value={totals.backchargeTotal} />
          </strong>
          <span style={tileSub}>{totals.backcharges === 1 ? '1 back-charge' : `${totals.backcharges} back-charges`}</span>
        </div>
        {by === 'sub' ? (
          <div style={tile} data-ledger-tile="owed">
            <span style={tileLabel}>We owe today</span>
            <strong style={{ fontSize: '1.15rem', color: 'var(--text-strong)' }}>{statement ? weOweWords(statement.owedToday) : <AmountSmallCents value={subTotals.weOwe} />}</strong>
            <span style={tileSub}>{statement ? (statement.crew ? 'crew pay runs through payroll' : 'every sheet of theirs, whatever the period') : subTotals.over ? `still open on sheets · ${overPaidWords(subTotals.over)}` : 'still open on sheets, whatever the period'}</span>
          </div>
        ) : (
          <div style={tile} data-ledger-tile="undated">
            <span style={tileLabel}>Without a date sent</span>
            <strong style={{ fontSize: '1.15rem', color: 'var(--text-strong)' }}>{totals.undated}</strong>
            <span style={tileSub}>{totals.undated ? 'shown by the day recorded' : 'every payment has its date'}</span>
          </div>
        )}
      </div>

      {laborJobsLoading && laborJobs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading the ledger…</p>
      ) : statement && statementCheck ? (
        <>
          {statement.entries.length === 0 && !statement.from ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              <EmptyState main={`Nothing was agreed or paid for ${statement.name || 'them'} in this period.`} next={{ label: 'Show all dates', onPress: () => setPeriod('all') }} />
            </div>
          ) : (
            <SubLedgerStatement statement={statement} check={statementCheck} narrow={narrow} withYear={withYear} onOpenSheet={openSheet} />
          )}
          {narrow ? <div style={{ marginTop: 10 }}>{outPresses}</div> : null}
        </>
      ) : by === 'sub' ? (
        subRows.length === 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>{empty}</div>
        ) : (
          <>
            <SubLedgerPeople rows={subRows} totals={subTotals} periodLabel={periodLabel} narrow={narrow} withYear={withYear} onOpen={setPaidToKey} />
            {narrow ? <div style={{ marginTop: 10 }}>{outPresses}</div> : null}
          </>
        )
      ) : months.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>{empty}</div>
      ) : narrow ? (
        <div data-ledger-phone style={{ display: 'grid', gap: 8 }}>
          {months.map((m) => (
            <div key={m.ym || 'undated'} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }}>
                <span>{m.label}</span>
                <span>
                  <AmountSmallCents value={m.totals.paidTotal} />
                </span>
              </div>
              {m.rows.map((r) =>
                r.kind === 'trace' ? (
                  <div key={r.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {ledgerDayWords(r.ymd)} · {r.text}
                  </div>
                ) : (
                  <button key={r.id} type="button" data-ledger-line={r.id} onClick={() => openSheet(r.sheetId)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', padding: '0.55rem 0.7rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                    <span style={{ minWidth: 0, fontWeight: 600 }}>
                      {dayCell(r)} <span style={{ fontWeight: 600 }}>· {r.paidTo}</span>
                      {r.crew ? <span style={{ ...pill('gray'), marginLeft: 6 }}>crew</span> : null}
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <Amount line={r} />
                    </span>
                    <span style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 0 }}>
                      {r.job}
                      {r.kind === 'backcharge' ? ' · Back-charge' : ''}
                      {ledgerHowPaidWords(r) ? ` · ${ledgerHowPaidWords(r)}` : ''}
                      {r.memo ? ` · ${r.memo}` : ''}
                    </span>
                  </button>
                ),
              )}
            </div>
          ))}
          <div style={{ marginTop: 6 }}>{outPresses}</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto', background: 'var(--surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960 }}>
            <thead>
              <tr>
                <th style={th}>Date sent</th>
                <th style={th}>Paid to</th>
                <th style={th}>Job</th>
                <th style={th}>How paid</th>
                <th style={th}>Memo</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Left on the sheet</th>
              </tr>
            </thead>
            {months.map((m) => (
              <tbody key={m.ym || 'undated'} data-ledger-month={m.ym || 'undated'}>
                <tr>
                  <td colSpan={5} style={{ ...td, background: 'var(--bg-muted)', fontWeight: 700, color: 'var(--text-strong)' }}>
                    {m.label}
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>{m.words}</span>
                  </td>
                  <td style={{ ...td, background: 'var(--bg-muted)', fontWeight: 700, color: 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <AmountSmallCents value={m.totals.paidTotal} />
                  </td>
                  <td style={{ ...td, background: 'var(--bg-muted)' }} />
                </tr>
                {m.rows.map((r) =>
                  r.kind === 'trace' ? (
                    <tr key={r.id} data-ledger-trace={r.id}>
                      <td style={{ ...td, background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{ledgerDayWords(r.ymd)}</td>
                      <td colSpan={6} style={{ ...td, background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {r.text}
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} data-ledger-line={r.id}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{dayCell(r)}</td>
                      <td style={td}>
                        {r.paidTo}
                        {r.crew ? <span style={{ ...pill('gray'), marginLeft: 6 }}>crew</span> : null}
                      </td>
                      <td style={td}>
                        <button type="button" onClick={() => openSheet(r.sheetId)} title="Open the sheet" style={jobLink}>
                          {r.job}
                        </button>
                        {r.address && !r.job.includes(r.address) ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.address}</div> : null}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }} data-ledger-how={r.id}>
                        {ledgerHowPaidWords(r) || <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td style={td}>
                        {r.kind === 'backcharge' ? <span style={{ ...pill('red'), marginRight: 6 }}>Back-charge</span> : null}
                        {r.memo || (r.kind === 'backcharge' ? '' : <span style={{ color: 'var(--text-faint)' }}>—</span>)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Amount line={r} />
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Left line={r} />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            ))}
            <tfoot>
              <tr data-ledger-foot>
                <td colSpan={5} style={{ ...td, borderBottom: 'none', background: 'var(--bg-subtle)', fontWeight: 700, color: 'var(--text-strong)' }}>
                  {periodLabel} · {ledgerPaidWords(totals)}
                  {totals.backcharges ? `, less ${totals.backcharges === 1 ? '1 back-charge' : `${totals.backcharges} back-charges`}` : ''}
                </td>
                <td style={{ ...td, borderBottom: 'none', background: 'var(--bg-subtle)', fontWeight: 700, color: 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <AmountSmallCents value={totals.paidTotal} />
                </td>
                <td style={{ ...td, borderBottom: 'none', background: 'var(--bg-subtle)' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default SubPaymentsLedger
