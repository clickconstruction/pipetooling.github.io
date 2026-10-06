/**
 * GC mode design spike: Bring in a schedule, the Gantt's G-137 (mock-up and plan
 * `to-dos/gc-mode/mockups/G-137.md`). The window behind the Schedule tab's Bring in their schedule:
 * who handed it, the file, what it holds, each of their activities with where it goes and why we
 * guessed it (the rows with no place first), their dates to meet, our lines not in it, and what it
 * could not read. Nothing is written until Make the schedule from it, which sends one action
 * through the first draft's own kernel. `gcScheduleImport.ts` reads, guesses and makes; this draws.
 */
import { useMemo, useState, type ChangeEvent, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { shortDate, weekdayDate, type GcAction, type GcProject, type GcState, type ScheduleImport, type ScheduleImportPlace, type ScheduleImportRow } from '../../lib/gcMode/gcModel'
import {
  IMPORT_INTRO,
  IMPORT_REPLACES,
  guessPlaces,
  importHoldsWords,
  importLines,
  importedSchedule,
  notInWords,
  notPlacedWords,
  readScheduleFile,
  togetherWords,
  type ImportChoice,
  type ImportGuess,
  type ScheduleFileResult,
} from '../../lib/gcMode/gcScheduleImport'
import { Btn, input } from './gcUi'

/** A row's place as the select holds it: '' not placed, `out`, a line by its id, or an inspection or the job's own. */
function valueOf(place: ImportChoice | null | undefined): string {
  if (!place) return ''
  if (place.kind === 'line') return `line:${place.lineId}`
  return place.kind === 'roughInInspection' ? 'rough' : place.kind === 'finalInspection' ? 'final' : place.kind
}

function placeOf(value: string, who: string): ScheduleImportPlace | null {
  if (value.startsWith('line:')) return { kind: 'line', lineId: value.slice('line:'.length) }
  if (value === 'rough') return { kind: 'roughInInspection' }
  if (value === 'final') return { kind: 'finalInspection' }
  if (value === 'inspection') return { kind: 'inspection' }
  if (value === 'added') return { kind: 'added', who }
  return null
}

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
}

const box = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

