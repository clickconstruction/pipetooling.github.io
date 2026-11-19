import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  LIEN_CLOSED_KEPT_WORDS,
  LIEN_CLOSED_NOTE_EXAMPLE,
  LIEN_CLOSED_NOTE_LABEL,
  buildLienClosedWindow,
  lienClosedKeepToast,
  lienClosedLetGoConfirm,
  lienClosedLetGoToast,
  lienClosedReason,
  lienClosedRecordToast,
  lienClosedWalkWords,
  type LienClosedAnswer,
  type LienClosedFacts,
} from '../../lib/jobs/lienClosedEnd'
import { keepCollectingLienClosed, letLienClosedJobGo, readLienClosedFirmWarning, recordLienMonthsClosed } from '../../lib/jobs/lienClosedEndIo'

/**
 * The window a chip at a closed end opens (the owner's ask and pick of 2026-11-18; the words and the rule are
 * `lienClosedEnd.ts`, the writes `lienClosedEndIo.ts`). It says what closed, on which day, and where that day is
 * counted from. Then it asks what to do.
 *
 * A job whose lien day has passed: *The date is wrong* (the door to the last day of work, with *Record the filing ›*
 * under it), *Keep collecting* as the filled press, and *Let it go*, which asks once more before it marks the job
 * Uncollectible. A month whose notice window closed while the lien day is ahead: *Send a late notice*, *The date is
 * wrong*, *Record it closed*.
 *
 * It walks a bin's papers: each answer drops its paper and shows the next, and *Next ›* passes one over. A door closes
 * the window and opens where the date or the paper is fixed. The app counts the days and does not judge the law.
 */

/** One job at a closed end, as the desk hands it over: the kernel's facts and the payer the Legal desk's warning is read by. */
export type LienClosedPaper = { jobId: string; facts: LienClosedFacts; gcCustomerId: string | null; customerId: string | null }

