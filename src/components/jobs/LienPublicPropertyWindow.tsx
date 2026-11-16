import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  buildLienPublicWindow,
  lienPublicAttorneyNote,
  lienPublicPressDoes,
  lienPublicPressLabel,
  lienPublicPressWords,
  type LienPaymentBondAnswer,
  type LienPublicPressWords,
} from '../../lib/jobs/lienPublicProperty'
import { readLienPublicProperty, setLienPublicAnswer, type LienPublicPropertyRead } from '../../lib/jobs/lienPublicPropertyIo'

/**
 * Take this property off the lien path? (v2.7443, Taunya's ask of 2026-11-16 on job 883, the second drawing she
 * approved, part 3.) One window for the property, not one per paper: the answer belongs to the property record, so
 * every job at the address leaves the lien path together, now and later.
 *
 * It lists each job at the property that owes money or has a lien paper, with what already went out on it, ticked
 * when it owes money. A ticked job also goes on the attorney's list (the Collections flag) with the reason and what
 * went out, unless the flag will hold it, which the window says before the press. The press acts on what is ready and
 * names what it held (`set_property_lien_public_answer`). Nothing is filed, voided or deleted.
 */
type Props = {
  addressId: string
  /** `answered` true once the property was answered public. */
  onClose: (answered: boolean) => void
  /** Above Edit Job inside the Job window by default. */
  zIndex?: number
}

const BOND_CHOICES: ReadonlyArray<{ value: LienPaymentBondAnswer; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Not known yet' },
]

const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.95rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const press: CSSProperties = { ...btn, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }

