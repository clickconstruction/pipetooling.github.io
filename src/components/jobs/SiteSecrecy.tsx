import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { jobPapersChanged } from '../../hooks/useJobsClosedToMe'
import {
  type SecrecyCounts,
  type SecrecyMode,
  type SecrecyPreview,
  type SecrecySite,
  type SiteSecrecyRow,
  SITE_SECRECY_WORDS as W,
  TURNED_OFF_TOAST,
  canReadSecrecy,
  canTurnSecrecy,
  onCountSentences,
  onSinceSentence,
  previewValues,
  secrecyDraws,
  secrecyLead,
  secrecyPapers,
  turnOffConfirm,
  turnOnButton,
  turnedOnToast,
} from '../../lib/addresses/siteSecrecy'
import { type SiteSecrecyIo, supabaseSiteSecrecyIo } from '../../lib/addresses/siteSecrecyIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { BookPaperRow } from '../../lib/jobs/jobPapers'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * **Secrecy on this site** (punch list #439, piece 4): the block on a development's page, on a lone job's Documents
 * tab, and under the site's line in Send a paper. Off, it says what turning it on does and offers the press. The press opens a panel in place: the
 * paper our own people sign, picked from the Contract Book, then the jobs it shuts and the people it asks, counted
 * before the last press. On, it says since when, the paper, the jobs that carry it and who has signed.
 *
 * The four office roles press. The estimator reads and presses nothing. Anyone else sees nothing. While the database
 * has no `site_secrecy` yet the block draws nothing, so a client ahead of its migration offers no dead press.
 *
 * In Send a paper (`offer`, 4d) the block asks once while the picked site is off: **Turn on secrecy for this site**,
 * which opens the same panel in place, or **Only send this one**, after which it says no more of that site. While the
 * site is on it says so in two lines and offers no press: turning it off is done where the site lives.
 */

const box: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.75rem 0.9rem' }
const plain: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const panel: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }
const step: CSSProperties = { margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-strong)' }
// A word that is a press takes a finger: 44 px tall.
const linkPress: CSSProperties = { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, border: 'none', background: 'transparent', padding: '0 0.5rem 0 0', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem' }
const bluePress: CSSProperties = { minHeight: 44, padding: '0.5rem 0.85rem', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }
const paperPick: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', minHeight: 44, padding: '0.3rem 0.6rem', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', width: '100%' }
const dot: CSSProperties = { flex: '0 0 auto', width: 16, height: 16, borderRadius: 999, border: '2px solid var(--border)', boxSizing: 'border-box' }

type Read = { kind: 'reading' } | { kind: 'not-there' } | { kind: 'read'; row: SiteSecrecyRow | null } | { kind: 'failed'; failure: OfflineRecoveryLastError }

export interface SiteSecrecyProps {
  site: SecrecySite
  role: string | null | undefined
  /**
   * `door`, the default, offers the presses. `reads` draws the on state alone with no press, and nothing while the
   * site is off: a job in a development, whose door is the development's page. `offer` is Send a paper: one question
   * while the site is off, two lines while it is on.
   */
  mode?: SecrecyMode
  /** False on a job's Documents tab, whose sections carry no box of their own. */
  boxed?: boolean
  /** Told after secrecy was turned on or off, so a neighbour that lists the job's papers reads again. */
  onChanged?: () => void
  /** The reads and presses. A smoke hands a fake. */
  io?: SiteSecrecyIo
  testId?: string
}

