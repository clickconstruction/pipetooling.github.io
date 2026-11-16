/**
 * The box that moves a saved set of plans to another Drive link (v2.7464): paste the link, and **Save the link**
 * writes it on the set's own row. The set stays the same set, so the sets that replace it, the papers that go with
 * it and the part that builds from it are untouched; when the part builds from it, every job's Open plans follows
 * by the database's mirror. Pure over its props: the caller writes and answers whether it took, and closes the box
 * on a yes. Drawn under a set's row on the job's Plans section and on the Development page's Plans look, opened by
 * the row's **Change the link** press (**Set the link** on a set with none).
 */
import { useState, type CSSProperties } from 'react'
import { LINK_PRESS, linkChangeNote, linkChangeProblem, type PlanSetRow } from '../../lib/plans/planSets'

const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'anywhere' }
const box: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.45rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box', minWidth: 0 }
const quiet: CSSProperties = { padding: '0.25rem 0.6rem', fontSize: '0.78rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const blue: CSSProperties = { ...quiet, background: '#2563eb', borderColor: '#2563eb', color: 'white' }

export function PlanSetLinkEditor({
  set,
  isCurrent,
  busy,
  onSave,
  onClose,
  style,
}: {
  set: Pick<PlanSetRow, 'id' | 'name' | 'link'>
  /** True when the part builds from this set: the note says every job's Open plans follows. */
  isCurrent: boolean
  busy: boolean
  /** Writes the link on the set; true when it took, so the caller closes the box. */
  onSave: (setId: string, link: string) => Promise<boolean>
  onClose: () => void
  style?: CSSProperties
}) {
  const [draft, setDraft] = useState(set.link)
  const untouched = draft.trim() === set.link.trim()
  // Nothing is said while the box still holds the link it opened with: the press is simply not ready yet.
  const problem = untouched ? null : linkChangeProblem(set.link, draft)
  const label = `${set.link.trim() ? 'New link' : 'Link'} for ${set.name}`
  return (
    <form
      style={{ display: 'grid', gap: 4, width: '100%', minWidth: 0, ...style }}
      data-testid={`plan-set-link-editor-${set.id}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (busy || untouched || problem) return
        void onSave(set.id, draft.trim())
      }}
    >
      <input type="url" inputMode="url" autoFocus style={box} value={draft} placeholder="https://drive.google.com/…" aria-label={label} onChange={(e) => setDraft(e.target.value)} />
      <span style={muted}>{linkChangeNote(isCurrent)}</span>
      {problem ? (
        <span style={{ ...muted, color: 'var(--text-amber-800)' }} role="alert">
          {problem}
        </span>
      ) : null}
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="submit" style={blue} disabled={busy || untouched || !!problem}>
          {LINK_PRESS.save}
        </button>
        <button type="button" style={quiet} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </span>
    </form>
  )
}
