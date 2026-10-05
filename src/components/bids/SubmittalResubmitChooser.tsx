/**
 * Bids → Submittals, step 7: "Start a Rev 2 draft" — which rows go on it (2026-10-05).
 *
 * Step 7 had two buttons, one for the rows that still need the GC and one for every row, and the
 * owner asked whether they did the same thing. One button opens this instead: the two choices sit
 * beside what each does to the approved rows. It renders and reports only; the words are
 * `resubmitChooser`'s and the draft is the tab's to build.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import type { ResubmitChooserWords, ResubmitRows } from '../../lib/submittals/reviewDecisions'

const Z = 10060

export function SubmittalResubmitChooser({
  words,
  choice,
  busy,
  onChoose,
  onCancel,
  onConfirm,
}: {
  words: ResubmitChooserWords
  choice: ResubmitRows
  /** The draft is being built: Cancel, the backdrop and Esc hold still. */
  busy: boolean
  onChoose: (choice: ResubmitRows) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    confirmRef.current?.focus()
  }, [])
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || busy) return
      e.stopPropagation()
      onCancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [busy, onCancel])

  const row = (on: boolean): CSSProperties => ({ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0.6rem', border: on ? '1px solid #3b82f6' : '1px solid var(--border)', background: on ? 'var(--bg-blue-tint)' : 'transparent', borderRadius: 8, cursor: 'pointer', marginTop: '0.4rem' })
  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={words.title} data-testid="resubmit-chooser" style={{ background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 10, maxWidth: 460, width: '100%', maxHeight: '100%', overflowY: 'auto', padding: '1.1rem 1.25rem 1rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 600 }}>{words.title}</h2>
        <p id="resubmit-chooser-lead" style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{words.lead}</p>
        <div role="radiogroup" aria-labelledby="resubmit-chooser-lead">
          {words.choices.map((c) => (
            <label key={c.key} style={row(choice === c.key)} data-testid={`resubmit-rows-${c.key}`}>
              <input type="radio" name="resubmit-rows" checked={choice === c.key} disabled={busy} onChange={() => onChoose(c.key)} style={{ marginTop: '0.2rem' }} />
              <span>
                <b style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600 }}>{c.label}</b>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{c.detail}</span>
              </span>
            </label>
          ))}
        </div>
        <p style={{ margin: '0.7rem 0 0', fontSize: '0.85rem', lineHeight: 1.45 }} data-testid="resubmit-chooser-foot">{words.foot}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text-700)', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={busy} style={{ padding: '0.5rem 1rem', background: '#16a34a', border: 'none', borderRadius: 6, color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: busy ? 'wait' : 'pointer' }}>
            {words.confirmLabel[choice]}
          </button>
        </div>
      </div>
    </div>
  )
}
