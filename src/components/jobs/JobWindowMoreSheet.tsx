import type { CSSProperties } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import { recordViewerNavClick } from '../../lib/navClickViewer'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { JOB_WINDOW_BAR_MIN_HEIGHT } from '../../lib/jobs/jobWindowBar'
import type { JobWindowSheetKey, JobWindowSheetRow } from '../../lib/jobs/jobWindowPhone'

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  minHeight: JOB_WINDOW_BAR_MIN_HEIGHT,
  padding: '0.5rem 1rem',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontSize: '1rem',
  fontWeight: 600,
  textAlign: 'left',
  cursor: 'pointer',
}
const quiet: CSSProperties = { marginLeft: 'auto', flex: 'none', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }

/**
 * The ⋯ sheet of the job window on a phone (punch list #355, PR A): every door the old icon row held, one named
 * 48 px row each, from `jobWindowSheetRows`. Share and Calendar first, since they are the two anyone pressed; the ?
 * card last. Each press writes one `ui_nav_clicks` row named by the row, so the count the icons had goes on.
 */
export function JobWindowMoreSheet({ title, rows, onPress, onClose }: { title: string; rows: readonly JobWindowSheetRow[]; onPress: (key: JobWindowSheetKey) => void; onClose: () => void }) {
  return (
    <PhoneSheet label="More on this job" title={title} width={420} onClose={onClose}>
      <div role="menu" aria-label="More on this job" data-navtrack="job-window" data-navbuttons="" onClickCapture={recordViewerNavClick} style={{ display: 'grid', overflowY: 'auto', paddingBottom: '0.25rem' }}>
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            role="menuitem"
            disabled={r.dead}
            aria-label={r.label}
            onClick={() => {
              if (r.dead) return
              onClose()
              onPress(r.key)
            }}
            style={r.dead ? { ...row, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : row}
          >
            <span style={{ minWidth: 0 }}>{r.label}</span>
            {r.quiet ? <span style={quiet}>{r.quiet}</span> : null}
          </button>
        ))}
      </div>
    </PhoneSheet>
  )
}

export default JobWindowMoreSheet
