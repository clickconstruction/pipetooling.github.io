import { useCallback, useEffect, useState } from 'react'
import { useDailyGoalsGate } from '../contexts/DailyGoalsGateContext'

/**
 * Full-screen modal: must check every goal before continuing to the app.
 */
export default function DailyGoalsGateOverlay() {
  const { gateOpen, goals, completeGate } = useDailyGoalsGate()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const allChecked =
    goals.length > 0 && goals.every((g) => checked[g.id])

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleContinue = useCallback(async () => {
    if (!allChecked || saving) return
    setSaving(true)
    try {
      await completeGate()
      setChecked({})
    } finally {
      setSaving(false)
    }
  }, [allChecked, completeGate, saving])

  useEffect(() => {
    if (gateOpen) setChecked({})
  }, [gateOpen, goals])

  if (!gateOpen || goals.length === 0) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-goals-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '1.5rem',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 520, width: '100%', marginTop: 'clamp(1rem, 8vh, 3rem)' }}>
        <h1
          id="daily-goals-title"
          style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111827' }}
        >
          My Roles Goals
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#4b5563', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Check each item before continuing. You won&apos;t see this again until tomorrow after your first clock-in.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {goals.map((g) => (
            <li key={g.id} style={{ marginBottom: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.85rem 1rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  minHeight: 52,
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!checked[g.id]}
                  onChange={() => toggle(g.id)}
                  style={{
                    width: 22,
                    height: 22,
                    marginTop: 2,
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '1rem', lineHeight: 1.45, color: '#111827' }}>{g.body}</span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={!allChecked || saving}
          onClick={() => void handleContinue()}
          style={{
            marginTop: '1.25rem',
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            background: allChecked && !saving ? '#16a34a' : '#d1d5db',
            color: 'white',
            cursor: allChecked && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Continue to app'}
        </button>
      </div>
    </div>
  )
}