export function GcScheduleImport({ state, project, dispatch, replacing, by, defaultStart, onClose }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; replacing: boolean; by: string; defaultStart: string; onClose: () => void }) {
  const customer = state.customers.find((c) => c.id === project.customerId)?.name ?? project.owner
  // The architect is one of the job's people, kept with the customers, as the architect's portal reads it.
  const architect = state.customers.find((c) => c.id === project.architectId)?.name ?? null
  const [from, setFrom] = useState(customer)
  const [file, setFile] = useState<{ name: string; result: ScheduleFileResult } | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [workStarts, setWorkStarts] = useState(defaultStart)
  const reading = file && !('problem' in file.result) ? file.result : null
  const guesses = useMemo(() => (reading ? guessPlaces(project, reading) : new Map<string, ImportGuess>()), [project, reading])
  const lines = useMemo(() => importLines(project), [project])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = readScheduleFile(String(reader.result ?? ''), picked.name)
      setFile({ name: picked.name, result })
      if ('problem' in result) return
      const g = guessPlaces(project, result)
      setChoices(Object.fromEntries(result.rows.filter((r) => !r.date).map((r) => [r.key, valueOf(g.get(r.key)?.place)])))
      setTicked(Object.fromEntries(result.rows.filter((r) => r.date).map((r) => [r.key, true])))
      // Our lines not in their file start from their first day of work, unless the office says otherwise.
      const first = result.rows.filter((r) => !r.date).reduce<string | null>((m, r) => (m === null || r.start < m ? r.start : m), null)
      if (first) setWorkStarts(first)
    }
    reader.readAsText(picked)
  }

  // What would be made, worked out again on every change: the preview reads the same kernel the reducer calls.
  const imported = useMemo<ScheduleImport | null>(() => {
    if (!reading || !file) return null
    const rows: ScheduleImportRow[] = reading.rows
      .filter((r) => !r.date)
      .flatMap((r) => {
        const guess = guesses.get(r.key)
        const place = placeOf(choices[r.key] ?? '', guess?.place?.kind === 'added' ? guess.place.who || (r.company ?? '') : (r.company ?? ''))
        return place ? [{ key: r.key, name: r.name, start: r.start, finish: r.finish, place, after: r.after, ...(r.notBefore ? { notBefore: r.notBefore } : {}), ...(r.mustFinishBy ? { mustFinishBy: r.mustFinishBy } : {}), ...(r.underADay ? { underADay: true } : {}) }] : []
      })
    return { file: file.name, from, workStarts, rows, dates: reading.rows.filter((r) => r.date && ticked[r.key]).map((r) => ({ name: r.name, on: r.start })) }
  }, [reading, file, guesses, choices, ticked, from, workStarts])
  const made = useMemo(() => (imported && workStarts ? importedSchedule(project, imported) : null), [project, imported, workStarts])

  const activities = reading ? reading.rows.filter((r) => !r.date) : []
  // The rows the office has to look at first: the ones the guess could not place, then the rest in the file's order.
  const ordered = [...activities.filter((r) => !guesses.get(r.key)?.place), ...activities.filter((r) => guesses.get(r.key)?.place)]
  const nameOf = new Map(activities.map((r) => [r.key, r.name]))
  const notPlaced = activities.filter((r) => (choices[r.key] ?? '') === '').length
  const trades = [...new Set(lines.map((l) => l.trade))]
  const ourDates = new Set((project.schedule?.milestones ?? []).map((m) => m.label.toLowerCase()).concat(['dry-in', 'rough-in inspection', 'substantial completion']))
  const canMake = Boolean(made && workStarts && (made.kept > 0 || (imported?.dates.length ?? 0) > 0))

  const make = () => {
    if (!imported || !canMake) return
    dispatch({ type: 'importSchedule', projectId: project.id, imported, by })
    onClose()
  }

  const muted = { color: 'var(--text-muted)', fontSize: '0.8rem' } as const
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bring in a schedule"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 760, maxWidth: '100%', boxSizing: 'border-box', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.8rem', fontSize: '0.9rem' }}
      >
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Bring in a schedule</h3>
          {[...IMPORT_INTRO, ...(replacing ? [IMPORT_REPLACES] : [])].map((l) => (
            <div key={l} style={{ color: 'var(--text-600)' }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Who handed it</span>
            <select aria-label="Who handed it" value={from} onChange={(e) => setFrom(e.target.value)} style={box}>
              <option value={customer}>{customer}</option>
              {architect && architect !== customer && <option value={architect}>{architect}</option>}
            </select>
          </label>
          <input type="file" aria-label="Choose a file" accept=".xml,.csv,text/csv,text/xml,application/xml" onChange={choose} style={{ fontSize: '0.82rem' }} />
        </div>

        {file && 'problem' in file.result && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {file.result.problem}
          </div>
        )}

        {reading && (
          <>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <strong>{importHoldsWords(reading)}</strong>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>Work starts</span>
                <input type="date" aria-label="Work starts" value={workStarts} onChange={(e) => setWorkStarts(e.target.value)} style={box} />
                <span style={muted}>It places only our lines not in their file.</span>
              </label>
            </div>

            <div role="table" aria-label="Their activities" style={{ display: 'grid', gap: '0.45rem' }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.3fr) 7.5rem minmax(0, 1.4fr)', gap: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <span role="columnheader">Theirs</span>
                {!phone && <span role="columnheader">Dates</span>}
                {!phone && <span role="columnheader">Goes on</span>}
              </div>
              {ordered.map((r) => {
                const guess = guesses.get(r.key)
                const value = choices[r.key] ?? ''
                const waits = r.after.map((a) => nameOf.get(a.key)).filter((n): n is string => Boolean(n))
                return (
                  <div key={r.key} role="row" data-import-row={r.name} style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1.3fr) 7.5rem minmax(0, 1.4fr)', gap: '0.15rem 0.5rem', alignItems: 'start', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                    <span role="cell" style={{ display: 'grid' }}>
                      <span>{r.name}</span>
                      {waits.length > 0 && <span style={muted}>{`after ${andList(waits)}`}</span>}
                    </span>
                    <span role="cell" style={{ ...muted, whiteSpace: 'nowrap', paddingTop: 2 }}>
                      {shortDate(r.start)} to {shortDate(r.finish)}
                    </span>
                    <span role="cell" style={{ display: 'grid', gap: '0.15rem' }}>
                      <select aria-label={`Where ${r.name} goes`} value={value} onChange={(e) => setChoices((was) => ({ ...was, [r.key]: e.target.value }))} style={{ ...box, maxWidth: '100%', borderColor: value === '' ? 'var(--text-amber-800)' : undefined }}>
                        <option value="">Pick where it goes</option>
                        <option value="out">Not ours</option>
                        {trades.map((t) => (
                          <optgroup key={t} label={t}>
                            {lines
                              .filter((l) => l.trade === t)
                              .map((l) => (
                                <option key={l.lineId} value={`line:${l.lineId}`}>
                                  {l.label}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                        <optgroup label="Inspections">
                          <option value="rough">The rough-in inspection</option>
                          <option value="final">The final inspection</option>
                          <option value="inspection">An inspection of its own</option>
                        </optgroup>
                        <option value="added">The job&apos;s own</option>
                      </select>
                      {guess && <span style={muted}>{guess.why}</span>}
                    </span>
                  </div>
                )
              })}
              {/* Two of theirs on one of our lines: its parts (G-39), or one bar and why. */}
              {made && made.together.length > 0 && <div style={muted}>{togetherWords(made).join(' ')}</div>}
            </div>

            {reading.rows.some((r) => r.date) && (
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <strong>Dates to meet</strong>
                {reading.rows
                  .filter((r) => r.date)
                  .map((r) => (
                    <label key={r.key} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="checkbox" checked={Boolean(ticked[r.key])} onChange={(e) => setTicked((was) => ({ ...was, [r.key]: e.target.checked }))} />
                      <span>{r.name}</span>
                      <span style={muted}>{weekdayDate(r.start)}</span>
                      {ourDates.has(r.name.toLowerCase()) && <span style={muted}>{`It takes the place of our own ${r.name.toLowerCase()}.`}</span>}
                    </label>
                  ))}
              </div>
            )}

            {made && (made.notIn.length > 0 || made.inspectionsNotIn.length > 0) && (
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <strong>{`Our lines not in it: ${made.notIn.length}`}</strong>
                <span style={muted}>Each is drawn as the first draft draws it, after what it waits on.</span>
                {notInWords(made).map((l) => (
                  <span key={l} style={{ fontSize: '0.85rem' }}>
                    {l}
                  </span>
                ))}
              </div>
            )}

            {(reading.unread.length > 0 || (made?.notes.length ?? 0) > 0) && (
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <strong>{`What it could not read: ${reading.unread.length + (made?.notes.length ?? 0)}`}</strong>
                {[...reading.unread, ...(made?.notes ?? [])].map((l) => (
                  <span key={l} style={{ fontSize: '0.85rem' }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {reading && notPlacedWords(notPlaced) && <span style={{ ...muted, flex: 1, minWidth: 0, color: 'var(--text-amber-800)' }}>{notPlacedWords(notPlaced)}</span>}
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!canMake} onClick={make}>
            Make the schedule from it
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
