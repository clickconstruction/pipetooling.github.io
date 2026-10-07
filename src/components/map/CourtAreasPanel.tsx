import { useState, type CSSProperties } from 'react'
import type { CourtArea } from '../../lib/legal/courtAreas'
import { courtAreaDraftProblem, courtAreasByCounty, courtAreaSourceWords, type CourtAreaDraft, type CourtCoverage } from '../../lib/legal/courtAreasDraft'

/**
 * The Court areas panel on the Map page (v2.4769): the coverage line, the areas by
 * county with their source, a name box for the shape just drawn, and Remove. The
 * map itself draws the shapes; this is the words beside it.
 */
export type CourtAreaListed = CourtArea & { createdAt: string }

const input: CSSProperties = { font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 0 }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }

export function CourtAreasPanel({ areas, coverage, pending, busy, error, onSave, onCancelPending, onRename, onRemove, onFocus }: {
  areas: ReadonlyArray<CourtAreaListed>
  coverage: CourtCoverage
  /** True while a shape is drawn and waits for its name. */
  pending: boolean
  busy: boolean
  error: string | null
  onSave: (draft: CourtAreaDraft) => void
  onCancelPending: () => void
  onRename: (id: string, draft: CourtAreaDraft) => void
  onRemove: (area: CourtAreaListed) => void
  /** Fly the map to an area. */
  onFocus: (area: CourtAreaListed) => void
}) {
  const [draft, setDraft] = useState<CourtAreaDraft>({ county: '', precinct: '', label: '', sourceNote: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CourtAreaDraft>({ county: '', precinct: '', label: '', sourceNote: '' })
  const ids = areas.map((a) => a.id)
  const problem = courtAreaDraftProblem(draft, areas)
  const editProblem = editing ? courtAreaDraftProblem(editDraft, areas, editing, ids) : null
  const total = coverage.placed + coverage.outside
  const set = (k: keyof CourtAreaDraft, onEdit = false) => (e: React.ChangeEvent<HTMLInputElement>) => (onEdit ? setEditDraft : setDraft)((d) => ({ ...d, [k]: e.target.value }))

  return (
    <div data-court-areas-panel style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b>Court areas</b>
        <span style={{ color: 'var(--text-muted)' }}>Draw a precinct on the map with the polygon tool, then name it here. Counties come from the geocoder; this map is for precincts.</span>
      </div>
      <div data-court-coverage style={{ color: 'var(--text-muted)' }}>
        {total === 0 ? 'No pins with a point on the map yet.' : <>
          <b style={{ color: 'var(--text)' }}>{coverage.placed} of {total}</b> {total === 1 ? 'address' : 'addresses'} inside a drawn area
          {coverage.outside ? <> · <b style={{ color: 'var(--text)' }}>{coverage.outside}</b> outside every area</> : null}
          {coverage.onLine ? <> · <b style={{ color: 'var(--text)' }}>{coverage.onLine}</b> on a line to settle</> : null}
        </>}
      </div>
      {pending ? (
        <form data-court-pending onSubmit={(e) => { e.preventDefault(); if (!problem) onSave(draft) }} style={{ display: 'grid', gap: '0.4rem', padding: '0.6rem', border: '1px dashed var(--border-strong)', borderRadius: 6 }}>
          <b>Name the shape you drew</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
            <input aria-label="County" placeholder="County · Guadalupe" value={draft.county} onChange={set('county')} style={input} />
            <input aria-label="Precinct" placeholder="Precinct · 2, 1-2, 3" value={draft.precinct} onChange={set('precinct')} style={input} />
            <input aria-label="Label" placeholder="Label (optional) · Seguin" value={draft.label} onChange={set('label')} style={input} />
            <input aria-label="Drawn from" placeholder="Drawn from · county PDF map, 2024" value={draft.sourceNote} onChange={set('sourceNote')} style={input} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy || !!problem} style={{ ...btn, background: 'var(--text-link)', color: '#fff', borderColor: 'var(--text-link)', opacity: busy || problem ? 0.6 : 1 }}>Save the area</button>
            <button type="button" onClick={onCancelPending} style={btn}>Discard the shape</button>
            {problem ? <span style={{ color: 'var(--text-muted)' }}>{problem}</span> : null}
          </div>
        </form>
      ) : null}
      {error ? <div role="alert" style={{ color: 'var(--text-red-700)' }}>{error}</div> : null}
      {areas.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No areas yet. Zoom to a county, pick the polygon tool, and trace a precinct with the county's map beside you.</div> : (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {courtAreasByCounty(areas).map((g) => (
            <div key={g.county}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{g.county} County <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {g.areas.length} {g.areas.length === 1 ? 'precinct' : 'precincts'}</span></div>
              {g.areas.map((a) => {
                const listed = a as CourtAreaListed
                return editing === a.id ? (
                  <form key={a.id} onSubmit={(e) => { e.preventDefault(); if (!editProblem) { onRename(a.id, editDraft); setEditing(null) } }} style={{ display: 'grid', gap: '0.3rem', padding: '0.4rem 0', borderTop: '1px dotted var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
                      <input aria-label="County" value={editDraft.county} onChange={set('county', true)} style={input} />
                      <input aria-label="Precinct" value={editDraft.precinct} onChange={set('precinct', true)} style={input} />
                      <input aria-label="Label" value={editDraft.label} onChange={set('label', true)} style={input} />
                      <input aria-label="Drawn from" value={editDraft.sourceNote} onChange={set('sourceNote', true)} style={input} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button type="submit" disabled={busy || !!editProblem} style={btn}>Save</button>
                      <button type="button" onClick={() => setEditing(null)} style={btn}>Cancel</button>
                      {editProblem ? <span style={{ color: 'var(--text-muted)' }}>{editProblem}</span> : null}
                    </div>
                  </form>
                ) : (
                  <div key={a.id} data-court-area={a.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', padding: '0.25rem 0', borderTop: '1px dotted var(--border)' }}>
                    <button type="button" onClick={() => onFocus(listed)} style={{ ...btn, border: 'none', padding: 0, fontWeight: 600, color: 'var(--text-link)' }}>JP Pct {a.precinct}{a.label ? ` · ${a.label}` : ''}</button>
                    <span style={{ color: 'var(--text-muted)' }}>{courtAreaSourceWords(a, listed.createdAt.slice(0, 10))}</span>
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.4rem' }}>
                      <button type="button" onClick={() => { setEditing(a.id); setEditDraft({ county: a.county, precinct: a.precinct, label: a.label, sourceNote: a.sourceNote }) }} style={btn}>Rename</button>
                      <button type="button" onClick={() => onRemove(listed)} style={btn}>Remove</button>
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
