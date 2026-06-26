import type { Database } from '../../types/database'

type RoadmapRow = Database['public']['Tables']['checklist_tech_tree_roadmaps']['Row']

type Props = {
  roadmaps: RoadmapRow[]
  selectedRoadmapId: string | null
  onSelectRoadmapId: (id: string) => void
  canCreateRoadmap: boolean
  onCreateRoadmap: () => void
  canOpenMembers: boolean
  onOpenMembers: () => void
}

export function ChecklistTechTreeRoadmapBar({
  roadmaps,
  selectedRoadmapId,
  onSelectRoadmapId,
  canCreateRoadmap,
  onCreateRoadmap,
  canOpenMembers,
  onOpenMembers,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
        <span style={{ fontWeight: 600 }}>Roadmap</span>
        <select
          value={selectedRoadmapId ?? ''}
          onChange={(e) => onSelectRoadmapId(e.target.value)}
          style={{
            minWidth: 200,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            font: 'inherit',
            background: '#fff',
          }}
          aria-label="Select roadmap"
        >
          {roadmaps.length === 0 ? (
            <option value="">No roadmaps</option>
          ) : (
            roadmaps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))
          )}
        </select>
      </label>
      {canCreateRoadmap ? (
        <button
          type="button"
          onClick={onCreateRoadmap}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          New roadmap
        </button>
      ) : null}
      {canOpenMembers ? (
        <button
          type="button"
          onClick={onOpenMembers}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Members
        </button>
      ) : null}
    </div>
  )
}
