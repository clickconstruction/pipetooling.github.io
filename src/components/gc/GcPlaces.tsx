/**
 * GC mode design spike: too many trades in one place, the Gantt's G-83 (the kernel is `gcPlaces.ts`,
 * the mock-up `to-dos/gc-mode/mockups/G-83.md`). The card under the chart and its window, where the
 * office keeps a place on each bar; the opened bar's place line; and the chart's lane, an amber band
 * on each week with too many trades in one place, its hover card in G-84's look.
 */
import { useEffect, useMemo, useState, type CSSProperties, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { daysBetween, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { PLACE_RULE, cleanPlace, crowdedPlaces, crowdedSpells, keptPlaces, placeGuess, placeProblem, placeRows, placesSummary, takesPlace, type CrowdedWeek } from '../../lib/gcMode/gcPlaces'
import { Btn, Card, input } from './gcUi'

/** Saturated on purpose, as the chart's own amber: the same in both themes. */
const AMBER = '#d97706'

/** The places on the job and the guesses, offered as the office types. */
function placeList(state: GcState, project: GcProject): string[] {
  const guesses = placeRows(state, project).flatMap((r) => (r.guess ? [r.guess.place] : []))
  return [...new Set([...keptPlaces(project).values(), ...guesses])].sort((a, b) => a.localeCompare(b))
}

/** The card under the chart: how many bars have a place, the rule, and the runs of too many. */
export function GcPlacesCard({ state, project, crowded, dispatch }: { state: GcState; project: GcProject; crowded: CrowdedWeek[]; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => placeRows(state, project), [state, project])
  if (rows.length === 0 && keptPlaces(project).size === 0) return null
  const lines = placesSummary(rows, crowded)
  return (
    <Card dataTour="gc-places">
      <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.875rem' }}>
        <strong>Where the work is</strong>
        <span style={{ color: 'var(--text-muted)' }}>Give each bar a place, and the chart flags a day with too many trades in one place. {PLACE_RULE}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span data-places-summary style={{ flex: '1 1 16rem', minWidth: 0 }}>
            {lines.map((l) => (
              <span key={l.words} style={l.crowded ? { color: 'var(--text-amber-800)', fontWeight: 600 } : undefined}>
                {l.words}{' '}
              </span>
            ))}
          </span>
          <Btn kind="plain" onClick={() => setOpen(true)}>
            Look at the places
          </Btn>
        </div>
      </div>
      {open && <GcPlacesWindow state={state} project={project} dispatch={dispatch} onClose={() => setOpen(false)} />}
    </Card>
  )
}

/** Every bar not done, with its place or its guess in a box: Keep these places sends what changed. */
function GcPlacesWindow({ state, project, dispatch, onClose }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const rows = useMemo(() => placeRows(state, project), [state, project])
  const known = useMemo(() => placeList(state, project), [state, project])
  const [boxes, setBoxes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.lineId, r.kept ?? r.guess?.place ?? ''])))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const changes: Record<string, string | null> = {}
  for (const r of rows) {
    const now = cleanPlace(boxes[r.lineId] ?? '')
    if (now !== (r.kept ?? '')) changes[r.lineId] = now === '' ? null : now
  }
  const problem = rows.map((r) => placeProblem(boxes[r.lineId] ?? '')).find((p) => p !== null) ?? null
  const count = Object.keys(changes).length
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const listId = `gc-places-${project.id}`
  const keep = () => {
    if (problem || count === 0) return
    dispatch({ type: 'setActivityPlaces', projectId: project.id, places: changes })
    onClose()
  }
  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Where the work is"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(720px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Where the work is</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Each bar not done, with its place. A guess counts once you keep it.</div>
        </div>
        <datalist id={listId}>
          {known.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          {rows.map((r) => {
            const box = boxes[r.lineId] ?? ''
            const hint = r.kept ? (cleanPlace(box) === r.kept ? 'kept' : '') : r.guess ? (cleanPlace(box) === r.guess.place ? `a guess from its ${r.guess.from}` : '') : 'no guess'
            const bad = placeProblem(box)
            return (
              <div key={r.lineId} data-place-row={r.lineId} style={{ display: 'flex', gap: '0.35rem 0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                <span style={{ flex: '1 1 14rem', minWidth: 0 }}>
                  {r.name} <span style={{ color: 'var(--text-muted)' }}>· {r.company}</span>
                </span>
                <input value={box} onChange={(e) => setBoxes((was) => ({ ...was, [r.lineId]: e.target.value }))} list={listId} aria-label={`Where ${r.name} is`} placeholder="Roof, Inside, Level 2" style={{ ...input, width: '11rem' }} />
                <span style={{ flex: '0 1 11rem', fontSize: '0.8rem', color: bad ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{bad ?? hint}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn kind="plain" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || count === 0} onClick={keep}>
            Keep these places
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The opened bar's place (G-83): its place, or its guess to set. Nothing for an inspection or the job's own bar. */
export function GcPlaceLine({ project, lineId, trade, label, dispatch }: { project: GcProject; lineId: string; trade: string; label: string; dispatch: Dispatch<GcAction> }) {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  const guess = a && !a.place ? placeGuess(trade, label) : null
  const [value, setValue] = useState(a?.place ?? guess?.place ?? '')
  if (!a || !takesPlace(a)) return null
  const clean = cleanPlace(value)
  const problem = placeProblem(value)
  const changed = clean !== (a.place ?? '')
  return (
    <div data-place-line style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Place</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Where its work is" placeholder="Roof, Inside, Level 2" style={{ ...input, width: '11rem' }} />
      </label>
      <Btn kind={changed ? 'primary' : 'plain'} disabled={!changed || problem !== null} onClick={() => dispatch({ type: 'setActivityPlaces', projectId: project.id, places: { [lineId]: clean === '' ? null : clean } })}>
        Set the place
      </Btn>
      {problem ? (
        <span style={{ color: 'var(--text-red-700)' }}>{problem}</span>
      ) : guess && clean === guess.place ? (
        <span style={{ color: 'var(--text-muted)' }}>A guess from its {guess.from}. It counts once you set it.</span>
      ) : null}
    </div>
  )
}

/**
 * The chart's lane (G-83): a row for each place with a flagged week, under the dates the job must
 * meet. An amber band over each week's crowded days, the most at once after each run, and a hover
 * card with where, when, who, the people and the rule. The whole job, whatever is filtered or folded.
 */
export function GcCrowdedLane({ weeks, first, px, labelW, width, phone, rowH }: { weeks: CrowdedWeek[]; first: string; px: number; labelW: number; width: number; phone: boolean; rowH: number }) {
  const [hover, setHover] = useState<{ week: CrowdedWeek; x: number; y: number } | null>(null)
  const spells = crowdedSpells(weeks)
  const label: CSSProperties = { position: 'sticky', left: 0, zIndex: 3, width: labelW, minWidth: labelW, boxSizing: 'border-box', borderRight: '1px solid var(--border)', padding: '0 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', background: 'var(--surface)' }
  const x = (on: string) => daysBetween(first, on) * px
  return (
    <div data-crowded-lane="yes">
      {crowdedPlaces(weeks).map((place) => (
        <div key={place} data-crowded-place={place} style={{ display: 'flex', height: rowH, borderTop: '1px solid var(--border)' }}>
          <div style={label} title={PLACE_RULE}>
            <strong style={{ whiteSpace: 'nowrap' }}>{phone ? 'Crowded' : 'Too many in one place'}</strong>
            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {place}</span>
          </div>
          <div style={{ position: 'relative', width }}>
            {weeks
              .filter((w) => w.place === place)
              .map((w) => (
                <span
                  key={w.weekOf}
                  data-crowded-week={w.weekOf}
                  aria-label={w.words}
                  onMouseEnter={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setHover({ week: w, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  style={{ position: 'absolute', left: x(w.from), width: Math.max(px, (daysBetween(w.from, w.to) + 1) * px), top: (rowH - 10) / 2, height: 10, borderRadius: 5, boxSizing: 'border-box', border: `1.5px solid ${AMBER}`, background: 'var(--bg-amber-100)' }}
                />
              ))}
            {spells
              .filter((s) => s.place === place)
              .map((s) => (
                <span key={s.from} aria-hidden style={{ position: 'absolute', left: x(s.to) + px + 6, top: 0, height: rowH, display: 'flex', alignItems: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
                  {s.most} trades
                </span>
              ))}
          </div>
        </div>
      ))}
      {hover && <CrowdedCard week={hover.week} at={hover} />}
    </div>
  )
}

/** One place and week, beside the pointer, in G-84's look: a label, then its lines. */
function CrowdedCard({ week, at }: { week: CrowdedWeek; at: { x: number; y: number } }) {
  const W = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(at.x + 14, vw - W - 12)),
        top: at.y + 18 + 220 > vh ? Math.max(8, at.y - 230) : at.y + 18,
        width: W,
        zIndex: 1300,
        pointerEvents: 'none',
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
        padding: '0.6rem 0.7rem',
        fontSize: '0.78rem',
        display: 'grid',
        gap: '0.25rem',
      }}
    >
      <strong style={{ fontSize: '0.86rem', color: 'var(--text-amber-800)' }}>Too many in one place</strong>
      {week.rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '4.2rem minmax(0, 1fr)', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
          <span style={{ display: 'grid' }}>
            {r.lines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
