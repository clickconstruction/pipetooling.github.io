import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DECLINE_REASONS } from '../../lib/gc/decline'
import type { DeclineReason } from '../../lib/gc/types'
import { Btn, input } from './gcUi'

/**
 * GC mode, the real build (the Board's B4-b): why a company is out, from the design spike's
 * `GcDeclineForm.tsx` (the owner, 2026-10-04: "if I click one of these buttons I would like to
 * record a reason that stays with the job and the sub", then "make both buttons a modal"). Will not
 * do it and Cannot do it each open this window; Save takes them off the ask with the reason kept
 * (`gc_office_decline`). Escape or a click outside closes it without a change.
 */
export function GcDeclineForm({
  company,
  why,
  context,
  onSave,
  onCancel,
}: {
  company: string
  why: 'wont' | 'cant'
  /** The job and trade, under the title: "Boerne Retail Shell · Sitework". */
  context?: string
  onSave: (reason: DeclineReason, note: string) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const ready = reason !== null && (reason !== 'other' || note.trim() !== '')
  const dialogRef = useRef<HTMLDivElement | null>(null)
  // The latest Cancel, so the key listener and the first focus are set once, not on every render.
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const save = () => {
    if (!reason) return
    setBusy(true)
    setProblem(null)
    onSave(reason, note.trim())
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }

  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Why ${company} ${why === 'wont' ? 'will not' : 'cannot'} do it`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(560px, 100%)',
          border: '1px solid var(--border-strong)',
          outline: 'none',
          display: 'grid',
          gap: '0.7rem',
          padding: '1rem 1.1rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Why {why === 'wont' ? `will ${company} not do it` : `can ${company} not do it`}?</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
            {context ? `${context}. ` : ''}It stays with this job and with {company}.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="The reason">
          {DECLINE_REASONS.map((r) => {
            const on = reason === r.key
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() => setReason(r.key)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: 999,
                  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <input
          style={{ ...input, width: '100%', boxSizing: 'border-box', height: 36 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reason === 'other' ? 'What they said' : 'Their words, if they gave any (optional)'}
          aria-label="Their words"
        />
        {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Btn kind="quiet" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!ready || busy} onClick={save}>
            Save and take them off
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
