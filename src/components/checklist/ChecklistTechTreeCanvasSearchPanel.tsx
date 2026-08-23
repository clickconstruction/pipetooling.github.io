import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { RoadmapSearchResult } from '../../lib/checklistTechTreeSearch'

/**
 * The Map's expandable search box (extracted verbatim from ChecklistTechTreeTab
 * in v2.2156 — sub-decomposition move 3). Rendered twice by the tab — `inline`
 * in the canvas corner and `fullscreen` inside the React Flow overlay.
 */
export type RoadmapCanvasSearchVariant = 'inline' | 'fullscreen'

export function RoadmapCanvasSearchPanel({
  variant,
  inputId,
  iconButtonStyle,
  roadmapSearchQuery,
  onRoadmapSearchQueryChange,
  roadmapSearch,
  fitViewRoadmapSearchMatches,
}: {
  variant: RoadmapCanvasSearchVariant
  inputId: string
  iconButtonStyle: CSSProperties
  roadmapSearchQuery: string
  onRoadmapSearchQueryChange: (q: string) => void
  roadmapSearch: RoadmapSearchResult
  fitViewRoadmapSearchMatches: () => void
}) {
  const zIndex = variant === 'fullscreen' ? 11 : 5
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useLayoutEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target
      if (!(t instanceof Node)) return
      if (!containerRef.current?.contains(t)) setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [expanded])

  return (
    <div
      ref={containerRef}
      className="nodrag nopan"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex,
        width: expanded ? 'min(440px, calc(100% - 120px))' : 'auto',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        className="nodrag nopan"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 6,
          width: '100%',
        }}
      >
        <button
          type="button"
          className="nodrag nopan"
          title="Search roadmap"
          aria-label="Search roadmap"
          aria-expanded={expanded}
          aria-controls={expanded ? inputId : undefined}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={iconButtonStyle}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            width={16}
            height={16}
            fill="currentColor"
            aria-hidden
          >
            <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
          </svg>
        </button>
        {expanded ? (
          <input
            ref={inputRef}
            id={inputId}
            className="nodrag nopan"
            type="search"
            value={roadmapSearchQuery}
            onChange={(e) => onRoadmapSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                inputRef.current?.blur()
                setExpanded(false)
                return
              }
              if (e.key === 'Enter' && roadmapSearch.groupIdsWithAnyMatch.length > 0) {
                e.preventDefault()
                fitViewRoadmapSearchMatches()
              }
            }}
            placeholder="Search groups and tasks…"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              font: 'inherit',
              background: 'var(--surface)',
            }}
            aria-label="Search roadmap by group or task"
          />
        ) : null}
      </div>
      {expanded && roadmapSearch.normalizedQuery ? (
        <div
          className="nodrag nopan"
          style={{
            fontSize: 12,
            color: roadmapSearch.matchCount > 0 ? 'var(--text-slate-500)' : 'var(--text-amber-700)',
          }}
        >
          {roadmapSearch.matchCount === 0
            ? 'No matches'
            : `${roadmapSearch.matchCount} match${roadmapSearch.matchCount === 1 ? '' : 'es'}`}
        </div>
      ) : null}
      {expanded &&
      roadmapSearch.normalizedQuery &&
      roadmapSearch.groupIdsWithAnyMatch.length > 0 ? (
        <div className="nodrag nopan">
          <button
            type="button"
            className="nodrag nopan"
            onClick={() => void fitViewRoadmapSearchMatches()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-slate-tint)',
              cursor: 'pointer',
            }}
          >
            Show on map
          </button>
        </div>
      ) : null}
    </div>
  )
}

