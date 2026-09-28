/**
 * The "Superintendents:" line under the Workflow page's title: a chip with a ×
 * for each superintendent on the project, and a list to add another.
 *
 * Draws what it is handed — `useProjectSuperintendents` (called by the page)
 * holds the lists and does the reads and writes.
 */
import {
  superintendentChipLabel,
  superintendentOptionLabel,
  unassignedSuperintendents,
  type SuperintendentOption,
} from '../../lib/workflow/projectSuperintendents'

export type WorkflowSuperintendentsStripProps = {
  projectSuperintendents: SuperintendentOption[]
  allSuperintendents: SuperintendentOption[]
  saving: boolean
  onAdd: (superintendentId: string) => void
  onRemove: (superintendentId: string) => void
}

export function WorkflowSuperintendentsStrip({
  projectSuperintendents,
  allSuperintendents,
  saving,
  onAdd,
  onRemove,
}: WorkflowSuperintendentsStripProps) {
  return (
    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 500 }}>Superintendents:</span>
      {projectSuperintendents.length === 0 && (
        <span style={{ color: 'var(--text-faint)' }}>None</span>
      )}
      {projectSuperintendents.map((s) => (
        <span
          key={s.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            background: 'var(--bg-sky-100)',
            color: 'var(--text-sky-700)',
            borderRadius: 4,
            fontSize: '0.8125rem',
          }}
        >
          {superintendentChipLabel(s)}
          <button
            type="button"
            onClick={() => onRemove(s.id)}
            disabled={saving}
            style={{ background: 'none', border: 'none', padding: 0, cursor: saving ? 'not-allowed' : 'pointer', color: 'inherit', fontSize: '0.9em', lineHeight: 1 }}
            title="Remove"
          >
            {"×"}
          </button>
        </span>
      ))}
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value
          if (id) {
            onAdd(id)
            e.target.value = ''
          }
        }}
        disabled={saving}
        style={{ padding: '0.15rem 0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border-sky)', borderRadius: 4, background: 'var(--surface)', minWidth: 140 }}
      >
        <option value="">Add superintendent...</option>
        {unassignedSuperintendents(allSuperintendents, projectSuperintendents).map((s) => (
          <option key={s.id} value={s.id}>
            {superintendentOptionLabel(s)}
          </option>
        ))}
      </select>
    </div>
  )
}
