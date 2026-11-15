/**
 * Move everything on site to another job (punch list #209, v2.7305): the office's window for the whole-job move the
 * dev seat has had since v2.6808. Pick the receiving job (the jobs on the same site first, then a search), press
 * **Read the plan**, and the dry run's plan is drawn as the confirm window: what moves per table, the places that
 * become one, the labels that change, each job's boxes and parts before and after, and the photos' files following
 * by the sweep. The confirm button carries the verb and the counts (*Move 91 boxes and 284 presses to JP1091*); the
 * apply runs the same RPC, and a refusal is said with its reason. Opened from the desk's site row with no source,
 * the window picks the source from that site's jobs too. The words and the plan's rows are `lib/materials/onSiteMoveJob.ts`;
 * the calls are `onSiteMoveJobIo.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  beforeAfterRows,
  labelsChangedWords,
  MOVE_JOB_TITLE,
  moveDoneWords,
  movedRows,
  movePressLabel,
  moveTargetChoices,
  MOVING_WORDS,
  NO_TARGET_WORDS,
  photosFollowWords,
  PICK_SOURCE_LABEL,
  PICK_TARGET_LABEL,
  PICK_WORDS,
  placesFoldedWords,
  planHeadWords,
  READ_PLAN_LABEL,
  READING_PLAN_WORDS,
  SAME_SITE_HEAD,
  SEARCH_TARGET_HINT,
  SEARCH_TARGET_LABEL,
  searchFoundWords,
  type MoveJobChoice,
  type OnSiteMovePlan,
} from '../../lib/materials/onSiteMoveJob'
import { afterOnSiteMove, applyOnSiteMove, planOnSiteMove } from '../../lib/materials/onSiteMoveJobIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }
const btnDead: CSSProperties = { ...btn, background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const field: CSSProperties = { minHeight: 36, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', padding: '0 0.6rem', width: '100%', boxSizing: 'border-box' }
const choice = (on: boolean): CSSProperties => ({ ...btn, minHeight: 32, fontSize: '0.8rem', fontWeight: on ? 700 : 500, justifyContent: 'flex-start', textAlign: 'left', width: '100%', ...(on ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) })
const sec: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }
const secH: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }
const refusal: CSSProperties = { ...sec, background: 'var(--bg-red-100)', borderColor: 'var(--text-red-700)', color: 'var(--text-red-700)', fontWeight: 600 }
const th: CSSProperties = { textAlign: 'left', padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

type Props = {
  /** The job the material is recorded under; null from the desk's site row, where the window picks it from `sourceChoices`. */
  sourceJobId: string | null
  /** The site's jobs with boxes, when the source is picked here. */
  sourceChoices?: ReadonlyArray<MoveJobChoice>
  /** Every job the page knows, for the same-site list and the search. */
  jobs: ReadonlyArray<MoveJobChoice>
  siteOfJob: ReadonlyMap<string, string | null | undefined>
  role: string | null | undefined
  onClose: () => void
  /** Told once the move landed, with the sentence to say. */
  onMoved: (fromJobId: string, toJobId: string, words: string) => void
  /** The dry run, the apply and the reads after; a test hands spies. */
  plan?: (fromJobId: string, toJobId: string) => Promise<OnSiteMovePlan>
  apply?: (fromJobId: string, toJobId: string) => Promise<OnSiteMovePlan>
  after?: (fromJobId: string, toJobId: string, role: string | null | undefined) => Promise<string>
}

