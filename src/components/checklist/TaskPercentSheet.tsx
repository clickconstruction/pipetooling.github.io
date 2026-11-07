import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PERCENT_CHIPS, WHAT_IS_LEFT_MAX_CHARS, type RingState } from '../../lib/taskProgress'

/**
 * Task cards (#273, PR 3): the sheet a tap on the ring opens. *Where does it stand?*, the three chips (25 · 50 · 75),
 * one optional *What is left?* line, **Set N%**, and under them one green **Done**, so finishing stays two taps:
 * the ring, then Done. A card with Done when… lines reads its percent from the ticks, so the chips are not drawn and
 * the sheet says so; Done still stands. A bottom sheet on a phone, a centered card on a desk (the task card's shape).
 * The photo tile joins the sheet in PR 4.
 */
export function TaskPercentSheet({
  open,
  title,
  state,
  lastMoved,
  onSet,
  onDone,
  onClose,
  doneWords = '✓ Done',
}: {
  open: boolean
  title: string
  state: RingState
  /** *was 50% on Tue 3:12 PM*, or null when nothing has moved. */
  lastMoved?: string | null
  /** Resolves true once the percent landed; the sheet closes then. */
  onSet: (percent: number, words: string) => Promise<boolean>
  onDone: () => void | Promise<void>
  onClose: () => void
  doneWords?: string
}) {
  const isMobile = useIsMobile()
  const [pick, setPick] = useState<number | null>(null)
  const [words, setWords] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPick(null)
    setWords('')
    setSaving(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSet = pick !== null && !saving && !state.derived
  const setPress = async () => {
    if (pick === null || !canSet) return
    setSaving(true)
    try {
      const ok = await onSet(pick, words)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }
  const donePress = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onDone()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1200, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-percent-sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box' }}
        data-testid="task-percent-sheet"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id="task-percent-sheet-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            Where does it stand?
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{title}</span>
          {lastMoved ? <> · {lastMoved}</> : null}
        </p>

        {state.derived ? (
          <p style={{ margin: '0 0 14px', fontSize: '0.95rem', lineHeight: 1.45 }} data-testid="task-percent-sheet-derived">
            The ring follows the lines: {state.ticked} of {state.lines} ticked reads {state.percent}%. Tick the lines on the card to move it.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }} role="group" aria-label="Percent">
              {PERCENT_CHIPS.map((p) => {
                const on = pick === p
                const was = pick === null && state.percent === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPick(p)}
                    aria-pressed={on}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                      border: on ? '2px solid #2563eb' : was ? '2px solid var(--text-600)' : '2px solid var(--border-strong)',
                      background: on ? '#2563eb' : 'var(--surface)',
                      color: on ? 'white' : was ? 'var(--text-muted)' : 'var(--text-strong)',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={words}
              onChange={(e) => setWords(e.target.value.slice(0, WHAT_IS_LEFT_MAX_CHARS))}
              placeholder="What is left? (optional)"
              aria-label="What is left"
              maxLength={WHAT_IS_LEFT_MAX_CHARS}
              style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, marginBottom: 10 }}
            />
            <button
              type="button"
              onClick={() => void setPress()}
              disabled={!canSet}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: 'none',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: canSet ? 'pointer' : 'not-allowed',
                background: canSet ? '#2563eb' : DEAD_PRESS_FILL,
                color: canSet ? 'white' : DEAD_PRESS_TEXT,
              }}
            >
              {saving && pick !== null ? '…' : pick === null ? 'Pick a percent' : `Set ${pick}%`}
            </button>
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: '10px 0' }}>or</div>
          </>
        )}

        {!state.done ? (
          <button
            type="button"
            onClick={() => void donePress()}
            disabled={saving}
            style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? DEAD_PRESS_FILL : '#16a34a', color: saving ? DEAD_PRESS_TEXT : 'white' }}
          >
            {doneWords}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
