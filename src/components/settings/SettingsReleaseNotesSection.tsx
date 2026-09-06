import { useMemo, useState } from 'react'
import { RELEASE_NOTES } from '../../content/releaseNotes'
import type { UserRole } from '../../hooks/useAuth'
import {
  RELEASE_NOTES_PAGE_SIZE,
  describeEarlierUpdatesButton,
  releaseNotesForRole,
  releaseNotesPage,
  type ReleaseNoteKind,
} from '../../lib/releaseNotes'

const KIND_BADGE: Record<ReleaseNoteKind, { label: string; color: string }> = {
  feature: { label: 'New', color: '#16a34a' },
  fix: { label: 'Fix', color: '#d97706' },
  infra: { label: 'Infra', color: 'var(--text-muted)' },
}

type Props = {
  /** Viewer's role; notes that declare `roles` are hidden from other roles (devs and unknown see all). */
  role?: UserRole | null
}

/**
 * Settings → Release notes: the in-app update feed, one entry per release.
 * Paged (B16 / J28-F5): 15 at a time behind a "Show earlier" button instead of
 * ~1,800 cards in one commit, and role-aware (J28-F12) when a note says who it is for.
 */
export default function SettingsReleaseNotesSection({ role = null }: Props) {
  const [shown, setShown] = useState(RELEASE_NOTES_PAGE_SIZE)
  const newest = RELEASE_NOTES[0]
  const feed = useMemo(() => releaseNotesForRole(RELEASE_NOTES, role), [role])
  const page = releaseNotesPage(feed.length, shown)
  const visible = feed.slice(0, page.visible)
  const buttonLabel = describeEarlierUpdatesButton(page)
  const hiddenForRole = RELEASE_NOTES.length - feed.length

  return (
    <div>
      <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)' }}>
        Current version: <strong style={{ color: 'var(--text-strong)' }}>{newest?.version ?? '—'}</strong>. Every
        update ships with a note of what changed, newest first.
        {hiddenForRole > 0 && (
          <>
            {' '}
            Showing the {feed.length.toLocaleString('en-US')} notes that apply to your role
            {' '}({hiddenForRole.toLocaleString('en-US')} for other roles hidden).
          </>
        )}
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
      {buttonLabel && (
        <button
          type="button"
          onClick={() => setShown(page.visible + page.nextStep)}
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
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
