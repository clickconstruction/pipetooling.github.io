/** People → Feedback (v2.2835): the gear drawer — the settings form, with the retired questions folded at the bottom. */
import { useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import CrewFeedbackSettingsForm from './CrewFeedbackSettingsForm'
import RetiredQuestionsPanel from './RetiredQuestionsPanel'

type Props = {
  row: TeamFeedbackSettingsRow | null
  onSaved: (row: TeamFeedbackSettingsRow) => void
  onClose: () => void
  narrow: boolean
}

export default function FeedbackSettingsDrawer({ row, onSaved, onClose, narrow }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()} style={backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-settings-title" onMouseDown={(e) => e.stopPropagation()} style={{ ...panel, width: narrow ? '100%' : 'min(640px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="feedback-settings-title" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>
            Team feedback settings
          </h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ padding: '0.25rem 1rem 1.25rem', overflowY: 'auto', flex: '1 1 auto' }}>
          <CrewFeedbackSettingsForm row={row} onSaved={onSaved} />
          <details style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.9rem' }}>Retired questions</summary>
            <RetiredQuestionsPanel settings={row} />
          </details>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', justifyContent: 'flex-end' }
const panel: CSSProperties = { height: '100%', background: 'var(--surface)', color: 'var(--text-base)', borderLeft: '1px solid var(--border)', boxShadow: '-20px 0 40px -20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' }
