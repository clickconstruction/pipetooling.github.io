import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { canMakeHoursStatement } from '../../lib/people/hoursStatementAccess'
import { hoursStatementJobNumber, listHoursStatementPeople } from '../../lib/people/hoursStatementRead'
import { openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { listChargeStatementsForJob, type ChargeStatementRow } from '../../lib/charges/chargeStatementsIo'
import { buildChargeStatementHtml, chargeStatementPeriodLabel, statementOfChargesPressWords } from '../../lib/charges/statementOfCharges'
import { loadMaterialLines } from '../../lib/charges/jobChargesRead'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { EmptyState } from '../EmptyState'
import { documentsChip, documentsHeading, documentsQuietButton, documentsTd, documentsTh } from '../jobs/jobDocumentsStyles'
import StatementOfChargesWindow, { type StatementOfChargesJob } from './StatementOfChargesWindow'
import { Money } from './Money'

/**
 * Statements of charges (punch list #254, PR 2): the section on the job window's Documents tab beside Hours
 * statements. Every statement on the job with its record id, its period, its labor and materials, what it charged,
 * where it stands and who saved it, each with **Print** (the office copy again from its snapshot) and **Open**; and
 * the press **Statement of charges…** with its counts — the people who clocked here and the material lines — dead
 * with nothing to make one from. An empty section names the press. Shown to whoever may make an hours-only hours
 * statement (`canMakeHoursStatement`), since the customer copy carries no pay.
 */

export type StatementsOfChargesSectionJob = { id: string; hcp_number: string | null; click_number: string | null; job_name: string; job_address: string; customer_name: string | null }

const chipTone: Record<'grey' | 'blue', CSSProperties> = {
  grey: { background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  blue: { background: 'var(--bg-blue-tint, var(--bg-subtle))', color: 'var(--text-blue-700)' },
}

export function StatementsOfChargesSection({ job, zIndex = 1030, onOverlayOpenChange }: { job: StatementsOfChargesSectionJob; zIndex?: number; onOverlayOpenChange?: (open: boolean) => void }) {
  const { user, role, profileName } = useAuth()
  const { showToast } = useToastContext()
  const access = usePeopleAccess(user?.id)
  const allowed = canMakeHoursStatement({ role, canAccessPay: access.canAccessPay })
  const [rows, setRows] = useState<ChargeStatementRow[] | null>(null)
  const [people, setPeople] = useState<number | null>(null)
  const [lines, setLines] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState<ChargeStatementRow | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    if (!allowed) return () => undefined
    void listChargeStatementsForJob(job.id)
      .then((list) => {
        if (cancelled) return
        setRows(list)
        setError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setRows([])
        setError(formatErrorMessage(e, 'The statements of charges could not be read.'))
      })
    void listHoursStatementPeople(job.id)
      .then((p) => {
        if (!cancelled) setPeople(p.length)
      })
      .catch(() => {
        if (!cancelled) setPeople(0)
      })
    void loadMaterialLines(job.id)
      .then((l) => {
        if (!cancelled) setLines(l.length)
      })
      .catch(() => {
        if (!cancelled) setLines(0)
      })
    return () => {
      cancelled = true
    }
  }, [job.id, allowed])

  useEffect(() => reload(), [reload])

  if (!allowed) return null

  const press = statementOfChargesPressWords(people, lines)
  const openWindow = (on: ChargeStatementRow | null) => {
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
  const printRow = (r: ChargeStatementRow) => {
    const snap = r.snapshot
    if (!snap) {
      showToast('This statement kept no snapshot, so it cannot be printed again. Open it and print from there.', 'error')
      return
    }
    void openHtmlWindowWhenReady(() => Promise.resolve(buildChargeStatementHtml({ snapshot: snap, copy: 'office', recordId: r.record_id })), { print: true }).then((ok) => {
      if (!ok) showToast('The print window was blocked. Allow pop-ups for this site and press Print again.', 'error')
    })
  }
  const windowJob: StatementOfChargesJob = { id: job.id, number: hoursStatementJobNumber(job), name: job.job_name, customer: job.customer_name, site: job.job_address }

  const pressButton = (
    <button type="button" onClick={() => openWindow(null)} disabled={press.dead} title={press.dead ? 'Nothing is clocked or bought on this job yet.' : undefined} style={press.dead ? { ...documentsQuietButton, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' } : documentsQuietButton} data-testid="soc-press">
      {rows == null && people == null ? 'Reading…' : press.label}
    </button>
  )

  const list =
    rows == null ? (
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
    ) : rows.length === 0 ? (
      <EmptyState compact main="Nothing charged into a statement yet." {...(press.dead ? {} : { next: { label: press.label, onPress: () => openWindow(null) }, tail: 'makes the first from this job’s hours and materials.' })} />
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="soc-table">
          <thead>
            <tr>
              <th style={documentsTh}>Record</th>
              <th style={documentsTh}>Period</th>
              <th style={{ ...documentsTh, textAlign: 'right' }}>Labor</th>
              <th style={{ ...documentsTh, textAlign: 'right' }}>Materials</th>
              <th style={{ ...documentsTh, textAlign: 'right' }}>Charged</th>
              <th style={documentsTh}>Saved</th>
              <th style={documentsTh} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="soc-row">
                <td style={{ ...documentsTd, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {r.record_id}
                  <span style={{ ...documentsChip, ...chipTone[r.state === 'printed' ? 'blue' : 'grey'] }}>{r.state === 'printed' ? 'Printed' : 'Draft'}</span>
                </td>
                <td style={{ ...documentsTd, whiteSpace: 'nowrap' }}>{chargeStatementPeriodLabel(r.period_start, r.period_end)}</td>
                <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.labor_usd != null ? <Money amount={Number(r.labor_usd)} /> : '—'}</td>
                <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.materials_usd != null ? <Money amount={Number(r.materials_usd)} /> : '—'}</td>
                <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{r.charges_usd != null ? <Money amount={Number(r.charges_usd)} /> : '—'}</td>
                <td style={{ ...documentsTd, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  {calendarYmdInAppTzFromIso(r.prepared_at)}
                  {r.prepared_by_user?.name ? ` by ${r.prepared_by_user.name}` : ''}
                </td>
                <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" style={documentsQuietButton} onClick={() => printRow(r)} aria-label={`Print ${r.record_id}`}>
                    Print
                  </button>{' '}
                  <button type="button" style={documentsQuietButton} onClick={() => openWindow(r)} aria-label={`Open ${r.record_id}`}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <section aria-labelledby="job-documents-charge-statements" style={{ display: 'grid', gap: '0.5rem' }} data-testid="statements-of-charges-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-charge-statements" style={{ ...documentsHeading, flex: 1 }}>
          Statements of charges
        </h3>
        {pressButton}
      </div>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>What this job’s labor and materials are charged at: every crew-day from the rate card or as the job says, every material line at the markup over cost. Nothing on it is typed in.</p>
      {error ? <p style={{ margin: 0, color: 'var(--text-red-600)', fontSize: '0.875rem' }}>{error}</p> : null}
      {list}
      {open && user ? <StatementOfChargesWindow job={windowJob} existing={opening} preparedBy={{ userId: user.id, name: (profileName ?? '').trim() || 'the office' }} onClose={closeWindow} zIndex={zIndex} /> : null}
    </section>
  )
}
