/**
 * GC mode design spike: their dates to meet only, onto a running job (G-145; the kernel is
 * `gcTheirDates.ts`, the mock-up `to-dos/gc-mode/mockups/G-145.md`). The Milestones card's door on
 * a job being built, and its window: their file read by G-137's reader, each of their dates beside
 * ours with the difference in days, ticked by the office. Take sends one action that writes only the
 * dates to meet. Nothing else moves and nothing is sent.
 */
import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { weekdayDate, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { readScheduleFile, type ScheduleFileResult } from '../../lib/gcMode/gcScheduleImport'
import { differenceWords, rowNotes, theirDates, theirDatesRefusal, type TheirDate } from '../../lib/gcMode/gcTheirDates'
import { Btn, input } from './gcUi'

/** The Milestones card's door on a job being built: the button, or why it is closed. Nothing on any other job. */
export function GcTheirDatesDoor({ state, project, dispatch, by }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; by: string }) {
  const [open, setOpen] = useState(false)
  if (project.stage !== 'building' || !project.schedule) return null
  const refusal = theirDatesRefusal(project)
  if (refusal) {
    return (
      <span data-their-dates-closed style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {refusal}
      </span>
    )
  }
  return (
    <>
      {/* The tour's round five lights this door; the span holds the button as one item, so nothing moves. */}
      <span data-tour="gc-their-dates" style={{ display: 'inline-flex' }}>
        <Btn kind="quiet" onClick={() => setOpen(true)}>
          Bring in their dates…
        </Btn>
      </span>
      {open && <GcTheirDatesWindow state={state} project={project} dispatch={dispatch} by={by} onClose={() => setOpen(false)} />}
    </>
  )
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function GcTheirDatesWindow({ state, project, dispatch, by, onClose }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; by: string; onClose: () => void }) {
  const customer = state.customers.find((c) => c.id === project.customerId)?.name ?? project.owner
  // The architect is one of the job's people, kept with the customers, as G-137's window reads it.
  const architect = state.customers.find((c) => c.id === project.architectId)?.name ?? null
  const [from, setFrom] = useState(customer)
  const [file, setFile] = useState<{ name: string; result: ScheduleFileResult } | null>(null)
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [picks, setPicks] = useState<Record<string, string>>({})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const reading = file && !('problem' in file.result) ? file.result : null
  const theirs = useMemo(() => (reading ? theirDates(state, project, reading) : null), [state, project, reading])
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = readScheduleFile(String(reader.result ?? ''), picked.name)
      setFile({ name: picked.name, result })
      if ('problem' in result) return
      const t = theirDates(state, project, result)
      setTicks(Object.fromEntries(t.rows.map((r) => [r.key, r.ticked])))
      setPicks(Object.fromEntries(t.rows.map((r) => [r.key, r.ours ?? ''])))
    }
    reader.readAsText(picked)
  }

  const oursById = new Map((theirs?.ours ?? []).map((r) => [r.milestone.id, r]))
  const chosen: TheirDate[] = (theirs?.rows ?? []).filter((r) => !r.metOurs && ticks[r.key]).map((r) => ({ name: r.name, on: r.on, ours: picks[r.key] || null }))
  const twice = chosen.map((d) => d.ours).find((id, i, all) => id !== null && all.indexOf(id) !== i) ?? null
  const problem = file && 'problem' in file.result ? file.result.problem : theirs && theirs.rows.length === 0 ? 'This file has no dates to meet.' : null
  const take = () => {
    if (!file || chosen.length === 0 || twice) return
    dispatch({ type: 'takeTheirDates', projectId: project.id, file: file.name, from, dates: chosen, by })
    onClose()
  }
  const box = { ...input, minHeight: 30 }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Their dates to meet"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(820px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Their dates to meet</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Only their dates to meet come in. Nothing else on the schedule moves, and nothing is sent.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem 0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".xml,.csv" aria-label="Choose a file" onChange={choose} style={{ maxWidth: '100%' }} />
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>From</span>
            <select aria-label="Who handed it" value={from} onChange={(e) => setFrom(e.target.value)} style={box}>
              <option value={customer}>{customer}</option>
              {architect && architect !== customer && <option value={architect}>{architect}</option>}
            </select>
          </label>
        </div>
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        )}
        {theirs && theirs.rows.length > 0 && (
          <>
            <div data-their-dates-count style={{ color: 'var(--text-muted)' }}>
              In the file: {plural(theirs.rows.length, 'date', 'dates')}.{theirs.activities > 0 ? ` Its ${plural(theirs.activities, 'activity is', 'activities are')} passed over.` : ''}
            </div>
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {theirs.rows.map((r) => {
                const pick = picks[r.key] ?? ''
                const ours = pick ? (oursById.get(pick) ?? null) : null
                const notes = rowNotes(state, project, r, ours)
                return (
                  <div key={r.key} data-their-date={r.name} style={{ display: 'grid', gap: '0.2rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem 0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="checkbox" aria-label={`Take ${r.name}`} disabled={r.metOurs !== null} checked={r.metOurs === null && Boolean(ticks[r.key])} onChange={(e) => setTicks((was) => ({ ...was, [r.key]: e.target.checked }))} />
                      <strong style={{ flex: '1 1 10rem', minWidth: 0 }}>{r.name}</strong>
                      <span style={{ whiteSpace: 'nowrap' }}>{weekdayDate(r.on)}</span>
                      {r.metOurs ? (
                        <span style={{ color: 'var(--text-muted)' }}>{r.metOurs.milestone.label}</span>
                      ) : (
                        <select aria-label={`Which of ours ${r.name} takes the place of`} value={pick} onChange={(e) => setPicks((was) => ({ ...was, [r.key]: e.target.value }))} style={box}>
                          <option value="">A new date to meet</option>
                          {(theirs.ours ?? []).map((o) => (
                            <option key={o.milestone.id} value={o.milestone.id}>
                              {o.milestone.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{ours ? weekdayDate(ours.due) : r.metOurs ? weekdayDate(r.metOurs.due) : ''}</span>
                      {!r.metOurs && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{differenceWords(r.on, ours)}</span>}
                    </div>
                    {notes.map((n) => (
                      <div key={n} style={{ paddingLeft: '1.6rem', color: n.startsWith("This is the contract's finish") ? 'var(--text-amber-800)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {n}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          {theirs && chosen.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Tick a date to take it.</span>}
          {twice && <span style={{ color: 'var(--text-red-700)' }}>Two of their dates take the place of {oursById.get(twice)?.milestone.label ?? 'one of ours'}.</span>}
          <Btn kind="plain" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={!theirs || chosen.length === 0 || twice !== null} onClick={take}>
            {chosen.length > 0 ? `Take ${plural(chosen.length, 'date', 'dates')}` : 'Take their dates'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