type Props = {
  /** The papers to walk, in the bin's order. */
  jobIds: ReadonlyArray<string>
  /** The paper the window opens on. */
  startJobId: string
  /** The job as the desk holds it now; null once it has left the closed end. */
  paperFor: (jobId: string) => LienClosedPaper | null
  authUserId: string | null
  authName: string
  authRole: string | null
  /** `changed` true once an answer was saved. */
  onClose: (changed: boolean) => void
  /** Told after each saved answer, so the desk reads again while the window walks on. */
  onChanged: () => void
  onSetLastWork: (jobId: string) => void
  onRecordFiling: (jobId: string) => void
  onDraftLateNotice: (jobId: string) => void
  zIndex?: number
}

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const line: CSSProperties = { margin: 0, fontSize: '0.8125rem', lineHeight: 1.45 }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const LOOK: Record<LienClosedAnswer['look'], CSSProperties> = {
  filled: { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' },
  door: { ...btn, color: 'var(--text-link)' },
  plain: btn,
}
const DEAD: CSSProperties = { border: '1px solid transparent', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const linkDoor: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', borderRadius: 3 }

export default function LienClosedWindow({ jobIds, startJobId, paperFor, authUserId, authName, authRole, onClose, onChanged, onSetLastWork, onRecordFiling, onDraftLateNotice, zIndex = 1200 }: Props) {
  useModalStackEntry()
  const { showToast } = useToastContext()
  // The papers still to answer, and the one on screen. An answered paper is dropped here at once; the desk's own read follows.
  const [left, setLeft] = useState<string[]>(() => (jobIds.includes(startJobId) ? [...jobIds] : [startJobId, ...jobIds]))
  const [at, setAt] = useState(startJobId)
  const [changed, setChanged] = useState(false)
  const [busy, setBusy] = useState<LienClosedAnswer['key'] | null>(null)
  const [armed, setArmed] = useState(false)
  const [note, setNote] = useState('')
  const [firmWarning, setFirmWarning] = useState<string | null>(null)

  const paper = paperFor(at)
  const win = useMemo(() => (paper ? buildLienClosedWindow(paper.facts) : null), [paper])
  const total = jobIds.length
  const index = Math.max(0, left.indexOf(at))

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const changedRef = useRef(changed)
  changedRef.current = changed

  /** Show the paper after this one, or close when none is left. `drop` takes this one off the walk. */
  const move = (drop: boolean, nowChanged = changedRef.current) => {
    const rest = drop ? left.filter((id) => id !== at) : left
    if (rest.length === 0 || (!drop && rest.length === 1)) {
      closeRef.current(nowChanged)
      return
    }
    const next = drop ? rest[Math.min(index, rest.length - 1)]! : rest[(index + 1) % rest.length]!
    setLeft(rest)
    setAt(next)
  }

  // A paper that left the closed end while the window was open (its date was fixed elsewhere, or the desk read again) is passed over.
  useEffect(() => {
    if (!win && busy == null) move(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, busy, at])

  // Each paper starts clean: no armed press, no note carried from the last one.
  useEffect(() => {
    setArmed(false)
    setNote('')
    setFirmWarning(null)
  }, [at])

  // When the lien day has passed, the Legal desk's warning is read once per paper: a law firm that holds the account is told nothing by the mark.
  const gone = win?.kind === 'gone'
  const payerGc = paper?.gcCustomerId ?? null
  const payerCustomer = paper?.customerId ?? null
  useEffect(() => {
    if (!gone) return
    let live = true
    void readLienClosedFirmWarning({ gc_customer_id: payerGc, customer_id: payerCustomer }).then((w) => {
      if (live) setFirmWarning(w)
    })
    return () => {
      live = false
    }
  }, [gone, at, payerGc, payerCustomer])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy != null) return
      e.stopPropagation()
      e.preventDefault()
      closeRef.current(changedRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy])

  const saved = () => {
    setChanged(true)
    onChanged()
    move(true, true)
  }

  const answer = async (a: LienClosedAnswer) => {
    if (!paper || !win || busy != null || a.dead) return
    const f = paper.facts
    // The three doors close the window and open where the date or the paper is fixed.
    if (a.key === 'date' || a.key === 'late_notice') {
      onClose(changed)
      if (a.key === 'date') onSetLastWork(paper.jobId)
      else onDraftLateNotice(paper.jobId)
      return
    }
    if (a.key === 'let_go' && !armed) {
      setArmed(true)
      return
    }
    setBusy(a.key)
    try {
      if (a.key === 'keep') {
        const result = await keepCollectingLienClosed({ jobId: paper.jobId, reason: lienClosedReason(f, 'keep', note), inCollections: Boolean(f.collectionsSince) })
        const toast = lienClosedKeepToast(f, result)
        showToast(toast.words, toast.tone)
      } else if (a.key === 'let_go') {
        const result = await letLienClosedJobGo({ jobId: paper.jobId, reason: lienClosedReason(f, 'let_go', note), inCollections: Boolean(f.collectionsSince), authRole })
        const toast = lienClosedLetGoToast(f.number, result.stripe)
        showToast(toast.words, toast.tone)
      } else {
        const months = f.months.map((m) => m.key)
        await recordLienMonthsClosed({ jobId: paper.jobId, months, userId: authUserId, userName: authName })
        showToast(lienClosedRecordToast(f.number, months), 'success')
      }
      saved()
    } catch (e) {
      showToast(`${f.number} is as it was: ${formatErrorMessage(e, 'the answer was not saved')}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const title = win?.title ?? 'A window closed'
  const walk = lienClosedWalkWords(total - left.length + index, total)
  const confirm = paper ? lienClosedLetGoConfirm(paper.facts.number) : null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="lien-closed-window"
      data-lien-closed-kind={win?.kind ?? 'none'}
      data-lien-closed-job={at}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && busy == null) onClose(changed)
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(560px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
            {win?.sub ? <div data-lien-closed-sub style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{win.sub}</div> : null}
          </div>
          {walk ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: 3 }}>
              <span data-lien-closed-walk>{walk}</span>
              {left.length > 1 ? (
                <>
                  {' · '}
                  <button type="button" data-lien-closed-next disabled={busy != null} onClick={() => move(false)} style={linkDoor}>
                    Next ›
                  </button>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.8rem', alignContent: 'start' }}>
          {win && paper ? (
            <>
              <section style={{ display: 'grid', gap: '0.2rem' }}>
                <h3 style={head}>What closed</h3>
                {win.closed.map((words) => (
                  <p key={words} data-lien-closed-what style={line}>
                    {words}
                  </p>
                ))}
              </section>
              {win.open ? (
                <section style={{ display: 'grid', gap: '0.2rem' }}>
                  <h3 style={head}>What is still open</h3>
                  <p data-lien-closed-open style={{ ...line, color: 'var(--text-amber-800)' }}>
                    {win.open}
                  </p>
                </section>
              ) : null}
              <section style={{ display: 'grid', gap: '0.2rem' }}>
                <h3 style={head}>Where that day comes from</h3>
                <p data-lien-closed-from style={line}>
                  {win.from.words}
                </p>
                <p style={{ ...line, color: 'var(--text-muted)' }}>{win.from.note}</p>
              </section>
              {win.kind === 'gone' && paper.facts.canAnswer ? (
                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span style={head}>{LIEN_CLOSED_NOTE_LABEL}</span>
                  <input
                    type="text"
                    data-lien-closed-note
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={LIEN_CLOSED_NOTE_EXAMPLE}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)' }}
                  />
                </label>
              ) : null}
              <section style={{ display: 'grid', gap: '0.3rem' }}>
                <h3 style={head}>What do you want to do?</h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                  {win.answers.map((a, i) => {
                    const off = Boolean(a.dead) || busy != null
                    const asking = a.key === 'let_go' && armed && confirm
                    return (
                      <div key={a.key} data-lien-closed-answer={a.key} style={{ display: 'grid', gap: 4, padding: '0.6rem 0.75rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px' }}>
                          <span style={{ flex: '1 1 auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>{a.title}</span>
                          {asking ? null : (
                            <button type="button" data-lien-closed-press={a.key} disabled={off} onClick={() => void answer(a)} style={{ ...LOOK[a.look], ...(off ? DEAD : null) }}>
                              {busy === a.key ? 'Saving…' : a.press}
                            </button>
                          )}
                        </div>
                        <p style={{ ...line, color: 'var(--text-700)' }}>{a.words}</p>
                        {a.dead ? (
                          <p data-lien-closed-dead={a.key} style={{ ...line, color: 'var(--text-muted)' }}>
                            {a.dead}
                          </p>
                        ) : null}
                        {a.also ? (
                          <p style={{ ...line, color: 'var(--text-muted)' }}>
                            {a.also.ask}{' '}
                            <button
                              type="button"
                              className="lienJobDoor"
                              data-lien-closed-door={a.also.key}
                              disabled={busy != null}
                              onClick={() => {
                                onClose(changed)
                                onRecordFiling(paper.jobId)
                              }}
                              style={linkDoor}
                            >
                              {a.also.door}
                            </button>
                          </p>
                        ) : null}
                        {a.key === 'let_go' && firmWarning ? (
                          <p data-lien-closed-firm style={{ ...line, color: 'var(--text-amber-800)' }}>
                            {firmWarning}
                          </p>
                        ) : null}
                        {asking ? (
                          <div data-lien-closed-confirm style={{ display: 'grid', gap: 6 }}>
                            <p style={{ ...line, fontWeight: 600 }}>{confirm.ask}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <button type="button" data-lien-closed-press="let_go_yes" disabled={busy != null} onClick={() => void answer(a)} style={{ ...LOOK.plain, borderColor: 'var(--text-red-700)', color: 'var(--text-red-700)', ...(busy != null ? DEAD : null) }}>
                                {busy === 'let_go' ? 'Marking…' : confirm.yes}
                              </button>
                              <button type="button" data-lien-closed-press="let_go_no" disabled={busy != null} onClick={() => setArmed(false)} style={btn}>
                                {confirm.no}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          ) : (
            <p style={{ ...line, color: 'var(--text-muted)' }}>This paper is no longer at a closed end.</p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{LIEN_CLOSED_KEPT_WORDS}</span>
          <button type="button" style={btn} disabled={busy != null} onClick={() => onClose(changed)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
