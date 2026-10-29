/**
 * Hours statements (punch list #212, PR 2, v2.6097): the section on the job window's Documents tab and under the
 * person's desk Hours. Every statement on the job (or for the person) with its record id, its period, its kind, where
 * it stands and who saved it, each with **Print** (the paper again from its snapshot, with its record id) and **Open**
 * (the window on it); and the press **Hours statement…** with its count — the people who clocked on the job, or the
 * jobs the person clocked on — dead when there is no one to make a statement for. An empty section names the press.
 * Shown to whoever may make one (`canMakeHoursStatement`: the payroll roles, and an assistant for the hours-only paper).
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { canMakeHoursStatement } from '../../lib/people/hoursStatementAccess'
import { hoursStatementJobNumber, listHoursStatementJobs, listHoursStatementPeople } from '../../lib/people/hoursStatementRead'
import { listHoursStatementsForJob, listHoursStatementsForUser, type HoursStatementRecordRow } from '../../lib/people/hoursStatementsIo'
import { buildHoursStatementPaper, printHoursStatementPaper } from '../../lib/people/hoursStatementPrint'
import { hoursStatementEmptyWords, hoursStatementPressWords, hoursStatementRowWords } from '../../lib/people/hoursStatementWindow'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { EmptyState } from '../EmptyState'
import { documentsChip, documentsHeading, documentsQuietButton, documentsTd, documentsTh } from './jobDocumentsStyles'
import { HoursStatementModal, type HoursStatementScope } from './HoursStatementModal'

export type HoursStatementsSectionScope =
  | { kind: 'job'; job: { id: string; hcp_number: string | null; click_number: string | null; job_name: string; job_address: string; customer_name: string | null } }
  | { kind: 'person'; userId: string; name: string }

const chipTone: Record<'grey' | 'blue' | 'amber' | 'green', CSSProperties> = {
  grey: { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  blue: { background: 'var(--bg-blue-tint, var(--bg-subtle))', color: 'var(--text-blue-700)' },
  amber: { background: 'var(--bg-amber-tint, var(--bg-subtle))', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-tint, var(--bg-subtle))', color: 'var(--text-green-800)' },
}

export function HoursStatementsSection({
  scope,
  zIndex = 1030,
  onOverlayOpenChange,
  canAccessPay: canAccessPayGiven,
  desk = false,
}: {
  scope: HoursStatementsSectionScope
  /** The window's layer: above the job window by default; the desk passes its editor layer. */
  zIndex?: number
  onOverlayOpenChange?: (open: boolean) => void
  /** The viewer's pay access when the opener already knows it (the desk); else read here. */
  canAccessPay?: boolean
  /** Drawn inside a desk section: a lighter heading. */
  desk?: boolean
}) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const access = usePeopleAccess(canAccessPayGiven == null ? user?.id : undefined)
  const maker = { role, canAccessPay: canAccessPayGiven ?? access.canAccessPay }
  const [rows, setRows] = useState<HoursStatementRecordRow[] | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState<HoursStatementRecordRow | null>(null)
  const allowed = canMakeHoursStatement(maker)
  const scopeKey = scope.kind === 'job' ? `job:${scope.job.id}` : `person:${scope.userId}`

  const reload = useCallback(() => {
    let cancelled = false
    if (!allowed) return () => undefined
    void (async () => {
      try {
        const [list, who] = await Promise.all([
          scope.kind === 'job' ? listHoursStatementsForJob(scope.job.id) : listHoursStatementsForUser(scope.userId),
          scope.kind === 'job' ? listHoursStatementPeople(scope.job.id).then((p) => p.length) : listHoursStatementJobs(scope.userId).then((j) => j.length),
        ])
        if (cancelled) return
        setRows(list)
        setCount(who)
        setError(null)
      } catch (e: unknown) {
        if (cancelled) return
        setRows([])
        setError(formatErrorMessage(e, 'The hours statements could not be read.'))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the scope's key stands for the scope
  }, [scopeKey, allowed])

  useEffect(() => reload(), [reload])

  if (!allowed) return null

  const press = hoursStatementPressWords(count, scope.kind)
  const empty = hoursStatementEmptyWords(count, scope.kind === 'job' ? { kind: 'job' } : { kind: 'person', name: scope.name })
  const openWindow = (on: HoursStatementRecordRow | null) => {
    setOpening(on)
    setOpen(true)
    onOverlayOpenChange?.(true)
  }
  const closeWindow = () => {
    setOpen(false)
    setOpening(null)
    onOverlayOpenChange?.(false)
    reload()
  }
  const printRow = (r: HoursStatementRecordRow) => {
    const snap = r.snapshot
    if (!snap) {
      showToast('This statement kept no snapshot, so it cannot be printed again. Open it and print from there.', 'error')
      return
    }
    void printHoursStatementPaper(() => Promise.resolve(buildHoursStatementPaper(snap, r.record_id))).then((ok) => {
      if (!ok) showToast('The print window was blocked. Allow pop-ups for this site and press Print again.', 'error')
    })
  }
  const modalScope: HoursStatementScope =
    scope.kind === 'job'
      ? { kind: 'job', job: { id: scope.job.id, number: hoursStatementJobNumber(scope.job), name: scope.job.job_name, customer: scope.job.customer_name, site: scope.job.job_address } }
      : { kind: 'person', userId: scope.userId, name: scope.name }

  const pressButton = (
    <button
      type="button"
      onClick={() => openWindow(null)}
      disabled={press.dead}
      title={press.dead && count != null ? empty.main : undefined}
      style={press.dead ? { ...documentsQuietButton, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'transparent', cursor: 'not-allowed' } : documentsQuietButton}
    >
      {count == null && rows == null ? 'Reading…' : press.label}
    </button>
  )

  const list =
    rows == null ? (
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
    ) : rows.length === 0 ? (
      <EmptyState compact main={empty.main} {...(empty.withPress ? { next: { label: press.label, onPress: () => openWindow(null) }, tail: empty.tail } : {})} />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={documentsTh}>Record</th>
              <th style={documentsTh}>{scope.kind === 'job' ? 'Worker' : 'Job'}</th>
              <th style={documentsTh}>Period</th>
              <th style={documentsTh}>Saved</th>
              <th style={documentsTh} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const jobLabel = r.job ? `${(r.job.hcp_number ?? '').trim() || (r.job.click_number ?? '').trim() || r.job_ledger_id.slice(0, 8)} · ${r.job.job_name ?? ''}` : r.snapshot ? `${r.snapshot.job.number} · ${r.snapshot.job.name}` : r.job_ledger_id.slice(0, 8)
              const words = hoursStatementRowWords({
                recordId: r.record_id,
                workerName: r.worker?.name ?? r.snapshot?.worker.name ?? 'Worker',
                jobLabel,
                periodStart: r.period_start,
                periodEnd: r.period_end,
                withPay: r.with_pay,
                state: r.state,
                preparedAtYmd: calendarYmdInAppTzFromIso(r.prepared_at),
                preparedByName: r.prepared_by_user?.name ?? null,
              })
              return (
                <tr key={r.id} data-testid="hours-statement-row">
                  <td style={{ ...documentsTd, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {words.record}
                    <span style={{ ...documentsChip, ...chipTone[words.state.tone] }}>{words.state.label}</span>
                  </td>
                  <td style={documentsTd}>{scope.kind === 'job' ? r.worker?.name ?? r.snapshot?.worker.name ?? 'Worker' : jobLabel}</td>
                  <td style={{ ...documentsTd, whiteSpace: 'nowrap' }}>
                    {words.period}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{words.kind}</span>
                  </td>
                  <td style={{ ...documentsTd, fontSize: '0.8125rem', color: 'var(--text-600)' }}>{words.saved}</td>
                  <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" style={documentsQuietButton} onClick={() => printRow(r)} aria-label={`Print ${r.record_id}`}>
                      Print
                    </button>{' '}
                    <button type="button" style={documentsQuietButton} onClick={() => openWindow(r)} aria-label={`Open ${r.record_id}`}>
                      Open
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )

  return (
    <section aria-labelledby={`hours-statements-${scope.kind}`} style={desk ? { display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0.7rem' } : { display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 id={`hours-statements-${scope.kind}`} style={desk ? { ...documentsHeading, fontSize: '0.8125rem', flex: 1 } : { ...documentsHeading, flex: 1 }}>
          Hours statements
        </h3>
        {pressButton}
      </div>
      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p> : null}
      {list}
      {open ? <HoursStatementModal open scope={modalScope} maker={maker} existing={opening} zIndex={zIndex} onClose={closeWindow} /> : null}
    </section>
  )
}

export default HoursStatementsSection
