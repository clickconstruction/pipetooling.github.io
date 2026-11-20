/**
 * Standing… on a person's HR file (punch list #315, upgrade 4b): what the person was to the company over time, employee
 * or subcontractor, a stretch at a time. The person row says what someone is today and nothing of what they were, so
 * a question about a past month had no answer on the file. Each stretch has its first day, its last day while it is
 * closed, and where the fact comes from. A stretch is closed by its last day and taken off with a reason, never
 * deleted. Every write goes through `dev_engagement_write`; the words come from `lib/people/personEngagements.ts`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { EmptyState } from '../../EmptyState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import {
  ENGAGEMENT_KINDS,
  ENGAGEMENT_SOURCES,
  engagementChangePayload,
  engagementClosePayload,
  engagementDraftProblem,
  engagementKindWords,
  engagementLineWords,
  engagementOpenPayload,
  engagementWithdrawPayload,
  liveEngagements,
  runningEngagement,
  standingWords,
  type EngagementKind,
  type EngagementSource,
  type PersonEngagementRow,
} from '../../../lib/people/personEngagements'
import { writePersonEngagement } from '../../../lib/people/personEngagementsIo'

const FIELD: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.84rem', background: 'var(--bg-page)', color: 'var(--text-base)', fontFamily: 'inherit' }
const LABEL: CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }
const HEAD: CSSProperties = { margin: '1rem 0 0.45rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }
const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.55rem 0.7rem', alignItems: 'end' }

const press = (primary: boolean, dead = false): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 650,
  padding: '0.3rem 0.7rem',
  borderRadius: 6,
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? (dead ? DEAD_PRESS_FILL : '#2563eb') : 'transparent',
  color: primary ? (dead ? DEAD_PRESS_TEXT : '#fff') : 'var(--text-link)',
  cursor: dead ? 'default' : 'pointer',
})

/** Where a stretch's fact comes from, as a choice reads. */
const SOURCE_LABEL: Record<EngagementSource, string> = {
  contract: 'A signed paper',
  payroll: 'How they were paid',
  owner: 'The owner’s statement',
  record: 'A record on file',
  other: 'Another source',
}

type Form = 'record' | 'change' | 'end' | null
const EMPTY = { kind: 'employee' as string, startedOn: '', endedOn: '', source: 'contract' as string, sourceRef: '', note: '' }

