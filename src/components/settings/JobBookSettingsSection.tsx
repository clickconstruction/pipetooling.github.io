import { useState } from 'react'
import JobBookEditorPanel from './JobBookEditorPanel'

type Props = {
  onDbError: (message: string) => void
}

export default function JobBookSettingsSection({ onDbError }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Job Book (Collect Payment line items)
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <JobBookEditorPanel active={open} onDbError={onDbError} showIntro />
        </div>
      ) : null}
    </div>
  )
}