export function SiteSecrecy({ site, role, mode = 'door', boxed = true, onChanged, io = supabaseSiteSecrecyIo, testId = 'site-secrecy' }: SiteSecrecyProps) {
  const headingId = useId()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const canRead = canReadSecrecy(role)
  const canTurn = canTurnSecrecy(role) && mode !== 'reads'
  const offer = mode === 'offer'
  // The site as one string, so the reads run again only when it changes.
  const siteKey = 'developmentId' in site ? `d:${site.developmentId}` : `a:${site.address}`
  const siteOf = useRef(site)
  siteOf.current = site

  const [read, setRead] = useState<Read>({ kind: 'reading' })
  const [counts, setCounts] = useState<SecrecyCounts | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const [book, setBook] = useState<BookPaperRow[] | null>(null)
  const [bookFailure, setBookFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [preview, setPreview] = useState<SecrecyPreview | null>(null)
  const [previewFailure, setPreviewFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [panelAttempt, setPanelAttempt] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState<'on' | 'off' | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** **Only send this one** was pressed for this site: the offer says no more of it. */
  const [passed, setPassed] = useState(false)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // Another site is another question: the offer starts again, and so does the read.
  useEffect(() => {
    setPassed(false)
    setOpen(false)
    setPicked(null)
    setError(null)
    setRead({ kind: 'reading' })
  }, [siteKey])

  // The site's row, then its counts when it is on. The offer in Send a paper counts nothing: it says the site is on.
  useEffect(() => {
    if (!canRead) return
    let mine = true
    setRead((r) => (r.kind === 'read' ? r : { kind: 'reading' }))
    io.readLive(siteOf.current).then(
      (row) => {
        if (!mine) return
        if (row === 'not-there') return setRead({ kind: 'not-there' })
        setRead({ kind: 'read', row })
        if (!row || offer) return setCounts(null)
        io.readCounts(row.id).then(
          (c) => mine && setCounts(c),
          () => mine && setCounts(null),
        )
      },
      (e: unknown) => mine && setRead({ kind: 'failed', failure: recoveryFailureFromError(e, 'Couldn’t read this site’s secrecy') }),
    )
    return () => {
      mine = false
    }
  }, [canRead, io, siteKey, attempt, offer])

  // The panel's own reads, once it is open: the Contract Book and what the press would reach.
  useEffect(() => {
    if (!open) return
    let mine = true
    setBookFailure(null)
    setPreviewFailure(null)
    io.readBook().then(
      (rows) => mine && setBook(rows),
      (e: unknown) => mine && setBookFailure(recoveryFailureFromError(e, 'Couldn’t read the Contract Book')),
    )
    io.preview(siteOf.current).then(
      (p) => mine && setPreview(p),
      (e: unknown) => mine && setPreviewFailure(recoveryFailureFromError(e, 'Couldn’t count the jobs and the people')),
    )
    return () => {
      mine = false
    }
  }, [open, io, siteKey, panelAttempt])

  const papers = useMemo(() => (book ? secrecyPapers(book) : null), [book])
  const row = read.kind === 'read' ? read.row : null

  const close = useCallback(() => {
    setOpen(false)
    setPicked(null)
    setError(null)
  }, [])

  const turnOn = useCallback(async () => {
    if (!picked || busy) return
    setBusy('on')
    setError(null)
    try {
      const made = await io.turnOn(siteOf.current, picked)
      if (!live.current) return
      showToast(turnedOnToast(made.jobs), 'success')
      close()
      jobPapersChanged()
      onChanged?.()
      setAttempt((n) => n + 1)
    } catch (e) {
      if (live.current) setError(formatErrorMessage(e, 'Secrecy could not be turned on.'))
    } finally {
      if (live.current) setBusy(null)
    }
  }, [picked, busy, io, showToast, close, onChanged])

  const turnOff = useCallback(async () => {
    if (!row || busy) return
    const words = turnOffConfirm(row, counts)
    if (!(await confirmDialog(words)) || !live.current) return
    setBusy('off')
    setError(null)
    try {
      await io.turnOff(row.id)
      if (!live.current) return
      showToast(TURNED_OFF_TOAST, 'success')
      jobPapersChanged()
      onChanged?.()
      setAttempt((n) => n + 1)
    } catch (e) {
      if (live.current) setError(formatErrorMessage(e, 'Secrecy could not be turned off.'))
    } finally {
      if (live.current) setBusy(null)
    }
  }, [row, busy, counts, confirmDialog, io, showToast, onChanged])

  if (!canRead || read.kind === 'not-there' || read.kind === 'reading') return null
  // A block that only reads says nothing while the site is off, and nothing of a read that failed: the door is
  // elsewhere. The offer says nothing to someone who cannot turn secrecy on, nor once it was passed over.
  if (!secrecyDraws({ mode, on: row != null, failed: read.kind === 'failed', canTurn, passed })) return null

  const button = turnOnButton(preview, picked != null, busy === 'on')
  const reach = preview ? previewValues(preview) : null
  const onCounts = counts ? onCountSentences(counts) : null

  return (
    <section aria-labelledby={headingId} data-testid={testId} data-secrecy={row ? 'on' : read.kind === 'failed' ? 'unread' : 'off'} style={boxed ? box : plain}>
      <h3 id={headingId} style={heading}>
        {W.heading}
      </h3>
      {read.kind === 'failed' ? (
        <OfflineRetryPanel failure={read.failure} onRetry={() => setAttempt((n) => n + 1)} surface="site-secrecy" idempotent />
      ) : row ? (
        <>
          <ValueLines>
            <ValueLine label={W.labels.state}>
              <ValueSentence text={onSinceSentence(calendarYmdInAppTzFromIso(row.turned_on_at))} />
            </ValueLine>
            <ValueLine label={W.labels.paper}>
              <WorkedOutValue>{row.paper_name}</WorkedOutValue>
            </ValueLine>
            {onCounts ? (
              <ValueLine label={W.labels.jobs}>
                <ValueSentence text={onCounts.jobs} />
              </ValueLine>
            ) : null}
            {onCounts?.signed ? (
              <ValueLine label={W.labels.signed}>
                <ValueSentence text={onCounts.signed} />
              </ValueLine>
            ) : null}
          </ValueLines>
          {offer ? null : (
            <p style={muted}>
              {W.once} {W.later}
            </p>
          )}
          {offer ? null : canTurn ? (
            <button type="button" style={linkPress} disabled={busy != null} onClick={() => void turnOff()}>
              {busy === 'off' ? W.turningOff : W.turnOff}
            </button>
          ) : (
            <p style={muted}>{mode === 'reads' ? W.onDevelopment : W.estimator}</p>
          )}
        </>
      ) : (
        <>
          {offer ? null : (
            <ValueLines>
              <ValueLine label={W.labels.state}>
                <WorkedOutValue>{W.off}</WorkedOutValue>
              </ValueLine>
            </ValueLines>
          )}
          <p style={muted}>{offer ? W.offerLead : secrecyLead(site)}</p>
          {!canTurn ? (
            <p style={muted}>{W.estimator}</p>
          ) : !open ? (
            <div style={{ display: 'flex', gap: '0.25rem 1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={linkPress} onClick={() => setOpen(true)}>
                {W.turnOn}
              </button>
              {offer ? (
                <button type="button" style={{ ...linkPress, color: 'var(--text-muted)' }} onClick={() => setPassed(true)}>
                  {W.onlySend}
                </button>
              ) : null}
            </div>
          ) : (
            <div style={panel} data-testid={`${testId}-panel`}>
              <p style={step}>{W.pickPaper}</p>
              <p style={muted}>{W.pickPaperHint}</p>
              {bookFailure ? (
                <OfflineRetryPanel failure={bookFailure} onRetry={() => setPanelAttempt((n) => n + 1)} surface="site-secrecy-book" idempotent />
              ) : papers == null ? (
                <p style={muted}>Loading…</p>
              ) : papers.length === 0 ? (
                <p style={muted}>{W.noPapers}</p>
              ) : (
                <div role="radiogroup" aria-label={W.pickPaper} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {papers.map((p) => {
                    const on = picked === p.bookDocumentId
                    return (
                      <button
                        key={p.bookDocumentId}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!p.hasWords || busy != null}
                        onClick={() => setPicked(p.bookDocumentId)}
                        style={{ ...paperPick, ...(p.hasWords ? {} : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }), ...(on ? { borderColor: '#2563eb' } : {}) }}
                      >
                        <span aria-hidden="true" style={{ ...dot, ...(on ? { borderColor: '#2563eb', background: '#2563eb', boxShadow: 'inset 0 0 0 3px var(--surface)' } : {}) }} />
                        <b style={{ color: p.hasWords ? 'var(--text-strong)' : DEAD_PRESS_TEXT, fontWeight: 600, fontSize: '0.875rem' }}>{p.paperName}</b>
                        <span style={muted}>{p.from}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <p style={step}>{W.whatHappens}</p>
              {previewFailure ? (
                <OfflineRetryPanel failure={previewFailure} onRetry={() => setPanelAttempt((n) => n + 1)} surface="site-secrecy-reach" idempotent />
              ) : !reach ? (
                <p style={muted}>{W.readingReach}</p>
              ) : (
                <>
                  <ValueLines>
                    <ValueLine label={W.labels.shut}>
                      <WorkedOutValue>{reach.jobs}</WorkedOutValue>
                    </ValueLine>
                    <ValueLine label={W.labels.people}>
                      <WorkedOutValue>{reach.people}</WorkedOutValue>
                    </ValueLine>
                  </ValueLines>
                  <p style={muted}>{reach.jobsNote}</p>
                </>
              )}
              <p style={muted}>{W.subs}</p>
              <p style={muted}>{W.undo}</p>
              {error ? (
                <p style={{ ...muted, color: 'var(--text-red-700)' }} role="alert">
                  {error}
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={{ ...bluePress, ...(button.dead ? deadPress : {}) }} disabled={button.dead} onClick={() => void turnOn()}>
                  {button.label}
                </button>
                <button type="button" style={{ ...linkPress, alignSelf: 'center', color: 'var(--text-muted)' }} disabled={busy != null} onClick={close}>
                  {W.notYet}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && !open ? (
        <p style={{ ...muted, color: 'var(--text-red-700)' }} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

export default SiteSecrecy
