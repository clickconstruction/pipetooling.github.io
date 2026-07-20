import { useCallback, useState, type ReactNode } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchMercuryReconciliation } from '../../lib/fetchMercuryReconciliation'
import {
  classifyCurrent,
  classifyMonth,
  formatSignedUsd,
  summarizeAccount,
  summarizeResult,
  type ReconAccount,
  type ReconMonth,
  type ReconResult,
} from '../../lib/mercuryReconciliation'

const MONTHS_OPTIONS = [3, 6, 12] as const

function StatusPill({ status, children }: { status: 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  const style =
    status === 'ok'
      ? { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' }
      : status === 'warn'
        ? { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' }
        : { bg: 'var(--bg-slate-100)', fg: 'var(--text-slate-500)' }
  return (
    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: style.bg, color: style.fg, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

function MonthRow({ m }: { m: ReconMonth }) {
  const [open, setOpen] = useState(false)
  const status = classifyMonth(m)
  const ok = status === 'ok'
  const canExpand = m.missingCount > 0
  return (
    <>
      <tr
        onClick={() => canExpand && setOpen((v) => !v)}
        style={{ borderTop: '1px solid var(--border)', cursor: canExpand ? 'pointer' : 'default' }}
      >
        <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap' }}>
          {canExpand ? <span style={{ color: 'var(--text-amber-800)', marginRight: 4 }}>{open ? '▼' : '▶'}</span> : null}
          {m.period}
        </td>
        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {m.presentCount}/{m.statementCount}
        </td>
        <td style={{ padding: '0.4rem 0.6rem' }}>
          <StatusPill status={ok ? 'ok' : 'warn'}>
            {status === 'ok' ? '✓ Reconciled' : `⚠ ${m.missingCount} missing`}
          </StatusPill>
        </td>
        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-slate-600)' }}>
          {formatSignedUsd(m.endingBalance)}
        </td>
        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.missingValue !== 0 ? 'var(--text-amber-700)' : 'var(--text-slate-400)' }}>
          {m.missingValue !== 0 ? formatSignedUsd(m.missingValue) : '—'}
        </td>
      </tr>
      {open && canExpand ? (
        <tr>
          <td colSpan={5} style={{ padding: '0.25rem 0.6rem 0.6rem 1.5rem', background: 'var(--bg-amber-tint)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)', marginBottom: 4 }}>
              Missing from your books ({m.missingCount.toLocaleString()}
              {m.missingCount > m.missingSample.length ? `, showing ${m.missingSample.length}` : ''}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {m.missingSample.map((t, i) => (
                <div key={t.id ?? i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem' }}>
                  <span style={{ minWidth: '5.5rem', color: 'var(--text-slate-500)' }}>{fmtDate(t.postedAt)}</span>
                  <span style={{ minWidth: '6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatSignedUsd(t.amount)}</span>
                  <span style={{ color: 'var(--text-slate-600)' }}>{t.counterpartyName ?? '—'}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function AccountCard({ a }: { a: ReconAccount }) {
  const summary = summarizeAccount(a)
  const cur = classifyCurrent(a.current)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
          {a.name}
          <StatusPill status={summary.status === 'ok' ? 'ok' : 'warn'}>
            {summary.status === 'ok' ? '✓ All reconciled' : `⚠ ${summary.totalMissing} missing`}
          </StatusPill>
        </div>
      </div>

      {/* Current (open-period) balance check */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.6rem', padding: '0.45rem 0.6rem', background: 'var(--bg-slate-tint)', borderRadius: 6 }}>
        <span>
          <span style={{ color: 'var(--text-slate-500)' }}>Mercury balance: </span>
          <strong>{formatSignedUsd(a.currentBalance)}</strong>
        </span>
        <span>
          <span style={{ color: 'var(--text-slate-500)' }}>Books imply: </span>
          {a.current.expectedCurrent === null ? '—' : <strong>{formatSignedUsd(a.current.expectedCurrent)}</strong>}
        </span>
        <span>
          <StatusPill status={cur === 'ok' ? 'ok' : 'muted'}>
            {cur === 'ok'
              ? '✓ Current balance matches'
              : cur === 'unknown'
                ? 'No statement yet'
                : `Open-month delta ${a.current.delta === null ? '' : formatSignedUsd(a.current.delta)}`}
          </StatusPill>
        </span>
      </div>
      {cur === 'drift' ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-slate-400)', marginTop: -2, marginBottom: '0.5rem' }}>
          The open (un-statemented) month hasn't settled — in-flight transfers between accounts commonly move this until month close. Closed months below are the reliable check.
        </div>
      ) : null}

      {a.months.length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-slate-400)' }}>No statements in this range.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-slate-500)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <th style={{ padding: '0.3rem 0.6rem', fontWeight: 600 }}>Statement</th>
              <th style={{ padding: '0.3rem 0.6rem', fontWeight: 600, textAlign: 'right' }}>Present</th>
              <th style={{ padding: '0.3rem 0.6rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.3rem 0.6rem', fontWeight: 600, textAlign: 'right' }}>Ending balance</th>
              <th style={{ padding: '0.3rem 0.6rem', fontWeight: 600, textAlign: 'right' }}>Missing $</th>
            </tr>
          </thead>
          <tbody>
            {a.months.map((m) => (
              <MonthRow key={m.period + (m.startDate ?? '')} m={m} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function BankingMercuryReconciliationTab() {
  const { showToast } = useToastContext()
  const [monthsBack, setMonthsBack] = useState<number>(6)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReconResult | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchMercuryReconciliation(monthsBack)
      setResult(r)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reconciliation failed', 'error')
    } finally {
      setLoading(false)
    }
  }, [monthsBack, showToast])

  const summary = result ? summarizeResult(result) : null

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Reconciliation</h2>
        <label style={{ fontSize: '0.82rem', color: 'var(--text-slate-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Window
          <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} disabled={loading} style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}>
            {MONTHS_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} months</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          style={{ padding: '0.45rem 1rem', fontWeight: 600, background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Reconciling…' : result ? 'Re-run' : 'Run reconciliation'}
        </button>
        {result ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)' }}>as of {new Date(result.generatedAt).toLocaleString()}</span>
        ) : null}
      </div>

      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-slate-500)' }}>
        Checks each account against its Mercury bank statements (by transaction, so timezones can't fake a gap)
        and against the live balance for the open month. Manually-entered transactions have no bank statement and
        aren't reconciled here.
      </p>

      {summary ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.6rem 0.9rem',
            borderRadius: 8,
            background: summary.accountsWithIssues === 0 ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
            border: `1px solid ${summary.accountsWithIssues === 0 ? 'var(--border-green)' : 'var(--border-amber-soft)'}`,
            fontSize: '0.9rem',
            fontWeight: 600,
            color: summary.accountsWithIssues === 0 ? 'var(--text-green-800)' : 'var(--text-amber-800)',
          }}
        >
          {summary.accountsWithIssues === 0
            ? `✓ All ${result!.accounts.length} accounts reconcile over the last ${result!.monthsBack} months.`
            : `⚠ ${summary.accountsWithIssues} account${summary.accountsWithIssues === 1 ? '' : 's'} need review · ${summary.totalMissing.toLocaleString()} transaction${summary.totalMissing === 1 ? '' : 's'} missing from the books.`}
        </div>
      ) : null}

      {loading && !result ? <div style={{ color: 'var(--text-slate-500)' }}>Fetching statements & balances from Mercury…</div> : null}
      {!loading && !result ? (
        <div style={{ color: 'var(--text-slate-500)', fontSize: '0.9rem' }}>Click “Run reconciliation” to compare your books against Mercury.</div>
      ) : null}

      {result?.accounts.map((a) => (
        <AccountCard key={a.id} a={a} />
      ))}
    </div>
  )
}
