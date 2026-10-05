/**
 * People → Spending (punch list #52, PR 4b-2): who is spending what on the company's cards, for
 * any period. One row per person, plus Company cards and Not tied to anyone: card spend, ⛽ fuel,
 * other, on jobs, Office and Payroll when the period has any, not on a job, and jobs. A person
 * opens to their jobs, their charges on supply invoices and the charges not on a job yet, each
 * with *Put on a job* — today's Assign window, saving the way Team purchases does for a held card
 * and the way Banking does for any other. Thin: the read and the numbers are
 * `lib/people/loadSpending.ts` and `lib/people/spendingRollup.ts` (the Job window's own rules).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../../utils/dateUtils'
import { isMissingRpcError } from '../../lib/customers/customersListBundle'
import { loadSpending, type SpendingLoad } from '../../lib/people/loadSpending'
import { SPENDING_PERIODS, SPENDING_PERIOD_DEFAULT, spendingPeriodRange, type SpendingPeriod } from '../../lib/people/spendingPeriod'
import type { SpendingLooseCharge, SpendingRow } from '../../lib/people/spendingRollup'
import { formatJobLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { MercuryTransactionAllocationsModal, type MercuryJobSplit } from '../MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../SearchableSelect'
import type { Database } from '../../types/database'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

type Props = {
  /** Payroll access (dev, controller, a pay-approved master): only they get the payroll-marked charges. */
  canSeePayroll: boolean
}

const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const usd = (n: number) => usdFmt.format(Math.abs(n) < 0.005 ? 0 : n)
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' })
const ymdFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : '0%')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function ymdLabel(ymd: string): string {
  return ymdFmt.format(new Date(`${ymd}T12:00:00Z`))
}

const pillStyle = (on: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.8rem',
  padding: '0.2rem 0.6rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border-strong)'}`,
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-base)',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
})

const linkButtonStyle: CSSProperties = {
  font: 'inherit',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-link)',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
}

const smallButtonStyle: CSSProperties = {
  font: 'inherit',
  fontSize: '0.75rem',
  padding: '0.15rem 0.55rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const th: CSSProperties = {
  textAlign: 'right',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid var(--border-strong)',
  background: 'var(--bg-subtle)',
  whiteSpace: 'nowrap',
}
const td: CSSProperties = {
  padding: '0.45rem 0.5rem',
  borderBottom: '1px solid var(--border)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}
const firstCell: CSSProperties = { ...td, textAlign: 'left' }

function Tile({ k, v, s, warn = false }: { k: string; v: string; s: string; warn?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${warn ? 'var(--border-amber)' : 'var(--border)'}`,
        background: warn ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
        borderRadius: 8,
        padding: '0.55rem 0.7rem',
      }}
    >
      <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: warn ? 'var(--text-amber-700)' : 'var(--text-strong)' }}>{v}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s}</div>
    </div>
  )
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: SpendingLoad } | { kind: 'not_live' } | { kind: 'error'; message: string }

