import { useEffect, useRef, useState } from 'react'

/**
 * The Stages header's "#" micro-search (v2.1135): a round chip that expands
 * into a small digits-only field for C# / HCP numbers. Enter jumps to the
 * first matching job row (the shell owns matching + scroll/flash); Esc — or
 * blurring while empty — collapses back to the chip. Sits left of the main
 * search, which keeps its broad filter role: left = "go to a job I know",
 * right = "find jobs I half-remember". Pressing "n" anywhere on the board
 * opens it ready to type — the chip only mounts on the Pipeline header, so
 * the listener's lifecycle scopes the shortcut to the tab.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const el = target.closest('input, textarea, select, [contenteditable="true"]')
  if (!el) return false
  if (el instanceof HTMLInputElement) {
    const t = el.type
    if (t === 'button' || t === 'submit' || t === 'checkbox' || t === 'radio' || t === 'file' || t === 'reset')
      return false
  }
  return true
}

export function StagesJobNumberJumpChip({
  onJump,
}: {
  /** Attempt the jump; false = no match (the field shakes red and stays open). */
  onJump: (digits: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const [digits, setDigits] = useState('')
  const [noMatch, setNoMatch] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // "n" opens the chip from anywhere on the board — but never while typing in
  // another field, with a modifier held, or underneath an open dialog.
  useEffect(() => {
    if (open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!noMatch) return
    const t = window.setTimeout(() => setNoMatch(false), 1200)
    return () => window.clearTimeout(t)
  }, [noMatch])

  function attemptJump() {
    const trimmed = digits.trim()
    if (trimmed === '') return
    if (onJump(trimmed)) {
      setDigits('')
      setOpen(false)
    } else {
      setNoMatch(true)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Jump to a job by its C# or HCP number (press n)"
        aria-label="Jump to a job by number"
        style={{
          width: '2.1rem',
          height: '2.1rem',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-strong)',
          borderRadius: 999,
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          fontWeight: 700,
          fontSize: '0.9375rem',
          cursor: 'pointer',
        }}
      >
        #
      </button>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        flexShrink: 0,
        border: noMatch ? '2px solid var(--text-red-600)' : '2px solid #3b82f6',
        borderRadius: 999,
        padding: '0.2rem 0.6rem',
        background: 'var(--surface)',
      }}
    >
      <span aria-hidden style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>
        #
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={digits}
        onChange={(e) => {
          setDigits(e.target.value.replace(/\D/g, ''))
          setNoMatch(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') attemptJump()
          if (e.key === 'Escape') {
            setDigits('')
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (digits.trim() === '') setOpen(false)
        }}
        placeholder="C# / HCP"
        aria-label="Job number (C# or HCP) — Enter jumps to the job"
        title={noMatch ? 'No job matches that number' : 'Enter jumps to the first matching job; Esc closes'}
        style={{
          width: '4.6rem',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text-base)',
          fontSize: '0.875rem',
          fontVariantNumeric: 'tabular-nums',
          padding: '0.15rem 0',
        }}
      />
      {digits.trim() !== '' ? (
        <button
          type="button"
          onClick={attemptJump}
          title="Jump to this job (or press Enter)"
          aria-label="Jump to this job number"
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 6,
            background: '#2563eb',
            color: '#ffffff',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ⏎
        </button>
      ) : null}
    </span>
  )
}
