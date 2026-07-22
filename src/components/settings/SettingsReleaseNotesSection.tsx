import { useState } from 'react'
import { RELEASE_NOTES } from '../../content/releaseNotes'
import type { ReleaseNoteKind } from '../../lib/releaseNotes'

const INITIAL_VISIBLE_COUNT = 15

const KIND_BADGE: Record<ReleaseNoteKind, { label: string; color: string }> = {
  feature: { label: 'New', color: '#16a34a' },
  fix: { label: 'Fix', color: '#d97706' },
  infra: { label: 'Infra', color: 'var(--text-muted)' },
}

/** Settings → Release notes: the in-app update feed, one entry per release. */
export default function SettingsReleaseNotesSection() {
  const [showAll, setShowAll] = useState(false)
  const newest = RELEASE_NOTES[0]
  const visible = showAll ? RELEASE_NOTES : RELEASE_NOTES.slice(0, INITIAL_VISIBLE_COUNT)
  const hiddenCount = RELEASE_NOTES.length - visible.length

  return (
    <div>
      <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)' }}>
        Current version: <strong style={{ color: 'var(--text-strong)' }}>{newest?.version ?? '—'}</strong>. Every
        update ships with a note of what changed, newest first.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {visible.map((note) => {
          const badge = KIND_BADGE[note.kind]
          return (
            <div
              key={note.version}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--surface)',
                padding: '0.75rem 1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{note.version}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: badge.color,
                    border: `1px solid ${badge.color}`,
                    borderRadius: '999px',
                    padding: '0 0.5rem',
                    lineHeight: 1.6,
                  }}
                >
                  {badge.label}
                </span>
                <span style={{ fontWeight: 600 }}>{note.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{note.date}</span>
              </div>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                {note.highlights.map((highlight, i) => (
                  <li key={i} style={{ marginBottom: '0.15rem' }}>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            marginTop: '0.75rem',
            padding: '0.4rem 0.9rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--surface)',
            color: 'var(--text-strong)',
            cursor: 'pointer',
          }}
        >
          Show {hiddenCount} earlier {hiddenCount === 1 ? 'update' : 'updates'}
        </button>
      )}
    </div>
  )
}
