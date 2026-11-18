import { useState } from 'react'
import { localCalendarDayKey } from '../../utils/dateUtils'

/**
 * Set Call back date and time. Moved out of `src/pages/Prospects.tsx`: the three boxes are its own, opened on
 * this moment; the save stays with the page, which holds the one `saving` flag every press on the deck shares.
 */
export function ProspectCallbackModal({
  saving,
  onSave,
  onClose,
}: {
  saving: boolean
  /** The day, the time and the note, each as its box holds it. */
  onSave: (date: string, time: string, note: string) => void
  onClose: () => void
}) {
  const [opened] = useState(() => new Date())
  const [callbackDate, setCallbackDate] = useState(() => localCalendarDayKey(opened))
  const [callbackTime, setCallbackTime] = useState(() => opened.toTimeString().slice(0, 5))
  const [callbackNote, setCallbackNote] = useState('')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={() => !saving && onClose()}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>Set Call back date and time</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Date</span>
            <input
              type="date"
              value={callbackDate}
              onChange={(e) => setCallbackDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Time</span>
            <input
              type="time"
              value={callbackTime}
              onChange={(e) => setCallbackTime(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Note</span>
            <input
              type="text"
              value={callbackNote}
              onChange={(e) => setCallbackNote(e.target.value)}
              placeholder="Optional note (e.g. discuss pricing)"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => onSave(callbackDate, callbackTime, callbackNote)}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