export default function LienPublicPropertyWindow({ addressId, onClose, zIndex = 1200 }: Props) {
  // On the modal stack, so the window underneath (Edit Job, the Lien desk's pane) leaves Esc to this one.
  useModalStackEntry()
  const { showToast } = useToastContext()
  const [read, setRead] = useState<LienPublicPropertyRead | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [reason, setReason] = useState('')
  const [bond, setBond] = useState<LienPaymentBondAnswer>('unknown')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<LienPublicPressWords | null>(null)

  useEffect(() => {
    let live = true
    setFailure(null)
    readLienPublicProperty(addressId)
      .then((r) => {
        if (!live) return
        const w = buildLienPublicWindow({ address: r.address, ownerName: r.ownerName, jobs: r.jobs })
        setRead(r)
        setTicked(new Set(w.jobs.filter((j) => j.ticked).map((j) => j.jobId)))
        setReason(w.reason)
        // Every listed job already says the same about its bond: start there.
        const known = [...new Set(r.jobs.filter((j) => w.jobs.some((x) => x.jobId === j.jobId)).map((j) => j.bond))]
        setBond(known.length === 1 && known[0] ? known[0] : 'unknown')
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
  const answered = outcome !== null

  // Esc closes this window alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      e.stopPropagation()
      e.preventDefault()
      closeRef.current(answered)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, answered])

  const toggle = (jobId: string) =>
    setTicked((cur) => {
      const next = new Set(cur)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })

  const takeOff = async () => {
    if (!win || busy || !reasonGiven) return
    setBusy(true)
    try {
      const res = await setLienPublicAnswer({
        addressId,
        answer: 'public',
        reason,
        jobs: win.jobs.filter((j) => ticked.has(j.jobId)).map((j) => ({ job_id: j.jobId, note: lienPublicAttorneyNote(reason, j.wentOut) })),
        // Not known yet leaves each job's own answer as it is.
        bond: bond === 'unknown' ? null : bond,
      })
      const words = lienPublicPressWords(res.jobs, (id) => win.jobs.find((j) => j.jobId === id)?.number ?? 'A job')
      showToast(words.line, words.tone)
      if (words.held.length) setOutcome(words)
      else onClose(true)
    } catch (e) {
      showToast(`The property is still on the lien path: ${formatErrorMessage(e, 'the answer was not saved')}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doesLines = win ? lienPublicPressDoes(win.jobs, ticked) : []
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={win?.title ?? 'Take this property off the lien path?'}
      data-testid="lien-public-window"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && !busy) onClose(answered)
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(600px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>{win?.title ?? 'Take this property off the lien path?'}</h2>
          {win?.sub ? <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-lien-public-sub>{win.sub}</div> : null}
        </div>

        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
          {failure ? (
            <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>The property could not be read: {failure}</span>
              <button type="button" style={btn} onClick={() => setTries((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !win ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the jobs at this property…</p>
          ) : outcome ? (
            <div data-lien-public-held style={{ display: 'grid', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>{outcome.line}</p>
              {outcome.head ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{outcome.head}</p> : null}
              {outcome.held.map((h) => (
                <div key={`${h.jobId ?? h.number}`} data-lien-public-held-job={h.jobId ?? ''} style={{ display: 'grid', gap: 2, padding: '0.45rem 0.6rem', border: '1px solid var(--border-amber)', borderRadius: 7, background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
                  <strong>{h.number}</strong>
                  <span style={{ color: 'var(--text-amber-800)' }}>{h.reason}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <section style={{ display: 'grid', gap: '0.4rem' }}>
                <h3 style={head}>Jobs at this property</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>A ticked job goes on the attorney’s list with what went out.</p>
                {win.jobs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No job here owes money or has a lien paper. Any job here later stays off the lien path too.</p>
                ) : (
                  win.jobs.map((j) => (
                    <label key={j.jobId} data-lien-public-job={j.jobId} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.15rem 0.6rem', alignItems: 'baseline', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={ticked.has(j.jobId)} onChange={() => toggle(j.jobId)} aria-label={`Put ${j.label} on the attorney’s list`} style={{ alignSelf: 'center' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.label}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{j.unpaidWords}</span>
                      <span style={{ gridColumn: '2 / 4', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{j.wentOut}</span>
                      {j.listNote ? (
                        <span data-lien-public-list-note style={{ gridColumn: '2 / 4', fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>
                          {j.listNote}
                        </span>
                      ) : null}
                    </label>
                  ))
                )}
              </section>

              <section style={{ display: 'grid', gap: '0.35rem' }}>
                <h3 style={head}>Why · kept on each job</h3>
                <textarea
                  aria-label="Why this property is off the lien path"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 7, font: 'inherit', resize: 'vertical' }}
                />
                {reasonGiven ? null : <span style={{ fontSize: '0.75rem', color: 'var(--text-red-700)' }}>Say why in a few words. The reason goes with each job.</span>}
              </section>

              <section style={{ display: 'grid', gap: '0.35rem' }}>
                <h3 style={head}>Is there a payment bond on the project?</h3>
                <div role="radiogroup" aria-label="Is there a payment bond on the project?" style={{ display: 'inline-flex', width: 'fit-content', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden' }}>
                  {BOND_CHOICES.map((c, i) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={bond === c.value}
                      data-lien-public-bond={c.value}
                      onClick={() => setBond(c.value)}
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8125rem', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-strong)', background: bond === c.value ? 'var(--bg-blue-tint)' : 'var(--surface)', color: bond === c.value ? 'var(--text-blue-700)' : 'var(--text-700)', fontWeight: bond === c.value ? 700 : 500, cursor: 'pointer' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </section>

              <section data-lien-public-does style={{ display: 'grid', gap: '0.3rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                <h3 style={head}>What this press does</h3>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: 2, fontSize: '0.8125rem' }}>
                  {doesLines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)' }}>
          {outcome ? (
            <button type="button" style={press} onClick={() => onClose(true)}>
              Close
            </button>
          ) : (
            <>
              <button type="button" style={btn} disabled={busy} onClick={() => onClose(false)}>
                Cancel
              </button>
              <button
                type="button"
                data-testid="lien-public-take-off"
                style={{ ...press, ...(win && reasonGiven && !busy ? null : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }) }}
                disabled={!win || !reasonGiven || busy}
                onClick={() => void takeOff()}
              >
                {busy ? 'Taking it off…' : lienPublicPressLabel(win?.jobs.length ?? 0)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