export default function PeopleSpendingTab({ canSeePayroll }: Props) {
  const today = useMemo(() => denverCalendarDayKey(Date.now()), [])
  const [period, setPeriod] = useState<SpendingPeriod>(SPENDING_PERIOD_DEFAULT)
  const [custom, setCustom] = useState({ start: '', end: '' })
  const range = useMemo(() => spendingPeriodRange(period, custom, today), [period, custom, today])
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [chargesOpenKey, setChargesOpenKey] = useState<string | null>(null)
  const loadSeq = useRef(0)
  const narrow = useNarrowViewport640()
  const { prefixMap } = useLedgerDisplayPrefixes()
  const jobDetail = useJobDetailModal()
  const { showToast } = useToastContext()
  const { nicknameByAccount, nicknameByDebitCard } = useMercuryLedgerNicknames()

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }))
    try {
      const data = await loadSpending({ startYmd: range.start, endYmd: range.end })
      if (seq === loadSeq.current) setState({ kind: 'ready', data })
    } catch (e) {
      if (seq !== loadSeq.current) return
      const message = e instanceof Error ? e.message : String(e)
      setState(isMissingRpcError(message) ? { kind: 'not_live' } : { kind: 'error', message })
    }
  }, [range.start, range.end])

  useEffect(() => {
    void load()
  }, [load])

  // Put on a job: today's Assign window, opened on the charge's own bank row.
  const [assign, setAssign] = useState<{ tx: MercuryTxRow; loose: SpendingLooseCharge; splits: MercuryJobSplit[]; jobLabelById: Record<string, string> } | null>(null)
  const [usersOptions, setUsersOptions] = useState<SearchableSelectOption[] | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const jobLabel = useCallback(
    (j: { hcpNumber: string | null; clickNumber: string | null; jobName: string | null; serviceTypeId: string | null }) =>
      formatJobLedgerShortLine(prefixMap, j.serviceTypeId, j.hcpNumber, j.jobName, j.clickNumber),
    [prefixMap],
  )

  const openAssign = useCallback(
    async (loose: SpendingLooseCharge) => {
      if (state.kind !== 'ready') return
      setOpening(loose.id)
      try {
        const tx = (await withSupabaseRetry(
          async () => supabase.from('mercury_transactions').select('*').eq('id', loose.id).maybeSingle(),
          'spending put on a job',
        )) as MercuryTxRow | null
        if (!tx) {
          showToast('Could not open this charge. Try again.', 'error')
          return
        }
        if (loose.sortMode === 'banking' && usersOptions == null) {
          const people = await withSupabaseRetry(async () => supabase.rpc('list_users_for_banking_attribution'), 'spending people for the assign window').catch(() => [])
          setUsersOptions(((people ?? []) as Array<{ id: string; name: string }>).map((p) => ({ value: p.id, label: p.name })))
        }
        const charge = state.data.chargeById.get(loose.id)
        const splits = (charge?.splits ?? []).map((s) => ({ job_id: s.jobId, amount: s.amount }))
        const jobLabelById = Object.fromEntries((charge?.splits ?? []).map((s) => [s.jobId, jobLabel(s)]))
        setAssign({ tx, loose, splits, jobLabelById })
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not open this charge.', 'error')
      } finally {
        setOpening(null)
      }
    },
    [state, usersOptions, showToast, jobLabel],
  )

  const data = state.kind === 'ready' ? state.data : null
  const totals = data?.totals
  const showOffice = (totals?.office ?? 0) !== 0
  const showPayroll = canSeePayroll && (totals?.payroll ?? 0) !== 0
  const showOther = !narrow
  const columnCount = 6 + (showOther ? 1 : 0) + (showOffice ? 1 : 0) + (showPayroll ? 1 : 0)

  const cardLabel = (l: SpendingLooseCharge) =>
    l.cardNickname ?? (l.debitCardId ? nicknameByDebitCard[l.debitCardId] ?? `card ${formatMercuryDebitCardIdCompact(l.debitCardId)}` : 'no card on file')

  const whoCannotSort = (l: SpendingLooseCharge) =>
    l.beforeSortingBegan
      ? `Bought before sorting began on ${data?.sortingFloorYmd ? ymdLabel(data.sortingFloorYmd) : 'the start date'}.`
      : `A dev or someone who works with ${l.holderName ?? 'the card holder'} can put this on a job.`

  function valueCells(r: { cardSpend: number; fuel: number; onJobs: number; office: number; payroll: number; notOnJob: number; jobs: number | string }) {
    return (
      <>
        <td style={td}>{usd(r.cardSpend)}</td>
        <td style={{ ...td, color: r.fuel !== 0 ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>{usd(r.fuel)}</td>
        {showOther && <td style={td}>{usd(r.cardSpend - r.fuel)}</td>}
        <td style={td}>{usd(r.onJobs)}</td>
        {showOffice && <td style={td}>{r.office !== 0 ? usd(r.office) : ''}</td>}
        {showPayroll && <td style={td}>{r.payroll !== 0 ? usd(r.payroll) : ''}</td>}
        <td style={{ ...td, color: r.notOnJob !== 0 ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: r.notOnJob !== 0 ? 600 : 400 }}>
          {r.notOnJob !== 0 ? usd(r.notOnJob) : '—'}
        </td>
        <td style={td}>{r.jobs}</td>
      </>
    )
  }

  function subRow(key: string, label: ReactNode, cells: { cardSpend: number; fuel: number; onJobs: number; office?: number; payroll?: number; notOnJob?: number }) {
    return (
      <tr key={key} style={{ fontSize: '0.8rem', background: 'var(--bg-subtle)' }}>
        <td style={{ ...firstCell, paddingLeft: '1.9rem' }}>{label}</td>
        {valueCells({ office: 0, payroll: 0, notOnJob: 0, ...cells, jobs: '' })}
      </tr>
    )
  }

  function personRows(r: SpendingRow) {
    const open = openKey === r.who.key
    const looseNow = r.looseCharges.filter((l) => !l.beforeSortingBegan)
    const looseBefore = r.looseCharges.filter((l) => l.beforeSortingBegan)
    const looseFuel = looseNow.filter((l) => l.fuel).reduce((s, l) => s + l.notOnJobUsd, 0)
    const chargesOpen = chargesOpenKey === r.who.key
    const rows: ReactNode[] = [
      <tr key={r.who.key} style={{ background: open ? 'var(--bg-blue-tint)' : undefined }}>
        <td style={{ ...firstCell, fontWeight: 600 }}>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Hide ${r.who.name}` : `Show ${r.who.name}`}
            onClick={() => setOpenKey(open ? null : r.who.key)}
            style={{ ...linkButtonStyle, color: 'var(--text-muted)', width: '1.1rem' }}
          >
            {open ? '▾' : '▸'}
          </button>
          {r.who.kind === 'person' ? (
            <PersonNameDoor name={r.who.name} userId={r.who.userId} personId={r.who.personId} />
          ) : (
            <span>{r.who.name}</span>
          )}
        </td>
        {valueCells({ cardSpend: r.cardSpend, fuel: r.fuel, onJobs: r.onJobs, office: r.office.usd, payroll: r.payroll.usd, notOnJob: r.notOnJob, jobs: r.jobs.length || '—' })}
      </tr>,
    ]
    if (!open) return rows
    for (const j of r.jobs) {
      rows.push(
        subRow(
          `${r.who.key}:${j.jobId}`,
          <button type="button" style={linkButtonStyle} onClick={() => jobDetail?.openJobDetail({ jobId: j.jobId })} title="Open the job">
            {jobLabel(j.job)}
          </button>,
          { cardSpend: j.spend, fuel: j.fuel, onJobs: j.spend },
        ),
      )
    }
    if (r.onSupplyInvoices.charges > 0) {
      rows.push(subRow(`${r.who.key}:invoices`, `On supply invoices, ${plural(r.onSupplyInvoices.charges, 'charge')}`, { cardSpend: r.onSupplyInvoices.usd, fuel: r.onSupplyInvoices.fuel, onJobs: r.onSupplyInvoices.usd }))
    }
    if (r.office.charges > 0) {
      rows.push(subRow(`${r.who.key}:office`, `Office, ${plural(r.office.charges, 'charge')}`, { cardSpend: r.office.usd, fuel: r.office.fuel, onJobs: 0, office: r.office.usd }))
    }
    if (canSeePayroll && r.payroll.charges > 0) {
      rows.push(subRow(`${r.who.key}:payroll`, `Payroll, ${plural(r.payroll.charges, 'charge')}`, { cardSpend: r.payroll.usd, fuel: r.payroll.fuel, onJobs: 0, payroll: r.payroll.usd }))
    }
    if (looseNow.length > 0) {
      rows.push(
        <tr key={`${r.who.key}:loose`} style={{ fontSize: '0.8rem', background: 'var(--bg-subtle)' }}>
          <td style={{ ...firstCell, paddingLeft: '1.9rem' }}>
            Not on a job yet, {plural(looseNow.length, 'charge')}{' '}
            <button type="button" style={{ ...smallButtonStyle, marginLeft: '0.4rem' }} aria-expanded={chargesOpen} onClick={() => setChargesOpenKey(chargesOpen ? null : r.who.key)}>
              {chargesOpen ? 'Hide the charges' : 'See the charges'}
            </button>
          </td>
          {valueCells({ cardSpend: r.notOnJob, fuel: looseFuel, onJobs: 0, office: 0, payroll: 0, notOnJob: r.notOnJob, jobs: '' })}
        </tr>,
      )
    }
    if (looseBefore.length > 0) {
      rows.push(subRow(`${r.who.key}:before`, `Before sorting began, ${plural(looseBefore.length, 'charge')}`, { cardSpend: r.beforeSorting.usd, fuel: r.beforeSorting.fuel, onJobs: 0, notOnJob: 0 }))
    }
    if (r.byCardCharges > 0) {
      rows.push(
        <tr key={`${r.who.key}:bycard`}>
          <td colSpan={columnCount} style={{ ...firstCell, paddingLeft: '1.9rem', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'normal' }}>
            {plural(r.byCardCharges, 'charge')} {r.byCardCharges === 1 ? 'counts' : 'count'} here because the card is theirs. Nobody has put a person on {r.byCardCharges === 1 ? 'it' : 'them'} in Banking.
          </td>
        </tr>,
      )
    }
    if (chargesOpen) {
      rows.push(
        <tr key={`${r.who.key}:list`}>
          <td colSpan={columnCount} style={{ ...firstCell, padding: '0.3rem 0.5rem 0.6rem 1.9rem', whiteSpace: 'normal' }}>
            <ul aria-label={`${r.who.name}: charges not on a job yet`} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}>
              {[...looseNow, ...looseBefore].map((l) => (
                <li key={l.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '3.2rem' }}>{dayFmt.format(new Date(l.postedAt))}</span>
                  <span style={{ fontWeight: 600 }}>{l.counterpartyName ?? 'Unknown store'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{cardLabel(l)}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(l.notOnJobUsd)}</span>
                  {l.fuel && <span title="Fuel">⛽</span>}
                  {l.canSort ? (
                    <button type="button" style={smallButtonStyle} disabled={opening === l.id} onClick={() => void openAssign(l)}>
                      {opening === l.id ? 'Opening…' : 'Put on a job'}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{whoCannotSort(l)}</span>
                  )}
                </li>
              ))}
            </ul>
          </td>
        </tr>,
      )
    }
    return rows
  }

  return (
    <div style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center' }}>
        <span role="group" aria-label="Period" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {SPENDING_PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} style={pillStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </span>
        {period === 'custom' && (
          <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
            <input type="date" aria-label="From" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} />
            <span>to</span>
            <input type="date" aria-label="To" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} />
          </span>
        )}
        <b style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          {ymdLabel(range.start)} to {ymdLabel(range.end)}
        </b>
      </div>
      {range.shortened && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>This shows the last 366 days of your range. Pick a shorter range to see its start.</p>}
      {!canSeePayroll && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Card charges settled through payroll are not shown to you. Someone with payroll access sees them in a Payroll column.
        </p>
      )}

      {state.kind === 'loading' && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading the card charges…</p>}
      {state.kind === 'not_live' && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This is not live in the database yet. The change still has to be pushed.</p>
      )}
      {state.kind === 'error' && (
        <p style={{ color: 'var(--text-red-600)', fontSize: '0.85rem' }}>
          Could not load the card charges. {state.message}{' '}
          <button type="button" style={linkButtonStyle} onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      {data && totals && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }} aria-label="Totals">
            <Tile k="Card spend" v={usd(totals.cardSpend)} s={plural(totals.charges, 'charge')} />
            <Tile k="⛽ Fuel" v={usd(totals.fuel)} s={`${pct(totals.fuel, totals.cardSpend)} of card spend`} />
            <Tile k="On jobs" v={usd(totals.onJobs)} s={pct(totals.onJobs, totals.cardSpend)} />
            <Tile
              k="Not on a job yet"
              v={usd(totals.notOnJob)}
              s={totals.notOnJobCharges > 0 ? `${plural(totals.notOnJobCharges, 'charge')}, ${usd(totals.notOnJobFuel)} of it fuel` : 'Everything is on a job'}
              warn={totals.notOnJobCharges > 0}
            />
            <Tile k="Not tied to anyone" v={usd(totals.untied.usd)} s={plural(totals.untied.charges, 'charge')} />
          </div>

          {data.rows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No card charges in this period.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table aria-label="Card spend by person" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Who</th>
                    <th style={th}>Card spend</th>
                    <th style={th}>⛽ Fuel</th>
                    {showOther && <th style={th}>Other</th>}
                    <th style={th}>On jobs</th>
                    {showOffice && <th style={th}>Office</th>}
                    {showPayroll && <th style={th}>Payroll</th>}
                    <th style={th}>Not on a job</th>
                    <th style={th}>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.flatMap(personRows)}
                  <tr style={{ fontWeight: 700, background: 'var(--bg-subtle)' }}>
                    <td style={{ ...firstCell, borderTop: '2px solid var(--border-strong)' }}>Everyone</td>
                    {valueCells({
                      cardSpend: totals.cardSpend,
                      fuel: totals.fuel,
                      onJobs: totals.onJobs,
                      office: totals.office,
                      payroll: totals.payroll,
                      notOnJob: totals.notOnJob,
                      jobs: totals.jobs || '—',
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Press the arrow beside a name to see their jobs and what is not on a job yet. Refunds come off. Money moved between our own accounts is not spend.
          </p>
        </>
      )}

      {assign && (
        <MercuryTransactionAllocationsModal
          open
          onClose={() => setAssign(null)}
          transaction={assign.tx}
          initialAllocations={assign.splits}
          initialPersonId={null}
          initialUserId={null}
          jobLabelById={assign.jobLabelById}
          usersOptions={usersOptions ?? []}
          nicknameByDebitCard={nicknameByDebitCard}
          nicknameByAccount={nicknameByAccount}
          recentPersonPicksStorageKey={null}
          tallySelfService={assign.loose.sortMode === 'holder'}
          tallyActAsUserId={assign.loose.sortMode === 'holder' ? assign.loose.holderUserId : null}
          tallyActAsDisplayName={assign.loose.sortMode === 'holder' ? assign.loose.holderName : null}
          onSaved={() => {
            setAssign(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
