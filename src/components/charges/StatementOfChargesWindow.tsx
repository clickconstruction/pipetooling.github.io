import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatDenverDateTimeShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { buildJobCharges } from '../../lib/charges/jobCharges'
import { loadJobCharges, type JobChargesReadResult } from '../../lib/charges/jobChargesRead'
import { buildChargeStatementHtml, chargeStatementWords, cutJobChargesToPeriod, jobChargesSpan, statementOfChargesFiling, type ChargeStatementSnapshot } from '../../lib/charges/statementOfCharges'
import { fileSentCopy } from '../../lib/sent/sentCopiesIo'
import { saveChargeStatement, type ChargeStatementRow } from '../../lib/charges/chargeStatementsIo'
import { crewSpanWords, jobChargeRuleWords } from '../../lib/charges/crewDays'
import { Money } from './Money'
import { UnchargedCallout } from './UnchargedCallout'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/**
 * The Statement of charges window (punch list #254, PR 2): the period, Labor by crew-day with the job's rule shown,
 * Materials at the markup, the office-copy switch, the imported-days switch, the counts of what the span holds and
 * what stays off, and the paper beside as the preview; Print and Save the statement. A saved statement opens on its
 * own snapshot, as it read, and prints again from it. The job decides the rate, never the paper.
 */

export type StatementOfChargesJob = { id: string; number: string; name: string; customer: string | null; site: string }

type Props = {
  job: StatementOfChargesJob
  existing: ChargeStatementRow | null
  preparedBy: { userId: string; name: string }
  onClose: () => void
  onSaved?: (row: ChargeStatementRow) => void
  zIndex?: number
}

const field: CSSProperties = { padding: '0.35rem 0.5rem', fontSize: '0.875rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', width: '100%', boxSizing: 'border-box' }
const label: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }
const toggle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-base)', cursor: 'pointer' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontWeight: 600 }
/** A dead press reads the dead pair, blue or grey alike. */
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'transparent', cursor: 'not-allowed' }

