import { createPortal } from 'react-dom'
import type { Database } from '../../types/database'

type GroupRow = Database['public']['Tables']['checklist_tech_tree_groups']['Row']
type EdgeRow = Database['public']['Tables']['checklist_tech_tree_edges']['Row']

type Props = {
  open: boolean
  onClose: () => void
  portalContainer?: HTMLElement | null
  edgeCount: number
  groupCount: number
  linksSearchQuery: string
  onLinksSearchChange: (q: string) => void
  filteredTreeEdges: EdgeRow[]
  groups: GroupRow[]
  onRemoveEdge: (edgeId: string) => void
  /** Parent should close this modal before opening line-up (z-index). */
  onOpenLineUp: () => void
}

const LINKS_MODAL_Z = 10040

/**
 * Roadmap prerequisite links: filter list, remove, open Link Groups modal.
 */
export function ChecklistTechTreeLinksModal({
  open,
  onClose,
  portalContainer,
  edgeCount,
  groupCount,
  linksSearchQuery,
  onLinksSearchChange,
  filteredTreeEdges,
  groups,
  onRemoveEdge,
  onOpenLineUp,
}: Props) {
  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!open || !target) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: LINKS_MODAL_Z,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-links-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <h2 id="tech-tree-links-modal-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            Links <span style={{ color: 'var(--text-slate-500)', fontWeight: 500 }}>({edgeCount})</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onOpenLineUp}
              disabled={groupCount < 2}
              title={groupCount < 2 ? 'Add at least two groups to add a link' : undefined}
              style={{ font: 'inherit', cursor: groupCount < 2 ? 'not-allowed' : 'pointer' }}
            >
              Link Groups
            </button>
            <button type="button" onClick={onClose} style={{ font: 'inherit', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
        <input
          type="search"
          value={linksSearchQuery}
          onChange={(e) => onLinksSearchChange(e.target.value)}
          placeholder="Filter links…"
          aria-label="Filter links by group name"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            marginBottom: 12,
          }}
        />
        {filteredTreeEdges.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-slate-500)', fontSize: 12 }}>No links match this search</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {filteredTreeEdges.map((e) => {
              const a = groups.find((g) => g.id === e.from_group_id)?.title ?? '…'
              const b = groups.find((g) => g.id === e.to_group_id)?.title ?? '…'
              return (
                <li key={e.id} style={{ marginBottom: 4 }}>
                  {a} → {b}{' '}
                  <button type="button" onClick={() => void onRemoveEdge(e.id)} style={{ fontSize: 12 }}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>,
    target,
  )
}
