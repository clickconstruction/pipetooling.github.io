import type { CSSProperties } from 'react'
import { driveLink } from '../../lib/gc/drive'
import { input } from './gcUi'
import { FIELD_HEIGHT_PX } from './GcNewProjectPickerRows'

/**
 * GC mode, the real build: the plans live in Google Drive (the owner, 2026-10-04: "I want to always
 * have it go to a Google Drive link where there is a notification that says this link is accessible
 * by anyone, this works, versus this link is only accessible by some, please correct"). Until the
 * check that opens the link without signing in lands (step 5 of the plan, `gc-drive-access`), the
 * field reads the link and says the access is not checked yet. A link only some people can open is
 * a warning, never a stop.
 */

/** The words for a link only some people can open, for the check step: what is wrong, and how to fix it in Drive. */
export const DRIVE_RESTRICTED_WORDS =
  'Our helper could not open this link without signing in to Google, so the trades cannot either. In Drive: Share → General access → Anyone with the link → Viewer.'

const notice = (tone: 'green' | 'red' | 'amber' | 'grey'): CSSProperties => ({
  padding: '0.45rem 0.6rem',
  borderRadius: 6,
  fontSize: '0.82rem',
  background: tone === 'green' ? 'var(--bg-green-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-700)' : 'var(--text-muted)',
  display: 'grid',
  gap: '0.3rem',
})

/** The set's Google Drive link and the notice under it. */
export function DriveLinkField({ url, onUrl, label = 'Google Drive link to the plans' }: { url: string; onUrl: (url: string) => void; label?: string }) {
  const typed = url.trim() !== ''
  const link = typed ? driveLink(url) : null
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          style={{ ...input, width: '100%', boxSizing: 'border-box', height: FIELD_HEIGHT_PX }}
        />
      </label>
      {!typed && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Every company we ask opens the plans from this link.</div>}
      {typed && !link && (
        <div role="status" style={notice('amber')}>
          This is not a Google Drive link. It looks like drive.google.com/file/d/… or drive.google.com/drive/folders/….
        </div>
      )}
      {link && (
        <div role="status" style={notice('grey')}>
          A Drive {link.kind}. Who can open it is not checked yet. The check that opens the link without signing in comes with a later step.
        </div>
      )}
    </div>
  )
}
