/** Settings → Data & recovery → "ZZ test jobs (dev)" (v2.4157): the sweep that keeps live-pass
 * and twin residue off the Pipeline. Lists every job whose name or customer name starts with ZZ,
 * and sweeps the ones older than the chosen age into the sink (the ZZ job named "ZZ TEST sink")
 * through the existing, audited migrate-and-delete RPC (the row lands in Recently deleted). Rules and the
 * write order live in lib/jobs/zzTestJobSweep.ts; self-contained like the sibling sections —
 * the parent already gates the whole Data tab to `myRole === 'dev'`. */
import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { invalidateZzTestJobRows } from '../../lib/jobs/zzTestJobRows'
import {
  ZZ_SWEEP_DEFAULT_MIN_AGE_DAYS,
  ZZ_SWEEP_SINK_SUGGESTED_NAME,
  ZZ_TEST_JOBS_OR_FILTER,
  ZZ_TEST_JOBS_SELECT,
  planZzTestJobSweep,
  sweepZzTestJobIntoSink,
  zzSweepSummaryWords,
  type ZzJobRow,
  type ZzSweepRow,
} from '../../lib/jobs/zzTestJobSweep'

const cell: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }

export default function ZzTestJobSweepSection() {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<ZzJobRow[] | null>(null)
  const [minAgeDays, setMinAgeDays] = useState(ZZ_SWEEP_DEFAULT_MIN_AGE_DAYS)
  const [sweepingId, setSweepingId] = useState<string | null>(null)
  const [sweepAllArmed, setSweepAllArmed] = useState(false)
  const [sweepAllProgress, setSweepAllProgress] = useState<{ done: number; total: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setSweepAllArmed(false)
    try {
      const { data, error } = await supabase
        .from('jobs_ledger')
        .select(ZZ_TEST_JOBS_SELECT)
        .or(ZZ_TEST_JOBS_OR_FILTER)
        .order('created_at', { ascending: true })
      if (error) throw error
      setRows((data ?? []) as unknown as ZzJobRow[])
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Could not load ZZ test jobs'))
    } finally {
      setLoading(false)
    }
  }, [])

  const plan = rows ? planZzTestJobSweep(rows, { now: new Date(), minAgeDays }) : null

  async function sweepOne(row: ZzSweepRow, sinkId: string): Promise<boolean> {
    const result = await sweepZzTestJobIntoSink(supabase, row.id, sinkId)
    if (!result.ok) {
      showToast(`J${row.jobNumber} ${row.jobName}: ${result.error}`, 'error')
      return false
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev))
    // The swept job is gone: the shared ZZ ids the Dashboard drops by must be read again (v2.5120).
    invalidateZzTestJobRows()
    return true
  }

  async function sweep(row: ZzSweepRow) {
    if (sweepingId || sweepAllProgress || !plan?.sink) return
    setSweepingId(row.id)
    try {
      if (await sweepOne(row, plan.sink.id)) {
        showToast(`Swept J${row.jobNumber} ${row.jobName} into J${plan.sink.jobNumber}`, 'success')
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not sweep the job'), 'error')
    } finally {
      setSweepingId(null)
    }
  }

  async function sweepAll() {
    if (sweepingId || sweepAllProgress || !plan?.sink || plan.sweep.length === 0) return
    const sink = plan.sink
    const targets = plan.sweep
    setSweepAllArmed(false)
    setSweepAllProgress({ done: 0, total: targets.length })
    let swept = 0
    try {
      for (const row of targets) {
        // One at a time: the RPC locks both jobs, and a refusal on one row should not hide the rest.
        if (await sweepOne(row, sink.id)) swept += 1
        else break
        setSweepAllProgress({ done: swept, total: targets.length })
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not sweep the jobs'), 'error')
    } finally {
      setSweepAllProgress(null)
    }
    if (swept > 0) {
      showToast(
        swept === targets.length
          ? `Swept ${swept} ZZ test ${swept === 1 ? 'job' : 'jobs'} into J${sink.jobNumber}`
          : `Swept ${swept} of ${targets.length} into J${sink.jobNumber} — stopped at the first refusal`,
        swept === targets.length ? 'success' : 'info',
      )
    }
  }

  const busy = sweepingId !== null || sweepAllProgress !== null
  const listed = plan ? [...plan.sweep, ...plan.tooNew] : []

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev
            if (next && rows === null) void load()
            return next
          })
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        ZZ test jobs (dev)
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Jobs whose name or customer starts with <strong>ZZ</strong> — the residue of live passes and robot runs.
            Sweeping one zeroes its Job total, removes its Specific Work lines, then moves its costs, hours, notes and
            reports into the <strong>sink</strong> — the one ZZ job kept on purpose, named{' '}
            <strong>{ZZ_SWEEP_SINK_SUGGESTED_NAME}</strong> — and deletes it — the same door as Edit Job → Delete →{' '}
            <em>Reassign to another job…</em>, so the row lands in Recently deleted for 90 days. Rows newer than the age
            below stay: a live pass may still be using them.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || busy}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Checking…' : rows === null ? 'Check now' : 'Check again'}
            </button>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Older than
              <input
                id="zz-sweep-min-age-days"
                type="number"
                min={0}
                max={365}
                value={minAgeDays}
                disabled={busy}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setMinAgeDays(Number.isFinite(n) ? Math.max(0, Math.min(365, Math.floor(n))) : ZZ_SWEEP_DEFAULT_MIN_AGE_DAYS)
                  setSweepAllArmed(false)
                }}
                style={{ width: '4.5rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
              />
              days
            </label>
            {plan ? <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{zzSweepSummaryWords(plan, minAgeDays)}</span> : null}
          </div>
          {loadError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p> : null}
          {plan && plan.sweep.length > 0 && plan.sink ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {sweepAllProgress ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Sweeping {sweepAllProgress.done + 1} of {sweepAllProgress.total}…
                </span>
              ) : sweepAllArmed ? (
                <>
                  <span style={{ fontSize: '0.875rem' }}>
                    Sweep all {plan.sweep.length} into J{plan.sink.jobNumber}? Moving the costs cannot be reversed.
                  </span>
                  <button
                    type="button"
                    onClick={() => void sweepAll()}
                    disabled={busy}
                    style={{ padding: '0.35rem 0.8rem', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Yes, sweep {plan.sweep.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSweepAllArmed(false)}
                    style={{ padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSweepAllArmed(true)}
                  disabled={busy}
                  style={{ padding: '0.35rem 0.8rem', border: '1px solid #dc2626', color: 'var(--text-red-700)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  Sweep all {plan.sweep.length} into J{plan.sink.jobNumber}…
                </button>
              )}
            </div>
          ) : null}
          {plan && listed.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={cell}>Job</th>
                    <th style={cell}>Customer</th>
                    <th style={cell}>Status</th>
                    <th style={{ ...cell, textAlign: 'right' }}>Job total</th>
                    <th style={cell}>Age</th>
                    <th style={cell} />
                  </tr>
                </thead>
                <tbody>
                  {listed.map((r) => {
                    const tooNew = plan.tooNew.includes(r)
                    return (
                      <tr key={r.id} style={tooNew ? { color: 'var(--text-muted)' } : undefined}>
                        <td style={cell}>
                          <strong>{r.jobNumber}</strong> · {r.jobName}
                        </td>
                        <td style={cell}>{r.customerName}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.status.replace(/_/g, ' ')}</td>
                        <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          ${r.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                          {r.ageDays === null ? 'no date' : `${r.ageDays} ${r.ageDays === 1 ? 'day' : 'days'}`}
                          {tooNew ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>too new</span> : null}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          {tooNew || !plan.sink ? null : (
                            <button
                              type="button"
                              onClick={() => void sweep(r)}
                              disabled={busy}
                              style={{
                                padding: '0.3rem 0.75rem',
                                border: '1px solid #dc2626',
                                color: 'var(--text-red-700)',
                                background: 'var(--surface)',
                                borderRadius: 4,
                                cursor: busy ? 'wait' : 'pointer',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {sweepingId === r.id ? 'Sweeping…' : `Sweep into J${plan.sink.jobNumber}`}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