function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function StatementOfChargesWindow({ job, existing, preparedBy, onClose, onSaved, zIndex = 1030 }: Props) {
  const { showToast } = useToastContext()
  const narrow = useMatchMedia('(max-width: 860px)')
  const titleId = useId()
  const [read, setRead] = useState<{ read: JobChargesReadResult; asOf: string } | null>(null)
  const [reading, setReading] = useState(!existing)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(existing?.period_start ?? '')
  const [to, setTo] = useState(existing?.period_end ?? '')
  const [officeCopy, setOfficeCopy] = useState(true)
  const [nameImported, setNameImported] = useState(existing?.snapshot?.nameImportedDays ?? true)
  const [row, setRow] = useState<ChargeStatementRow | null>(existing)
  const [busy, setBusy] = useState<'save' | 'print' | null>(null)

  const load = useCallback(async () => {
    setReading(true)
    setError(null)
    try {
      const r = await loadJobCharges(job.id)
      setRead({ read: r, asOf: formatDenverDateTimeShort(Date.now()) })
      const span = jobChargesSpan(r.input)
      setFrom((cur) => cur || span?.start || todayYmdInAppTz())
      setTo((cur) => cur || span?.end || todayYmdInAppTz())
    } catch (e) {
      setError(formatErrorMessage(e, 'The job’s hours and materials could not be read.'))
    } finally {
      setReading(false)
    }
  }, [job.id])

  useEffect(() => {
    if (!existing?.snapshot) void load()
  }, [existing, load])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const spanOk = Boolean(from && to && from <= to)
  const snapshot = useMemo<ChargeStatementSnapshot | null>(() => {
    if (existing?.snapshot) return { ...existing.snapshot, nameImportedDays: nameImported }
    if (!read || !spanOk) return null
    return {
      input: cutJobChargesToPeriod(read.read.input, from, to),
      period: { start: from, end: to },
      job: { number: job.number, name: job.name, customer: job.customer, site: job.site },
      preparedBy: preparedBy.name,
      preparedOn: longDate(todayYmdInAppTz()),
      asOf: read.asOf,
      nameImportedDays: nameImported,
    }
  }, [existing, read, spanOk, from, to, job, preparedBy.name, nameImported])

  const charges = useMemo(() => (snapshot ? buildJobCharges(cutJobChargesToPeriod(snapshot.input, snapshot.period.start, snapshot.period.end)) : null), [snapshot])
  const words = useMemo(() => (snapshot && charges ? chargeStatementWords(snapshot, charges) : null), [snapshot, charges])
  const html = useMemo(() => (snapshot ? buildChargeStatementHtml({ snapshot, copy: officeCopy ? 'office' : 'customer', recordId: row?.record_id ?? null }) : ''), [snapshot, officeCopy, row?.record_id])
  const frozen = Boolean(existing?.snapshot)

  async function save(state: 'draft' | 'printed'): Promise<ChargeStatementRow | null> {
    if (!snapshot || !charges) return null
    const saved = await saveChargeStatement({
      id: row?.id ?? null,
      jobId: job.id,
      jobNumber: job.number,
      snapshot,
      // The premium waits while any day prices at nothing: the charges are short by those days.
      figures: { laborUsd: charges.totals.labor, materialsUsd: charges.totals.materials, chargesUsd: charges.totals.charges, premiumUsd: charges.totals.unpricedDays > 0 ? null : charges.premium.signed },
      state,
      preparedBy: preparedBy.userId,
    })
    setRow(saved)
    onSaved?.(saved)
    return saved
  }

  const onSave = async () => {
    if (busy || !snapshot) return
    setBusy('save')
    try {
      const saved = await save(row?.state === 'printed' ? 'printed' : 'draft')
      if (saved) showToast(`Saved as ${saved.record_id}.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The statement could not be saved.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const onPrint = async () => {
    if (busy || !snapshot) return
    setBusy('print')
    const customerCopy = !officeCopy
    const printed: { html?: string; saved?: ChargeStatementRow | null } = {}
    try {
      const ok = await openHtmlWindowWhenReady(async () => {
        printed.saved = await save('printed')
        printed.html = buildChargeStatementHtml({ snapshot, copy: customerCopy ? 'customer' : 'office', recordId: printed.saved?.record_id ?? row?.record_id ?? null })
        return printed.html
      }, { print: true })
      if (!ok) showToast('The print window was blocked. Allow pop-ups for this site and press Print again.', 'error')
      // A print counts as a send (docs/SENT_COPIES.md): the customer's copy is kept in the job's Documents. The office
      // copy holds the premium and the shortfall, the office's own report, and is not a send.
      else if (customerCopy && printed.html) void fileSentCopy({ ...statementOfChargesFiling(job, printed.saved ?? row), how: 'print' }, { html: printed.html })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The statement could not be printed.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const rule = snapshot?.input.rule ?? read?.read.rule ?? { kind: 'crew' as const }

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(2vh + var(--app-top-chrome, 0px)) 0.75rem 2vh', overflowY: 'auto' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="statement-of-charges-window" style={{ width: 'min(1180px, 100%)', maxHeight: 'min(96vh, 100%)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 18px 48px rgba(17,24,39,0.25)', color: 'var(--text-base)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Statement of charges · {job.number} · {job.name}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '1.1rem', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '320px minmax(0, 1fr)', gap: '1rem', padding: '0.9rem 1rem', overflow: 'auto', minHeight: 0, flex: 1 }}>
          <div style={{ display: 'grid', gap: '0.7rem', alignContent: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <label style={label}>
                From
                <input type="date" style={field} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" disabled={frozen} />
              </label>
              <label style={label}>
                To
                <input type="date" style={field} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" disabled={frozen} />
              </label>
            </div>
            {from && to && from > to ? <p style={{ ...quiet, color: 'var(--text-red-600)' }}>From is after To. Pick a span that starts first.</p> : null}
            <div style={{ display: 'grid', gap: '0.3rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>Labor by crew-day</span>
              <span style={quiet}>Who was out each day sets the crew; the crew’s hour is priced from the rate card. This job: <b style={{ color: 'var(--text-base)' }}>{jobChargeRuleWords(rule)}</b>.</span>
              <span style={quiet}>Change the job’s rule in the Job Summary’s Charges window.</span>
            </div>
            <div style={{ display: 'grid', gap: '0.3rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>Materials at the markup</span>
              <span style={quiet}>{words ? words.materialsAt : 'Supply-house invoices, tallied parts and typed material charges, at cost plus the markup.'}</span>
            </div>
            <label style={toggle}>
              <input type="checkbox" checked={officeCopy} onChange={(e) => setOfficeCopy(e.target.checked)} style={{ marginTop: 3 }} data-testid="soc-office-copy" />
              <span>
                Office copy: cost, margin, the premium and the adjustments
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Off, the paper is the customer copy: charged amounts only.</span>
              </span>
            </label>
            <label style={toggle}>
              <input type="checkbox" checked={nameImported} onChange={(e) => setNameImported(e.target.checked)} style={{ marginTop: 3 }} data-testid="soc-name-imported" />
              <span>
                Name the imported days
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>One line under the table: how many days came from the pay records, not the clock.</span>
              </span>
            </label>
            {error ? (
              <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'start' }}>
                <p style={{ ...quiet, color: 'var(--text-red-600)' }} data-testid="soc-error">{error}</p>
                <button type="button" style={btn} onClick={() => void load()}>
                  Try again
                </button>
              </div>
            ) : null}
            {charges ? (
              <div data-testid="soc-span" style={{ display: 'grid', gap: '0.2rem' }}>
                <p style={quiet}>
                  {crewSpanWords(charges.totals)}; {charges.materials.totals.lines} material {charges.materials.totals.lines === 1 ? 'line' : 'lines'}, cost <Money amount={charges.materials.totals.cost} />.
                </p>
                {frozen ? null : <UnchargedCallout people={charges.uncharged} unpricedDays={charges.totals.unpricedDays} onNavigate={onClose} margin="0.2rem 0" />}
                {charges.notes.map((n) => (
                  <p key={n} style={{ ...quiet, color: 'var(--text-amber-800)', fontWeight: 600 }}>
                    {n}
                  </p>
                ))}
                <p style={quiet}>
                  Charged into this job <Money amount={charges.totals.charges} data-testid="soc-charged" style={{ color: 'var(--text-strong)', fontWeight: 700 }} />
                  {officeCopy ? <> · {charges.totals.unpricedDays > 0 ? 'the premium waits until every day prices' : charges.premium.words}</> : null}
                </p>
              </div>
            ) : reading ? (
              <p style={quiet}>Reading the job’s hours and materials…</p>
            ) : null}
            {row ? (
              <p data-testid="soc-saved" style={{ ...quiet, color: 'var(--text-strong)', fontWeight: 600 }}>
                Saved as {row.record_id} · {row.state === 'printed' ? 'Printed' : 'Draft'}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <button type="button" style={{ ...btn, ...(!snapshot || busy != null ? dead : {}) }} disabled={!snapshot || busy != null} onClick={() => void onPrint()} data-testid="soc-print">
                {busy === 'print' ? 'Printing…' : 'Print'}
              </button>
              <button type="button" style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#ffffff', ...(!snapshot || busy != null || frozen ? dead : {}) }} disabled={!snapshot || busy != null || frozen} onClick={() => void onSave()} data-testid="soc-save">
                {busy === 'save' ? 'Saving…' : row ? 'Save the statement again' : 'Save the statement'}
              </button>
            </div>
            <p style={quiet}>{frozen ? 'A saved statement prints as it read; make a new one for today’s rows.' : 'Saving keeps the paper as it reads today, with the job’s rule, the markup and the adjustments in force. Print saves it as printed.'}</p>
          </div>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem' }}>
            {html ? <iframe title="The paper" data-testid="soc-paper" srcDoc={html} sandbox="" style={{ flex: 1, width: '100%', minHeight: narrow ? 520 : 640, border: 0, background: 'var(--surface)' }} /> : <p style={{ ...quiet, padding: '1rem' }}>{reading ? 'Reading…' : 'Pick a span to draw the paper.'}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
