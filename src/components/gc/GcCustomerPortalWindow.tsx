import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { customerReadinessIn } from '../../lib/portal/customerPage'
import { activePortalToken, loadPortalPreview, makePortalLink } from '../../lib/portal/customerPortalPreviewIo'
import { formatPortalUsd, type PortalPayload } from '../../lib/portal/portalPayload'
import { portalReady, readyTitle, type ReadyFix } from '../../lib/portal/readiness'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PortalGcPage } from '../portal/PortalGcPage'
import { Btn } from './gcUi'

/**
 * Messages, cut 8d: the customer's portal window (the prototype's `portalPage` and `portalSideHtml`, v1.164). The
 * office sees the customer's page on a GC job as the customer sees it, read from their own portal as a staff look,
 * with every press sending nothing (`PortalGcPage`'s `office`). Beside it: *Show where each piece comes from*, which
 * tags each card with the page that feeds it, and *Ready for <name>?*, one row per piece with a fix or change press
 * (`portalReady` over `customerReadinessIn`). A tag or a press goes to that page through `onFix`. A customer with no
 * live link gets one only when the office presses *Make their link*.
 */

type Phase = { kind: 'loading' } | { kind: 'noLink' } | { kind: 'error'; text: string } | { kind: 'ready'; token: string; payload: PortalPayload }

const MUTED: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }

/** What we call them on the panel: their contact's first name, else the first word of their name. */
function portalFirstName(customer: { name: string; contact?: string | null }): string {
  const from = (customer.contact ?? '').trim() || customer.name.trim()
  return from.split(/\s+/)[0] || 'them'
}

export function GcCustomerPortalWindow({
  customer,
  onFix,
  onClose,
}: {
  customer: { id: string; name: string; contact?: string | null }
  /** Where a tag or a fix press goes: the page that feeds that piece of the job. */
  onFix: (fix: ReadyFix, projectId: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [jobId, setJobId] = useState<string | null>(null)
  const [sources, setSources] = useState(false)
  const [making, setMaking] = useState(false)
  const first = portalFirstName(customer)

  const load = useCallback(async (token: string | null) => {
    setPhase({ kind: 'loading' })
    try {
      const t = token ?? (await activePortalToken(customer.id))
      if (!t) {
        setPhase({ kind: 'noLink' })
        return
      }
      setPhase({ kind: 'ready', token: t, payload: await loadPortalPreview(t) })
    } catch (e) {
      setPhase({ kind: 'error', text: formatErrorMessage(e, 'Their page did not open.') })
    }
  }, [customer.id])

  useEffect(() => {
    void load(null)
  }, [load])

  const make = async () => {
    setMaking(true)
    try {
      await load(await makePortalLink(customer.id))
    } catch (e) {
      setPhase({ kind: 'error', text: formatErrorMessage(e, 'Their link was not made.') })
    } finally {
      setMaking(false)
    }
  }

  const jobs = phase.kind === 'ready' ? phase.payload.gcJobs.filter((j) => j.page) : []
  const job = jobs.find((j) => j.projectId === jobId) ?? jobs[0] ?? null
  const rows = useMemo(() => {
    if (phase.kind !== 'ready' || !job?.page) return []
    return portalReady(customerReadinessIn({ firstName: first, job, page: job.page, bills: phase.payload.bills, company: phase.payload.company.name, today: todayYmdInAppTz() }))
  }, [phase, job, first])
  const ready = readyTitle(first, rows)

  return createPortal(
    <div
      // A portal's events still reach the customer window's backdrop: this window's own close stops here.
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${customer.name}’s portal`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1040px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <strong style={{ fontSize: '1.05rem' }}>{`Customer’s portal · ${customer.name}`}</strong>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
              ×
            </button>
          </div>
          <div style={MUTED}>
            {`What ${first} sees on a GC job: a home with their move, this week and who to call, then Money, Schedule and Papers. Nothing of ours shows. Presses here send nothing.`}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.9rem 1rem' }}>
          {phase.kind === 'loading' ? (
            <p style={MUTED}>Opening their page…</p>
          ) : phase.kind === 'noLink' ? (
            <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
              <p style={{ margin: 0 }}>{`${customer.name} has no portal link yet. Our contract’s email makes one, or make it here.`}</p>
              <Btn kind="primary" disabled={making} onClick={() => void make()}>
                {making ? 'Making it…' : 'Make their link'}
              </Btn>
            </div>
          ) : phase.kind === 'error' ? (
            <div role="alert" style={{ display: 'grid', gap: '0.5rem', justifyItems: 'start' }}>
              <p style={{ margin: 0 }}>{phase.text}</p>
              <Btn onClick={() => void load(null)}>Try again</Btn>
            </div>
          ) : !job?.page ? (
            <p style={MUTED}>{`${first}’s portal has no GC job page yet. A job shows there once we win it.`}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1rem', alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {jobs.length > 1 && (
                  <label style={{ display: 'grid', gap: '0.2rem', ...MUTED }}>
                    Job
                    <select value={job.projectId} onChange={(e) => setJobId(e.target.value)} style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }}>
                      {jobs.map((j) => (
                        <option key={j.projectId} value={j.projectId}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div data-theme="light" style={{ maxWidth: 460 }}>
                  <PortalGcPage
                    key={job.projectId}
                    token={phase.token}
                    job={job}
                    page={job.page}
                    payload={phase.payload}
                    formatUsd={formatPortalUsd}
                    office={{ sources, onSource: (fix) => onFix(fix, job.projectId) }}
                  />
                </div>
              </div>
              <aside aria-label={ready.title} style={{ display: 'grid', gap: '0.6rem', alignContent: 'start' }}>
                <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={sources} onChange={(e) => setSources(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Show where each piece comes from
                </label>
                <div style={MUTED}>With it on, every card carries a tag. A press on the tag takes you to the page that feeds it.</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  <strong>{ready.title}</strong>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: ready.good ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>{ready.state}</span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' }}>
                  {rows.map((r) => (
                    <li key={r.piece} data-ready={r.piece} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <span aria-hidden style={{ flex: 'none', width: 18, textAlign: 'center', fontWeight: 700, color: r.ok ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>
                        {r.ok ? '✓' : '!'}
                      </span>
                      <div style={{ display: 'grid', gap: '0.1rem', fontSize: '0.85rem' }}>
                        <span>
                          <b>{r.piece}</b> {r.words}
                        </span>
                        <span style={MUTED}>
                          {`from ${r.from} · `}
                          <button
                            type="button"
                            onClick={() => onFix(r.fix, job.projectId)}
                            style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                          >
                            {r.ok ? 'change ›' : 'fix ›'}
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div style={MUTED}>
                  What the list checks: something to do, this week’s line and its photos, what each bill covers, the change orders, the schedule, people to call, and Spanish. It
                  never checks our numbers. Those come from the ledger.
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
