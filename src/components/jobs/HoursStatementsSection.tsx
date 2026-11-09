/**
 * Hours statements (punch list #212, PR 2, v2.6097): the section on the job window's Documents tab and under the
 * person's desk Hours. Every statement on the job (or for the person) as one card (v2.6428; a four-column table until
 * then, cut off in the 600px desk pane and the job window at every width): the job, or the worker on the job's own
 * window, as the title, then its record id and where it stands, its period and kind, and who saved it, each with
 * **Print** (the paper again from its snapshot, with its record id) and **Open** (the window on it), and on a signed one
 * **Open the signed PDF** (PR 3, v2.6411: the flattened Contract Form through `open-contract-form-pdf`'s gate, the open
 * logged) and, since v2.6634, **Put in Sent by us** (the signed PDF copied into the job's Drive folder, Team only → Sent by
 * us, through `drive-link`'s `put` — `hoursStatementDrive.ts`) or **Open in Drive ↗** once it is there, at the right of the title or across the card's foot on a phone (`.hsCard` in `index.css`); and the press
 * **Hours statement…** with its count — the people who clocked on the job, or the jobs the person clocked on — dead
 * when there is no one to make a statement for. An empty section names the press. Shown to a dev and the controller
 * alone (`canMakeHoursStatement`: the paper is payroll data, Diane's call of 2026-11-02) and to no one else — nothing,
 * not a dead section — with the desk's lock tag beside the heading, *Controllers and devs only*, so an office reader
 * knows why a colleague cannot see it.
 */
