import { useEffect, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { setPoCodeStatedNeed } from '../../lib/materials/setPoCodeStatedNeed'
import {
  STATED_NEED_ADD_LINK,
  STATED_NEED_ASK_AFTER,
  STATED_NEED_CHANGE_LINK,
  STATED_NEED_COLUMN,
  STATED_NEED_PLACEHOLDER,
  STATED_NEED_SAVE_LABEL,
  normalizeStatedNeed,
} from '../../lib/materials/poCodeStatedNeed'

const LINK_STYLE = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-blue-700)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.8125rem',
} as const

/**
 * What they said they need, written down after the code (v2.3718). Two shapes,
 * one writer (`set_material_po_generator_stated_need`):
 *
 * - `mode="ask"` — the just-minted card on both doors. Nothing written down yet →
 *   the question is open, with the box focused, while the tech is still on the
 *   line. Once written → the claim under its "Said they need" label, with *change*.
 * - `mode="link"` — a ledger row. Nothing written down → *add what it was for…*;
 *   written → the claim (and *change*, unless the caller turns it off for a
 *   phone list). The link opens a one-line box in place.
 *
 * The parent owns the row: `onSaved` hands it the stored value (trimmed, null
 * when cleared) and it rewrites its own state — no refetch.
 */
export function StatedNeedEditor({
  entryId,
  current,
  mode,
  compact = false,
  changeLink = true,
  onSaved,
}: {
  entryId: string
  current: string | null
  mode: 'ask' | 'link'
  /** Tighter paddings for a phone list or the phone result screen. */
  compact?: boolean
  /** Show *change* beside a claim that is already written down (default on; a phone list turns it off). */
  changeLink?: boolean
  onSaved: (notes: string | null) => void
}) {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(mode === 'ask' && !current)
  const [text, setText] = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // A new code on the same card (Done → mint again) resets the box.
  useEffect(() => {
    setOpen(mode === 'ask' && !current)
    setText(current ?? '')
  }, [entryId, mode, current])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function save() {
    if (saving) return
    const next = normalizeStatedNeed(text)
    if (next === normalizeStatedNeed(current)) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const stored = await setPoCodeStatedNeed(entryId, next)
      onSaved(stored)
      setOpen(false)
      showToast(stored ? 'Written down.' : 'Cleared.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not write it down'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (open) {
    const nothingToWrite = !normalizeStatedNeed(text) && !current
    return (
      <div data-stated-need-editor style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
        {mode === 'ask' ? (
          <label htmlFor={`stated-need-${entryId}`} style={{ fontSize: compact ? '0.8125rem' : '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            {STATED_NEED_ASK_AFTER}
          </label>
        ) : null}
        <input
          ref={inputRef}
          id={`stated-need-${entryId}`}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            } else if (e.key === 'Escape') {
              setText(current ?? '')
              setOpen(mode === 'ask' && !current)
            }
          }}
          placeholder={STATED_NEED_PLACEHOLDER}
          aria-label={mode === 'ask' ? STATED_NEED_ASK_AFTER : STATED_NEED_COLUMN}
          disabled={saving}
          style={{ width: '100%', boxSizing: 'border-box', padding: compact ? '0.45rem 0.55rem' : '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: compact ? '0.875rem' : '0.9375rem', background: 'var(--surface)', color: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || nothingToWrite}
            style={{ padding: compact ? '0.4rem 0.8rem' : '0.45rem 1rem', border: 'none', borderRadius: 6, background: saving || nothingToWrite ? '#93c5fd' : '#2563eb', color: 'white', fontWeight: 600, cursor: saving || nothingToWrite ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: compact ? '0.8125rem' : '0.875rem' }}
          >
            {saving ? 'Writing…' : STATED_NEED_SAVE_LABEL}
          </button>
          {mode === 'link' || current ? (
            <button
              type="button"
              onClick={() => {
                setText(current ?? '')
                setOpen(false)
              }}
              disabled={saving}
              style={{ ...LINK_STYLE, color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>optional — in their words</span>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'ask') {
    // Written down: the claim under its label, as the phone result screen has shown it since v2.3599.
    return (
      <div
        data-po-stated-need
        style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderLeft: '3px solid var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: '0 8px 8px 0', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{STATED_NEED_COLUMN}</div>
          {changeLink ? (
            <button type="button" onClick={() => setOpen(true)} style={{ ...LINK_STYLE, fontSize: '0.75rem' }}>
              {STATED_NEED_CHANGE_LINK}
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'pre-wrap' }}>{current}</div>
      </div>
    )
  }

  return current ? (
    <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ whiteSpace: 'pre-wrap' }}>{current}</span>
      {changeLink ? (
        <button type="button" onClick={() => setOpen(true)} style={{ ...LINK_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {STATED_NEED_CHANGE_LINK}
        </button>
      ) : null}
    </span>
  ) : (
    <button type="button" onClick={() => setOpen(true)} style={LINK_STYLE}>
      {STATED_NEED_ADD_LINK}
    </button>
  )
}
