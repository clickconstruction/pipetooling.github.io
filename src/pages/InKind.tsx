/**
 * In kind (punch list #301, PR 4): every arrangement in one list. One row a partner: what is given, how far along,
 * what is left and which way, and what is next. A row opens the deal on its customer's page, where the ledger, Add a
 * line and a month's credit live. The office only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isOfficeRole } from '../lib/doorRoles'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { EmptyState } from '../components/EmptyState'
import { isMonthlyArrangement } from '../lib/inKind/inKindLedger'
import { monthsWithBank, type BankPaidLine } from '../lib/inKind/inKindBank'
import { loadAllInKind, loadInKindBankLines, searchInKindCustomers, type InKindLedgerData } from '../lib/inKind/inKindIo'
import { inKindLeftWords, inKindListRows, inKindListTotals, inKindRowHref, inKindSoFarWords, type InKindListRow } from '../lib/inKind/inKindList'
import { IN_KIND_OPEN_LEDGER, IN_KIND_SET_UP, monthOpenPress, usd } from '../lib/inKind/inKindWords'
import { bluePress, cardBox, fieldBox, fieldLabel, linePress, meterParts, pill, quietPress, redText, statBox, statKey, statSub, statValue } from '../components/inKind/inKindStyles'

export interface InKindPageIo {
  load: () => Promise<InKindLedgerData[]>
  loadBank: (payee: string, firstMonth: string) => Promise<BankPaidLine[]>
  searchCustomers: (text: string) => Promise<Array<{ id: string; name: string }>>
}
const REAL_IO: InKindPageIo = { load: loadAllInKind, loadBank: loadInKindBankLines, searchCustomers: searchInKindCustomers }

export default function InKind({ io = REAL_IO }: { io?: InKindPageIo }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [deals, setDeals] = useState<InKindLedgerData[] | null>(null)
  const [bank, setBank] = useState<Map<string, BankPaidLine[] | null>>(new Map())
  const [failed, setFailed] = useState<string | null>(null)
  const [showEnded, setShowEnded] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<Array<{ id: string; name: string }>>([])
  const [searchFailed, setSearchFailed] = useState<string | null>(null)
  const office = isOfficeRole(role)

  const load = useCallback(async () => {
    try {
      const rows = await io.load()
      const read = new Map<string, BankPaidLine[] | null>()
      await Promise.all(
        rows.map(async (d) => {
          const a = d.arrangement
          if (a.ended_at || !isMonthlyArrangement(a) || !a.starts_on || !a.bank_payee.trim()) return
          try {
            read.set(a.id, await io.loadBank(a.bank_payee, a.starts_on))
          } catch {
            read.set(a.id, null)
          }
        }),
      )
      setBank(read)
      setDeals(rows)
      setFailed(null)
    } catch (e) {
      setFailed(formatErrorMessage(e, 'The arrangements could not be read.'))
    }
  }, [io])

  useEffect(() => {
    if (office) void load()
  }, [office, load])

  useEffect(() => {
    if (!settingUp || search.trim().length < 2) {
      setFound([])
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      io.searchCustomers(search)
        .then((rows) => {
          if (!live) return
          setFound(rows)
          setSearchFailed(null)
        })
        .catch((e: unknown) => {
          if (!live) return
          setFound([])
          setSearchFailed(formatErrorMessage(e, 'The customers could not be searched.'))
        })
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [settingUp, search, io])

  const todayYmd = todayYmdInAppTz()
  const rows = useMemo(() => {
    if (!deals) return []
    const monthsById = new Map(deals.map((d) => [d.arrangement.id, monthsWithBank(d.arrangement, d.lines, bank.get(d.arrangement.id), todayYmd)]))
    return inKindListRows(deals, monthsById)
  }, [deals, bank, todayYmd])
  const totals = useMemo(() => inKindListTotals(deals ?? [], rows), [deals, rows])

  if (role == null) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!office) return <Navigate to="/dashboard" replace />

  const open = rows.filter((r) => !r.ended)
  const ended = rows.filter((r) => r.ended)

  const rowCard = (r: InKindListRow) => {
    const href = inKindRowHref(r)
    const { paidPct } = meterParts(r.paidInKind, r.work)
    const leftWords = inKindLeftWords(r)
    return (
      <div key={r.id} data-testid="in-kind-row" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '11px 14px', borderBottom: '1px solid var(--border)', opacity: r.ended ? 0.7 : 1 }}>
        <div style={{ flex: '2 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {r.customerId ? (
              <Link to={`/customers/${r.customerId}`} style={{ fontWeight: 700, color: 'var(--text-strong)', textDecoration: 'none' }}>
                {r.partner}
              </Link>
            ) : (
              <b style={{ color: 'var(--text-strong)' }}>{r.partner}</b>
            )}
            <span style={pill(r.ended ? 'grey' : r.kind === 'Every month' ? 'blue' : 'grey')}>{r.kind}</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.whatGiven}</div>
        </div>
        <div style={{ flex: '2 1 200px', minWidth: 0 }}>
          {r.work > 0.005 ? (
            <div role="img" aria-label={inKindSoFarWords(r)} style={{ height: 8, borderRadius: 9999, background: 'var(--bg-muted)', overflow: 'hidden', marginBottom: 3 }}>
              <div style={{ width: `${paidPct}%`, height: '100%', background: '#16a34a' }} />
            </div>
          ) : null}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{inKindSoFarWords(r)}</div>
        </div>
        <div style={{ flex: '1 1 110px', textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{leftWords.amount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{leftWords.words}</div>
        </div>
        <div style={{ flex: '2 1 240px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <span style={r.dueMonth ? { ...pill('amber'), whiteSpace: 'normal' } : { fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.next}</span>
          {href ? (
            <button type="button" onClick={() => navigate(href)} style={r.dueMonth ? bluePress() : linePress}>
              {r.dueMonth ? monthOpenPress(r.dueMonth) : IN_KIND_OPEN_LEDGER}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-strong)' }}>In kind</h1>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Work paid with something other than money.</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12, fontSize: '0.875rem' }}>
          <Link to="/accounts-receivable" style={{ color: 'var(--text-link)' }}>
            Accounts Receivable
          </Link>
          <Link to="/help/keep-track-of-work-paid-in-kind" style={{ color: 'var(--text-link)' }}>
            How it works
          </Link>
        </span>
      </div>

      {failed ? (
        <div style={cardBox} role="alert">
          <span style={redText}>{failed}</span>
          <button type="button" onClick={() => void load()} style={{ ...quietPress, alignSelf: 'flex-start' }}>
            Read it again
          </button>
        </div>
      ) : deals == null ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Reading the arrangements…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={statBox}>
              <span style={statKey}>Still to come</span>
              <span style={statValue}>{usd(totals.left)}</span>
              <span style={statSub}>{totals.open === 0 ? 'nothing is open' : `${totals.open === 1 ? 'on 1 arrangement' : `on ${totals.open} arrangements`}, none chased as late`}</span>
            </div>
            <div style={statBox}>
              <span style={statKey}>Given so far, as overhead</span>
              <span style={statValue}>{usd(totals.asOverhead)}</span>
              <span style={statSub}>and {usd(totals.onJobs)} on jobs</span>
            </div>
            <div style={statBox}>
              <span style={statKey}>Work we owe</span>
              <span style={statValue}>{usd(totals.ahead)}</span>
              <span style={statSub}>given ahead of any bill</span>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <b style={{ color: 'var(--text-strong)' }}>{totals.open} open</b>
                {totals.dueCount > 0 ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}> · {totals.dueCount === 1 ? '1 has a credit due' : `${totals.dueCount} have a credit due`}</span> : null}
              </div>
              <button type="button" onClick={() => setSettingUp((v) => !v)} style={bluePress()} data-testid="in-kind-page-set-up">
                {IN_KIND_SET_UP}
              </button>
            </div>
            {settingUp ? (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <label htmlFor="in-kind-page-customer" style={fieldLabel}>
                  Which customer pays in kind? Type their name.
                </label>
                <input id="in-kind-page-customer" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...fieldBox, maxWidth: 420 }} />
                {searchFailed ? <div style={{ ...redText, marginTop: 4 }}>{searchFailed}</div> : null}
                {found.map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate(`/customers/${c.id}?inKindNew=1`)} style={{ ...linePress, display: 'block', marginTop: 6 }}>
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
            {open.length === 0 ? (
              <EmptyState compact main="Nobody pays in kind yet." next={{ label: IN_KIND_SET_UP, onPress: () => setSettingUp(true) }} tail="to add the first one." />
            ) : (
              open.map(rowCard)
            )}
            {ended.length > 0 ? (
              <div style={{ padding: '8px 14px' }}>
                <button type="button" onClick={() => setShowEnded((v) => !v)} style={quietPress} aria-expanded={showEnded}>
                  {showEnded ? 'Hide' : 'Show'} {ended.length} ended
                </button>
              </div>
            ) : null}
            {showEnded ? ended.map(rowCard) : null}
          </div>
        </>
      )}
    </div>
  )
}
