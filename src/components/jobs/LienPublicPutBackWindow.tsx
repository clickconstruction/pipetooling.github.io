import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { LIEN_PUBLIC_BACK_DOES, LIEN_PUBLIC_BACK_TITLE, buildLienPublicWindow, lienPublicBackLabel } from '../../lib/jobs/lienPublicProperty'
import { readLienPublicProperty, setLienPublicAnswer, type LienPublicPropertyRead } from '../../lib/jobs/lienPublicPropertyIo'

/**
 * Put this property back on the lien path (v2.7443): the answer *public* taken back, with a reason. The answer belongs
 * to the property, so every job at the address goes back on the Lien desk together. The jobs stay on the attorney's
 * list and keep their bond answer; nothing is undone there.
 */
type Props = {
  addressId: string
  /** `changed` true once the property is back on the lien path. */
  onClose: (changed: boolean) => void
  zIndex?: number
}

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }

export default function LienPublicPutBackWindow({ addressId, onClose, zIndex = 1200 }: Props) {
  useModalStackEntry()
  const { showToast } = useToastContext()
  const [read, setRead] = useState<LienPublicPropertyRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    setFailure(null)
    readLienPublicProperty(addressId)
      .then((r) => {
        if (live) setRead(r)
      })
      .catch((e: unknown) => {
        if (live) setFailure(formatErrorMessage(e, 'the property could not be read'))
      })
    return () => {
      live = false
    }
  }, [addressId, tries])

  const win = useMemo(() => (read ? buildLienPublicWindow({ address: read.address, ownerName: read.ownerName, jobs: read.jobs }) : null), [read])
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

  const putBack = async () => {
    if (!win || busy || !reasonGiven) return
    setBusy(true)
    try {
      await setLienPublicAnswer({ addressId, answer: 'unanswered', reason })
      showToast('The property is back on the lien path. Its jobs are on the Lien desk again.', 'success')
      onClose(true)
    } catch (e) {
      showToast(`The property is still off the lien path: ${formatErrorMessage(e, 'the answer was not saved')}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const live = Boolean(win) && reasonGiven && !busy
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={LIEN_PUBLIC_BACK_TITLE}
      data-testid="lien-public-put-back"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !busy) onClose(false)
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(520px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>{LIEN_PUBLIC_BACK_TITLE}</h2>
          {win?.sub ? <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{win.sub}</div> : null}
        </div>
        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.8rem', alignContent: 'start' }}>
          {failure ? (
            <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>The property could not be read: {failure}</span>
              <button type="button" style={btn} onClick={() => setTries((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !win ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the jobs at this property…</p>
          ) : (
            <>
              {win.jobs.length ? (
                <section style={{ display: 'grid', gap: '0.3rem' }}>
                  <h3 style={head}>Jobs at this property</h3>
                  {win.jobs.map((j) => (
                    <div key={j.jobId} data-lien-public-back-job={j.jobId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', fontSize: '0.8125rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{j.unpaidWords}</span>
                    </div>
                  ))}
                </section>
              ) : null}
              {read?.reason ? (
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Why it came off: <span style={{ color: 'var(--text-700)' }}>{read.reason}</span>
                </p>
              ) : null}
              <section style={{ display: 'grid', gap: '0.35rem' }}>
                <h3 style={head}>Why it goes back</h3>
                <textarea
                  aria-label="Why this property goes back on the lien path"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="For example: the county sold the lot, so the owner is private."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', lineHeight: 1.45, border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }}
                />
              </section>
              <section style={{ display: 'grid', gap: '0.3rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                <h3 style={head}>What this press does</h3>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: 2, fontSize: '0.8125rem' }}>
                  {LIEN_PUBLIC_BACK_DOES.map((l) => (
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
            data-testid="lien-public-put-back-press"
            disabled={!live}
            onClick={() => void putBack()}
            style={{ ...press, ...(live ? null : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }) }}
          >
            {busy ? 'Putting it back…' : lienPublicBackLabel(win?.jobs.length ?? 0)}
          </button>
        </div>
      </div>
    </div>
  )
}
