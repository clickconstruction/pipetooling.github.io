import { useState } from 'react'
import { DECLINE_REASONS, type DeclineReason } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: why a company is out (the owner, 2026-10-04: "if I click one of these
 * buttons I would like to record a reason that stays with the job and the sub"). Opens under
 * Will not do it or Cannot do it; Save takes them off the ask with the reason kept.
 */
export function GcDeclineForm({
  company,
  why,
  onSave,
  onCancel,
}: {
  company: string
  why: 'wont' | 'cant'
  onSave: (reason: DeclineReason, note: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null)
  const [note, setNote] = useState('')
  const ready = reason !== null && (reason !== 'other' || note.trim() !== '')
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ marginTop: '0.5rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.45rem' }}
    >
      <div style={{ fontSize: '0.9rem' }}>
        <strong>Why {why === 'wont' ? `will ${company} not do it` : `can ${company} not do it`}?</strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>It stays with this job and with {company}.</span>
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
                padding: '0.25rem 0.7rem',
                borderRadius: 999,
                border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
                fontWeight: on ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <input
        style={{ ...input, width: '100%', boxSizing: 'border-box' }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={reason === 'other' ? 'What they said' : 'Their words, if they gave any (optional)'}
        aria-label="Their words"
      />
      <span style={{ display: 'flex', gap: '0.4rem' }}>
        <Btn kind="primary" disabled={!ready} onClick={() => reason && onSave(reason, note)}>
          Save and take them off
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </span>
    </div>
  )
}