import { Suspense, lazy, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { useToastContext } from '../../contexts/ToastContext'
import { usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { HOURS_STATEMENT_ROLES_CHIP, canMakeHoursStatement } from '../../lib/people/hoursStatementAccess'
import { LockTag } from '../personDesk/personDeskShared'
import { hoursStatementJobNumber, listHoursStatementJobs, listHoursStatementPeople } from '../../lib/people/hoursStatementRead'
import { listHoursStatementsForJob, listHoursStatementsForUser, type HoursStatementRecordRow } from '../../lib/people/hoursStatementsIo'
import { buildHoursStatementPaper, printHoursStatementPaper } from '../../lib/people/hoursStatementPrint'
import { hoursStatementEmptyWords, hoursStatementPressWords, hoursStatementRowWords } from '../../lib/people/hoursStatementWindow'
import { supabaseHoursStatementSigningIo, type HoursStatementSigningIo } from '../../lib/people/hoursStatementSigningIo'
import { HOURS_STATEMENT_DRIVE_WORDS, hoursStatementDriveProblem, hoursStatementDriveUrl, hoursStatementInDriveWords, putHoursStatementInSentByUs, type HoursStatementDriveIo } from '../../lib/people/hoursStatementDrive'
import { supabaseHoursStatementDriveIo } from '../../lib/people/hoursStatementDriveIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { EmptyState } from '../EmptyState'
import { documentsChip, documentsHeading, documentsQuietButton } from './jobDocumentsStyles'
import type { HoursStatementScope } from './HoursStatementModal'

// The window, its sheets and the paper's kernels load only when a statement is opened or started: statically imported
// they sat in the main chunk, which crossed the service worker's 7 MiB precache cap with PR 3 (v2.6411) and failed
// the deploy build (vite.config.ts → injectManifest.maximumFileSizeToCacheInBytes).
const HoursStatementModal = lazy(() => import('./HoursStatementModal').then((m) => ({ default: m.HoursStatementModal })))

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
  signingIo = supabaseHoursStatementSigningIo,
  driveIo,
}: {
  scope: HoursStatementsSectionScope
  /** The window's layer: above the job window by default; the desk passes its editor layer. */
  zIndex?: number
  onOverlayOpenChange?: (open: boolean) => void
  /** The viewer's pay access when the opener already knows it (the desk); else read here. */
  canAccessPay?: boolean
  /** Drawn inside a desk section: a lighter heading. */
  desk?: boolean
  /** The signing's calls (the signed PDF's door); the smoke hands a fake. */
  signingIo?: HoursStatementSigningIo
  /** Put in Sent by us's calls (v2.6634); the smoke hands a fake. Built from `signingIo` when not given. */
  driveIo?: HoursStatementDriveIo
}) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const promptDialog = usePromptDialog()
  const access = usePeopleAccess(canAccessPayGiven == null ? user?.id : undefined)
  const maker = { role, canAccessPay: canAccessPayGiven ?? access.canAccessPay }
  const [rows, setRows] = useState<HoursStatementRecordRow[] | null>(null)
  const [count, setCount] = useState<number | null>(null)
  // Subs on the job's sheets (v2.6636): named in the press, since they never clocked.
  const [onSheets, setOnSheets] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState<HoursStatementRecordRow | null>(null)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [driveBusy, setDriveBusy] = useState<string | null>(null)
  const allowed = canMakeHoursStatement(maker)
  const scopeKey = scope.kind === 'job' ? `job:${scope.job.id}` : `person:${scope.userId}`

  const reload = useCallback(() => {
    let cancelled = false
    if (!allowed) return () => undefined
    // Two reads, each on its own: a list that cannot be read shows its reason, and the press still counts who clocked.
    void (scope.kind === 'job' ? listHoursStatementsForJob(scope.job.id) : listHoursStatementsForUser(scope.userId))
      .then((list) => {
        if (cancelled) return
        setRows(list)
        setError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setRows([])
        setError(formatErrorMessage(e, 'The hours statements could not be read.'))
      })
    void (scope.kind === 'job' ? listHoursStatementPeople(scope.job.id).then((p) => ({ count: p.length, onSheets: p.filter((x) => x.kind === 'sheet').length })) : listHoursStatementJobs(scope.userId).then((j) => ({ count: j.length, onSheets: j.filter((x) => x.kind === 'sheet').length })))
      .then((who) => {
        if (cancelled) return
        setCount(who.count)
        setOnSheets(who.onSheets)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setCount(0)
        setError((cur) => cur ?? formatErrorMessage(e, scope.kind === 'job' ? 'The people who clocked here could not be read.' : 'The jobs could not be read.'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the scope's key stands for the scope
  }, [scopeKey, allowed])

  useEffect(() => reload(), [reload])

  if (!allowed) return null

  const press = hoursStatementPressWords(count, scope.kind, { onSheets })
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
  const openSignedPdf = async (r: HoursStatementRecordRow) => {
    if (!r.contract_document_id || pdfBusy) return
    setPdfBusy(r.id)
    try {
      const url = await signingIo.openSignedPdf(r.contract_document_id)
      // The gate answers after the press, so a browser that blocks the late window gets the link in a dialog, as the
      // window's own press and Sign here now's Open the signing page do (the 2026-11-08 walk saw a toast and no PDF).
      const opened = window.open(url, '_blank', 'noopener')
      if (!opened) await promptDialog({ title: 'Open the signed PDF', message: 'The window was blocked. Open this link; it works for five minutes.', defaultValue: url, confirmLabel: 'I opened it' })
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The signed PDF could not be opened.'), 'error')
    } finally {
      setPdfBusy(null)
    }
  }
  const drive = driveIo ?? supabaseHoursStatementDriveIo(signingIo)
  const putInSentByUs = async (r: HoursStatementRecordRow) => {
    if (!r.contract_document_id || driveBusy) return
    setDriveBusy(r.id)
    try {
      const { driveFileId } = await putHoursStatementInSentByUs(drive, { statementId: r.id, recordId: r.record_id, jobId: r.job_ledger_id, contractDocumentId: r.contract_document_id })
      setRows((cur) => (cur ?? []).map((x) => (x.id === r.id ? { ...x, drive_file_id: driveFileId, drive_filed_at: new Date().toISOString() } : x)))
      showToast(hoursStatementInDriveWords(r.record_id), 'success')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, HOURS_STATEMENT_DRIVE_WORDS.failed), 'error')
    } finally {
      setDriveBusy(null)
    }
  }
  const openInDrive = (r: HoursStatementRecordRow) => {
    if (!r.drive_file_id) return
    if (!window.open(hoursStatementDriveUrl(r.drive_file_id), '_blank', 'noopener')) showToast('The window was blocked. Allow pop-ups for this site and press Open in Drive again.', 'error')
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
      style={press.dead ? { ...documentsQuietButton, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' } : documentsQuietButton}
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
      // One card a statement (v2.6428): the job (or, on the job's own window, the worker) as the title, whole at any
      // width; Record · Period · Saved as label · value lines; the presses small at the right of the title while the
      // card is 360px or wider, and a full-width foot row under that (a phone), set by the card's own width in CSS.
      <ul className="hsCards" aria-label="Saved hours statements">
        {rows.map((r) => {
          const jobLabel = r.job ? `${(r.job.hcp_number ?? '').trim() || (r.job.click_number ?? '').trim() || r.job_ledger_id.slice(0, 8)} · ${r.job.job_name ?? ''}` : r.snapshot ? `${r.snapshot.job.number} · ${r.snapshot.job.name}` : r.job_ledger_id.slice(0, 8)
          const workerName = r.worker?.name ?? r.snapshot?.worker.name ?? 'Worker'
          const words = hoursStatementRowWords({
            recordId: r.record_id,
            workerName,
            jobLabel,
            periodStart: r.period_start,
            periodEnd: r.period_end,
            withPay: r.with_pay,
            basis: r.basis ?? null,
            state: r.state,
            preparedAtYmd: calendarYmdInAppTzFromIso(r.prepared_at),
            preparedByName: r.prepared_by_user?.name ?? null,
          })
          return (
            <li key={r.id} className="hsCard" data-testid="hours-statement-row">
              <div className="hsCardIn">
                <div className="hsCardTitle">{scope.kind === 'job' ? workerName : jobLabel}</div>
                <dl className="hsCardKv">
                  <dt>Record</dt>
                  <dd>
                    <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{words.record}</span>
                    <span style={{ ...documentsChip, ...chipTone[words.state.tone] }}>{words.state.label}</span>
                  </dd>
                  <dt>Period</dt>
                  <dd>
                    {words.period} · {words.kind}
                  </dd>
                  <dt>Saved</dt>
                  <dd>{words.saved}</dd>
                </dl>
                <div className="hsCardPresses">
                  {r.state === 'signed' && r.contract_document_id ? (
                    <button type="button" style={documentsQuietButton} disabled={pdfBusy === r.id} onClick={() => void openSignedPdf(r)} aria-label={`Open the signed PDF ${r.record_id}`}>
                      {pdfBusy === r.id ? 'Opening…' : 'Open the signed PDF'}
                    </button>
                  ) : null}
                  {r.state === 'signed' && r.contract_document_id ? (
                    r.drive_file_id ? (
                      <button type="button" style={documentsQuietButton} onClick={() => openInDrive(r)} title={HOURS_STATEMENT_DRIVE_WORDS.openTitle} aria-label={`Open ${r.record_id} in Drive`}>
                        {HOURS_STATEMENT_DRIVE_WORDS.open}
                      </button>
                    ) : (
                      <button type="button" style={driveBusy ? { ...documentsQuietButton, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' } : documentsQuietButton} disabled={Boolean(driveBusy) || Boolean(hoursStatementDriveProblem(r))} title={hoursStatementDriveProblem(r) ?? HOURS_STATEMENT_DRIVE_WORDS.putTitle} onClick={() => void putInSentByUs(r)} aria-label={`Put ${r.record_id} in Sent by us`}>
                        {driveBusy === r.id ? HOURS_STATEMENT_DRIVE_WORDS.putting : HOURS_STATEMENT_DRIVE_WORDS.put}
                      </button>
                    )
                  ) : null}
                  <button type="button" style={documentsQuietButton} onClick={() => printRow(r)} aria-label={`Print ${r.record_id}`}>
                    Print
                  </button>
                  <button type="button" style={documentsQuietButton} onClick={() => openWindow(r)} aria-label={`Open ${r.record_id}`}>
                    Open
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    )

  return (
    <section aria-labelledby={`hours-statements-${scope.kind}`} style={desk ? { display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0.7rem' } : { display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 id={`hours-statements-${scope.kind}`} style={desk ? { ...documentsHeading, fontSize: '0.8125rem', flex: 1 } : { ...documentsHeading, flex: 1 }}>
          Hours statements
        </h3>
        <LockTag label={HOURS_STATEMENT_ROLES_CHIP} title="A signed hours statement is payroll data. The section shows to a dev and the controller alone." />
        {pressButton}
      </div>
      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p> : null}
      {list}
      {open ? (
        <Suspense fallback={null}>
          <HoursStatementModal open scope={modalScope} maker={maker} existing={opening} zIndex={zIndex} onClose={closeWindow} />
        </Suspense>
      ) : null}
    </section>
  )
}

export default HoursStatementsSection
