/**
 * The change line under a set of plans (v2.6356): *What changed from Issued set: the riser moved to the north
 * wall*. To a writer, a set that followed another with nothing written shows *Write what changed*, and a set with
 * a line shows *Edit what changed*; either opens a small editor whose press says *Save what changed*. Pure over
 * its props: the caller writes and answers whether it took, and the editor closes on a yes. Drawn on the job's
 * Plans section and the Development page's Plans look.
 */
import { useState, type CSSProperties } from 'react'
import { CHANGES_PRESS, changesLineWords, changesMissing, changesPlaceholder, type TimelineEntry } from '../../lib/plans/planSets'

const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }
const press: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }
const area: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box', minHeight: '3.4rem', resize: 'vertical' }
const quiet: CSSProperties = { padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }

export function PlanSetChangesLine({
  entry,
  canWrite,
  busy,
  onSave,
  style,
}: {
  entry: TimelineEntry
  canWrite: boolean
  busy: boolean
  /** Writes the words on the set; true when they took, so the editor closes. */
  onSave: (setId: string, changes: string) => Promise<boolean>
  style?: CSSProperties
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const line = changesLineWords(entry)
  const written = entry.set.changes ?? ''
  if (draft !== null) {
    const same = draft.trim() === written.trim()
    return (
      <span style={{ ...style, display: 'grid', gap: 4, width: '100%' }} data-testid={`plan-set-changes-editor-${entry.set.id}`}>
        <textarea style={area} rows={2} value={draft} placeholder={changesPlaceholder(entry.previous)} aria-label={`What changed in ${entry.set.name}`} onChange={(e) => setDraft(e.target.value)} />
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={blue} disabled={busy || same} onClick={() => void onSave(entry.set.id, draft).then((ok) => ok && setDraft(null))}>
            {CHANGES_PRESS.save}
          </button>
          <button type="button" style={quiet} disabled={busy} onClick={() => setDraft(null)}>
            Cancel
          </button>
        </span>
      </span>
    )
  }
  if (!line && !(canWrite && changesMissing(entry))) return null
  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', ...style }} data-testid={`plan-set-changes-${entry.set.id}`}>
      {line ? <span style={muted}>{line}</span> : null}
      {canWrite ? (
        <button type="button" style={press} disabled={busy} onClick={() => setDraft(written)}>
          {line ? CHANGES_PRESS.edit : CHANGES_PRESS.write}
        </button>
      ) : null}
    </span>
  )
}
