import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  LIEN_JOB_PATH_BACK_DOES,
  LIEN_JOB_PATH_BACK_REASON_EXAMPLE,
  LIEN_JOB_PATH_BILL_NOTE,
  LIEN_JOB_PATH_LIST_TICK,
  LIEN_JOB_PATH_OFF_TITLE,
  LIEN_JOB_PATH_REASON_EXAMPLE,
  buildLienJobPathWindow,
  lienJobPathBackLabel,
  lienJobPathBackToast,
  lienJobPathOffDoes,
  lienJobPathOffLabel,
  lienJobPathOffToast,
} from '../../lib/jobs/lienJobPathWindow'
import { readLienJobPath, setJobLienPathAnswer, type LienJobPathRead } from '../../lib/jobs/lienJobPathIo'

/**
 * Take this job off the lien path, or put it back (the *not lienable* train, PR 3; the owner's pick of 2026-11-16).
 * One window per job. It reads the job itself, so it opens the same from the Lien desk and from the job's own Lien
 * window, and it shows the way off or the way back by where the job stands.
 *
 * The app does not judge what a bill is for: the window shows the bill's own lines and asks for the reason in the
 * person's words. Nothing is filed, voided or deleted by either press.
 */
type Props = {
  jobId: string
  /** `changed` true once the job's place on the lien path changed. */
  onClose: (changed: boolean) => void
  zIndex?: number
}

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }

export default function LienJobPathWindow({ jobId, onClose, zIndex = 1200 }: Props) {
  useModalStackEntry()
  const { showToast } = useToastContext()
  const [read, setRead] = useState<LienJobPathRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [reason, setReason] = useState('')
  const [attorneyList, setAttorneyList] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    setFailure(null)
    readLienJobPath(jobId)
      .then((r) => {
        if (live) setRead(r)
      })
      .catch((e: unknown) => {
        if (live) setFailure(formatErrorMessage(e, 'the job could not be read'))
      })
    return () => {
      live = false
    }
  }, [jobId, tries])

  const win = useMemo(() => (read ? buildLienJobPathWindow(read) : null), [read])
  const reasonGiven = reason.trim() !== ''
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      e.stopPropagation()
      e.preventDefault()
      closeRef.current(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy])

  const back = win?.mode === 'back'
  const asksList = Boolean(win && !back && win.list.tick && attorneyList)

  const act = async () => {
    if (!read || !win || busy || !reasonGiven) return
    setBusy(true)
    try {
      if (back) {
        await setJobLienPathAnswer({ jobId, answer: 'on_path', reason })
        showToast(lienJobPathBackToast(read.number), 'success')
      } else {
        const result = await setJobLienPathAnswer({ jobId, answer: 'off_path', reason, attorneyList: asksList })
        const toast = lienJobPathOffToast(read.number, asksList, result)
        showToast(toast.words, toast.tone)
      }
      onClose(true)
    } catch (e) {
      showToast(`${read.number} is still ${back ? 'off' : 'on'} the lien path: ${formatErrorMessage(e, 'the answer was not saved')}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const live = Boolean(win) && reasonGiven && !busy
  const title = win?.title ?? LIEN_JOB_PATH_OFF_TITLE
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="lien-job-path-window"
      data-lien-job-path-mode={win?.mode ?? 'reading'}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !busy) onClose(false)
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(540px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>{title}</h2>
          {win?.sub ? <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{win.sub}</div> : null}
        </div>
        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.8rem', alignContent: 'start' }}>
          {failure ? (
            <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>The job could not be read: {failure}</span>
              <button type="button" style={btn} onClick={() => setTries((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !win ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the job…</p>
          ) : (
            <>
              {back ? (
                win.cameOff ? (
                  <p data-lien-job-path-came-off style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    {win.cameOff}
                  </p>
                ) : null
              ) : (
                <section style={{ display: 'grid', gap: '0.3rem' }}>
                  <h3 style={head}>What this job billed</h3>
                  {win.billLines.length ? (
                    win.billLines.map((l, i) => (
                      <div key={`${i}:${l.name}`} data-lien-job-path-bill-line style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.8125rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ minWidth: 0 }}>{l.name}</span>
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.amountWords}</span>
                      </div>
                    ))
                  ) : (
                    <p data-lien-job-path-no-lines style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      This job has no bill lines on record. Open the job to read its bills before you decide.
                    </p>
                  )}
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{LIEN_JOB_PATH_BILL_NOTE}</p>
                </section>
              )}
              <section style={{ display: 'grid', gap: '0.2rem' }}>
                <h3 style={head}>Its lien papers</h3>
                <p data-lien-job-path-went-out style={{ margin: 0, fontSize: '0.8125rem' }}>
                  {win.wentOut}
                </p>
              </section>
              <section style={{ display: 'grid', gap: '0.35rem' }}>
                <h3 style={head}>{back ? 'Why it goes back' : 'Why · kept on the job'}</h3>
                <textarea
                  aria-label={back ? 'Why this job goes back on the lien path' : 'Why this job is off the lien path'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={back ? LIEN_JOB_PATH_BACK_REASON_EXAMPLE : LIEN_JOB_PATH_REASON_EXAMPLE}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', lineHeight: 1.45, border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }}
                />
              </section>
              {!back ? (
                <section style={{ display: 'grid', gap: '0.25rem' }}>
                  {win.list.tick ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                      <input type="checkbox" data-lien-job-path-list-tick checked={attorneyList} onChange={(e) => setAttorneyList(e.target.checked)} />
                      <span>{LIEN_JOB_PATH_LIST_TICK}</span>
                    </label>
                  ) : null}
                  {win.list.line ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{win.list.line}</p> : null}
                  {win.list.note && attorneyList ? (
                    <p data-lien-job-path-list-note style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>
                      {win.list.note}
                    </p>
                  ) : null}
                </section>
              ) : null}
              <section style={{ display: 'grid', gap: '0.3rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                <h3 style={head}>What this press does</h3>
                <ol data-lien-job-path-does style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: 2, fontSize: '0.8125rem' }}>
                  {(back ? LIEN_JOB_PATH_BACK_DOES : lienJobPathOffDoes(asksList)).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)' }}>
          <button type="button" style={btn} disabled={busy} onClick={() => onClose(false)}>
            Cancel
          </button>
          <button
            type="button"
            data-testid="lien-job-path-press"
            disabled={!live}
            onClick={() => void act()}
            style={{ ...press, ...(live ? null : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }) }}
          >
            {busy ? (back ? 'Putting it back…' : 'Taking it off…') : read ? (back ? lienJobPathBackLabel(read.number) : lienJobPathOffLabel(read.number)) : 'Reading…'}
          </button>
        </div>
      </div>
    </div>
  )
}