export function PersonStandingWindow({
  personId,
  personName,
  rows,
  heldWhy,
  todayYmd,
  canWrite,
  onClose,
  onChanged,
  showToast,
}: {
  personId: string
  personName: string
  rows: ReadonlyArray<PersonEngagementRow>
  heldWhy: string | null
  todayYmd: string
  canWrite: boolean
  onClose: () => void
  onChanged: () => void | Promise<void>
  showToast: (message: string, kind: 'success' | 'error') => void
}) {
  const [form, setForm] = useState<Form>(null)
  const [draft, setDraft] = useState(EMPTY)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [takingOff, setTakingOff] = useState<string | null>(null)
  const [why, setWhy] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const stretches = liveEngagements(rows)
  const running = runningEngagement(rows)
  const now = standingWords(rows)
  const otherKind: EngagementKind = running?.kind === 'employee' ? 'subcontractor' : 'employee'

  const open = (next: Form) => {
    setTried(false)
    setTakingOff(null)
    setDraft(next === 'change' ? { ...EMPTY, kind: otherKind, startedOn: todayYmd } : next === 'end' ? { ...EMPTY, endedOn: todayYmd } : EMPTY)
    setForm(next)
  }

  const write = async (payload: Record<string, unknown>, done: string): Promise<void> => {
    if (busy) return
    setBusy(true)
    const r = await writePersonEngagement(payload)
    setBusy(false)
    if (!r.ok) {
      showToast(`Not written: ${r.why}`, 'error')
      return
    }
    showToast(done, 'success')
    setForm(null)
    setTakingOff(null)
    setWhy('')
    await onChanged()
  }

  const recordProblem = engagementDraftProblem({ kind: draft.kind, startedOn: draft.startedOn, endedOn: draft.endedOn || null, source: draft.source, sourceRef: draft.sourceRef, note: draft.note }, rows)
  const changeProblem = !draft.startedOn ? 'Set the day the change takes hold.' : running && draft.startedOn <= running.startedOn ? 'The change is after the running stretch’s first day.' : null
  const endProblem = !draft.endedOn ? 'Set the last day.' : running && draft.endedOn < running.startedOn ? 'The last day is before the stretch’s first day.' : null
  const problem = form === 'record' ? recordProblem : form === 'change' ? changeProblem : form === 'end' ? endProblem : null

  const submit = () => {
    setTried(true)
    if (problem || !form) return
    if (form === 'record') void write(engagementOpenPayload(personId, { kind: draft.kind, startedOn: draft.startedOn, endedOn: draft.endedOn || null, source: draft.source, sourceRef: draft.sourceRef, note: draft.note }), 'The stretch is on the file.')
    else if (form === 'change') void write(engagementChangePayload(personId, { kind: draft.kind, on: draft.startedOn, source: draft.source, sourceRef: draft.sourceRef, note: draft.note }), 'The standing is changed.')
    else void write(engagementClosePayload(personId, draft.endedOn), 'The stretch is ended.')
  }

  const kindField = (
    <label style={{ minWidth: 0 }}>
      <span style={LABEL}>As</span>
      <select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} style={FIELD} aria-label="Standing kind">
        {ENGAGEMENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {engagementKindWords(k)}
          </option>
        ))}
      </select>
    </label>
  )
  const sourceFields = (
    <>
      <label style={{ minWidth: 0 }}>
        <span style={LABEL}>Where the fact comes from</span>
        <select value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} style={FIELD} aria-label="Where the fact comes from">
          {ENGAGEMENT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label style={{ minWidth: 0 }}>
        <span style={LABEL}>Which one</span>
        <input type="text" value={draft.sourceRef} maxLength={300} placeholder="The paper, the pay run, the record" onChange={(e) => setDraft((d) => ({ ...d, sourceRef: e.target.value }))} style={FIELD} aria-label="Which paper or record" />
      </label>
    </>
  )
  const noteField = (
    <label style={{ display: 'block', marginTop: '0.55rem' }}>
      <span style={LABEL}>Note</span>
      <input type="text" value={draft.note} maxLength={1000} placeholder="Anything a reader should know" onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} style={FIELD} aria-label="Note" />
    </label>
  )
  const submitLabel = form === 'record' ? 'Record the stretch' : form === 'change' ? 'Change the standing' : 'End the stretch'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 760, padding: 'calc(var(--app-top-chrome, 0px) + 1.5rem) 0.75rem 1.5rem', overflowY: 'auto' }} onClick={() => (busy ? null : onClose())}>
      <div role="dialog" aria-modal="true" aria-labelledby="person-standing-title" data-testid="person-standing-window" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.1rem 1.2rem 1rem', width: '100%', maxWidth: 560, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <h3 id="person-standing-title" style={{ margin: '0 0 0.15rem', fontSize: '1.05rem' }}>
          Standing
        </h3>
        <p style={{ margin: '0 0 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>What {personName} was to the company, day by day: employee or subcontractor. A stretch is closed by its last day. It is never deleted.</p>

        {heldWhy ? <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: 'var(--text-amber-700)' }}>The standing could not be read: {heldWhy}</p> : null}

        {now ? (
          <p data-testid="person-standing-now" style={{ margin: 0, fontSize: '0.92rem', fontWeight: 650 }}>
            {now}
          </p>
        ) : heldWhy ? null : (
          <EmptyState compact main="Nothing on file yet." {...(canWrite ? { next: { label: 'Record a stretch…', onPress: () => open('record') }, tail: 'records the first, with the day it began.' } : {})} />
        )}

        {stretches.length > 0 ? (
          <>
            <p style={HEAD}>On file</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' }}>
              {[...stretches].reverse().map((e) => (
                <li key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
                  <div style={{ fontSize: '0.84rem' }}>{engagementLineWords(e)}</div>
                  {e.sourceRef.trim() || e.note.trim() ? <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{[e.sourceRef.trim(), e.note.trim()].filter(Boolean).join(' · ')}</div> : null}
                  {canWrite && takingOff !== e.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setForm(null)
                        setWhy('')
                        setTakingOff(e.id)
                      }}
                      style={{ ...press(false), border: 'none', padding: '0.2rem 0', marginTop: '0.25rem', textDecoration: 'underline' }}
                    >
                      Take it off…
                    </button>
                  ) : null}
                  {canWrite && takingOff === e.id ? (
                    <div style={{ marginTop: '0.4rem', display: 'grid', gap: '0.4rem' }}>
                      <label>
                        <span style={LABEL}>Why it comes off</span>
                        <input type="text" value={why} maxLength={200} placeholder="Recorded by mistake, the wrong person, the wrong days" onChange={(ev) => setWhy(ev.target.value)} style={FIELD} aria-label="Why it comes off" />
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" disabled={busy || !why.trim()} onClick={() => void write(engagementWithdrawPayload(personId, e.id, why), 'The stretch is off the file, with its reason.')} style={press(true, busy || !why.trim())}>
                          Take the stretch off
                        </button>
                        <button type="button" onClick={() => setTakingOff(null)} style={press(false)}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* With nothing on file the empty line above carries the one press, so it is not drawn twice. */}
        {canWrite && form === null && (stretches.length > 0 || heldWhy) ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
            {running ? (
              <>
                <button type="button" onClick={() => open('change')} style={press(true)}>
                  Change to {engagementKindWords(otherKind).toLowerCase()}…
                </button>
                <button type="button" onClick={() => open('end')} style={press(false)}>
                  End the stretch…
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => open('record')} style={press(!running)}>
              Record a stretch…
            </button>
          </div>
        ) : null}

        {canWrite && form !== null ? (
          <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
            {form === 'record' ? (
              <>
                <div style={GRID}>
                  {kindField}
                  <label style={{ minWidth: 0 }}>
                    <span style={LABEL}>First day</span>
                    <input type="date" value={draft.startedOn} onChange={(e) => setDraft((d) => ({ ...d, startedOn: e.target.value }))} style={FIELD} aria-label="First day" />
                  </label>
                  <label style={{ minWidth: 0 }}>
                    <span style={LABEL}>Last day, when it has ended</span>
                    <input type="date" value={draft.endedOn} onChange={(e) => setDraft((d) => ({ ...d, endedOn: e.target.value }))} style={FIELD} aria-label="Last day" />
                  </label>
                  {sourceFields}
                </div>
                {noteField}
              </>
            ) : form === 'change' ? (
              <>
                <p style={{ margin: '0 0 0.55rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>The running stretch ends the day before. The new one starts on the day you set.</p>
                <div style={GRID}>
                  {kindField}
                  <label style={{ minWidth: 0 }}>
                    <span style={LABEL}>From this day</span>
                    <input type="date" value={draft.startedOn} onChange={(e) => setDraft((d) => ({ ...d, startedOn: e.target.value }))} style={FIELD} aria-label="From this day" />
                  </label>
                  {sourceFields}
                </div>
                {noteField}
              </>
            ) : (
              <div style={GRID}>
                <label style={{ minWidth: 0 }}>
                  <span style={LABEL}>Last day</span>
                  <input type="date" value={draft.endedOn} onChange={(e) => setDraft((d) => ({ ...d, endedOn: e.target.value }))} style={FIELD} aria-label="Last day" />
                </label>
              </div>
            )}
            {tried && problem ? <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{problem}</p> : null}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
              <button type="button" disabled={busy} onClick={submit} style={press(true, busy)}>
                {submitLabel}
              </button>
              <button type="button" onClick={() => setForm(null)} style={press(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} style={press(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
