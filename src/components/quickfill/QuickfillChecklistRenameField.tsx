import { useState } from 'react'
import { checklistRenameReady } from '../../lib/quickfill/checklistItems'

/**
 * A checklist box's words as a text box, for a dev rewording it in place (v2.5829): Office
 * Arriving, Office Leaving and Assistant Dailys. The box keeps its id, so its ticks stay with it.
 * Save writes nothing until the words change; Enter saves, Escape and Cancel leave it as it was.
 */
export function QuickfillChecklistRenameField({
  label,
  saving,
  onSave,
  onCancel,
}: {
  label: string
  saving: boolean
  onSave: (nextLabel: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(label)
  const ready = checklistRenameReady(label, draft) && !saving
  return (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
      <input
        type="text"
        value={draft}
        autoFocus
        aria-label={`New words for the box: ${label}`}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (ready) onSave(draft)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }
        }}
        style={{ flex: '1 1 200px', minWidth: 0, padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
      />
      <button
        type="button"
        onClick={() => onSave(draft)}
        disabled={!ready}
        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8125rem', border: 'none', borderRadius: 4, background: ready ? '#2563eb' : 'var(--bg-200)', color: ready ? 'white' : 'var(--text-faint)', cursor: ready ? 'pointer' : 'not-allowed' }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: saving ? 'not-allowed' : 'pointer' }}
      >
        Cancel
      </button>
    </span>
  )
}