export default function OnSiteMoveJobModal({ sourceJobId, sourceChoices = [], jobs, siteOfJob, role, onClose, onMoved, plan = planOnSiteMove, apply = applyOnSiteMove, after = afterOnSiteMove }: Props) {
  const [source, setSource] = useState<string | null>(sourceJobId)
  const [target, setTarget] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [read, setRead] = useState<OnSiteMovePlan | null>(null)
  const [busy, setBusy] = useState<'reading' | 'moving' | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const choices = useMemo(() => moveTargetChoices(jobs, source, siteOfJob, query), [jobs, source, siteOfJob, query])
  const labelOf = (id: string | null) => (id ? jobs.find((j) => j.id === id)?.label ?? sourceChoices.find((j) => j.id === id)?.label ?? id : '')
  // A new pick is a new plan: what was read is for the pair it was read for.
  useEffect(() => { setRead(null); setRefused(null) }, [source, target])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const readPlan = async () => {
    if (!source || !target || busy) return
    setBusy('reading')
    setRefused(null)
    try {
      setRead(await plan(source, target))
    } catch (e) {
      setRefused(formatErrorMessage(e, 'The plan could not be read.'))
    } finally {
      setBusy(null)
    }
  }
  const move = async () => {
    if (!source || !target || !read || busy) return
    setBusy('moving')
    setRefused(null)
    try {
      const landed = await apply(source, target)
      const photos = await after(source, target, role)
      onMoved(source, target, moveDoneWords(landed, photos))
      onClose()
    } catch (e) {
      // Refused: nothing was written, and the window says why. The plan stays for a second press once the reason is fixed.
      setRefused(formatErrorMessage(e, 'The move was refused. Nothing moved.'))
      setBusy(null)
    }
  }

  const canRead = Boolean(source && target && source !== target) && !busy
  const picker = (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="move-job-pick">
      <p style={{ ...muted, margin: 0 }}>{PICK_WORDS}</p>
      {sourceJobId ? (
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{PICK_SOURCE_LABEL}</span>
          <span style={{ fontWeight: 700 }} data-testid="move-job-source">{labelOf(sourceJobId)}</span>
        </div>
      ) : (
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>
          {PICK_SOURCE_LABEL}
          <select value={source ?? ''} onChange={(e) => { setSource(e.target.value || null); if (e.target.value === target) setTarget(null) }} aria-label={PICK_SOURCE_LABEL} style={field} data-testid="move-job-source-pick">
            <option value="">Choose…</option>
            {sourceChoices.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </label>
      )}
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{PICK_TARGET_LABEL}</span>
        {choices.sameSite.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.3rem' }} role="group" aria-label={SAME_SITE_HEAD} data-testid="move-job-same-site">
            <span style={muted}>{SAME_SITE_HEAD}</span>
            {choices.sameSite.map((j) => <button key={j.id} type="button" style={choice(target === j.id)} aria-pressed={target === j.id} onClick={() => setTarget(j.id)}>{j.label}</button>)}
          </div>
        ) : null}
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem', fontWeight: 600 }}>
          {SEARCH_TARGET_LABEL}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={SEARCH_TARGET_HINT} aria-label={SEARCH_TARGET_LABEL} style={field} />
        </label>
        {choices.found.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.3rem' }} data-testid="move-job-found">
            {choices.found.map((j) => <button key={j.id} type="button" style={choice(target === j.id)} aria-pressed={target === j.id} onClick={() => setTarget(j.id)}>{j.label}</button>)}
          </div>
        ) : null}
        {searchFoundWords(choices.found, query) ? <span style={muted}>{searchFoundWords(choices.found, query)}</span> : null}
        {target && !choices.sameSite.some((j) => j.id === target) && !choices.found.some((j) => j.id === target) ? <span style={{ fontWeight: 700 }} data-testid="move-job-target">{labelOf(target)}</span> : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={canRead ? btnPrimary : btnDead} disabled={!canRead} aria-disabled={!canRead} onClick={() => void readPlan()} data-testid="move-job-read">{busy === 'reading' ? READING_PLAN_WORDS : READ_PLAN_LABEL}</button>
        {!target ? <span style={muted}>{NO_TARGET_WORDS}</span> : null}
      </div>
    </div>
  )

  const planView = read ? (() => {
    const rows = movedRows(read)
    const folded = placesFoldedWords(read)
    const labels = labelsChangedWords(read)
    const [src, tgt] = beforeAfterRows(read)
    const label = movePressLabel(read)
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }} data-testid="move-job-plan">
        <p style={{ margin: 0, fontWeight: 700 }}>{planHeadWords(read)}</p>
        <div style={sec}>
          <h3 style={secH}>What moves</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.15rem' }} data-testid="move-job-moved">
            {rows.map((r) => <li key={r.key}><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{r.n.toLocaleString('en-US')}</strong> {r.label}</li>)}
          </ul>
          <span style={muted}>Every cage and box keeps its code, its label and its history.</span>
        </div>
        {folded.length > 0 || labels.length > 0 ? (
          <div style={sec} data-testid="move-job-folds">
            <h3 style={secH}>{folded.length > 0 && labels.length > 0 ? 'Places that become one and labels that change' : folded.length > 0 ? 'Places that become one' : 'Labels that change'}</h3>
            {folded.map((w) => <span key={w}>{w}</span>)}
            {labels.map((w) => <span key={w}>{w}</span>)}
          </div>
        ) : null}
        <div style={{ ...sec, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="move-job-before-after">
            <thead><tr><th style={th}>Job</th><th style={{ ...th, ...num }}>Boxes before</th><th style={{ ...th, ...num }}>Boxes after</th><th style={{ ...th, ...num }}>Parts before</th><th style={{ ...th, ...num }}>Parts after</th></tr></thead>
            <tbody>
              {[src, tgt].map((r) => (
                <tr key={r.label}>
                  <td style={td}><strong>{r.label}</strong>{r.name ? <span style={muted}> · {r.name}</span> : null}</td>
                  <td style={{ ...td, ...num }}>{r.boxesBefore.toLocaleString('en-US')}</td>
                  <td style={{ ...td, ...num, fontWeight: 700 }}>{r.boxesAfter.toLocaleString('en-US')}</td>
                  <td style={{ ...td, ...num }}>{r.partsBefore.toLocaleString('en-US')}</td>
                  <td style={{ ...td, ...num, fontWeight: 700 }}>{r.partsAfter.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!read.onHand.holds ? <div style={{ ...sec, background: 'var(--bg-amber-100)', borderColor: 'var(--text-amber-800)' }} data-testid="move-job-on-hand">{read.onHand.words}</div> : null}
        <div style={sec}>
          <h3 style={secH}>The photos’ files</h3>
          <span data-testid="move-job-photos">{photosFollowWords(read)}</span>
        </div>
        {read.ties.into && (read.moved.ties > 0 || read.moved.prices > 0) ? <div style={sec}><h3 style={secH}>Same part? answers and prices</h3><span>{read.ties.words}</span></div> : null}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={busy ? btnDead : btnPrimary} disabled={Boolean(busy)} aria-disabled={Boolean(busy)} onClick={() => void move()} data-testid="move-job-confirm">{busy === 'moving' ? MOVING_WORDS : label}</button>
          <button type="button" style={btn} disabled={Boolean(busy)} onClick={() => setRead(null)}>Back</button>
          <span style={muted}>A note lands on both jobs.</span>
        </div>
      </div>
    )
  })() : null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={() => { if (!busy) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={MOVE_JOB_TITLE} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)', display: 'grid', gap: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{MOVE_JOB_TITLE}</h2>
            {read ? <span style={muted}>{labelOf(source)} to {labelOf(target)}</span> : null}
          </div>
          <button type="button" style={{ ...btn, flex: '0 0 auto' }} disabled={Boolean(busy)} onClick={onClose}>Close</button>
        </div>
        {refused ? <div role="alert" style={refusal} data-testid="move-job-refused">{refused}</div> : null}
        {planView ?? picker}
      </div>
    </div>,
    document.body,
  )
}
