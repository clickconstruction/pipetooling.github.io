import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import { timelineCountChips, timelineStrip } from '../../../lib/legal/timelineStrip'
import LegalTimelineStrip from './LegalTimelineStrip'
import { LEGAL_TIMELINE_LANES, composerDeadlineSuggestion, composerKind, eventDraftProblem, planDraftProblem, timelineCountsWords, timelineDayWords, timelineEmptyWords, timelineHoldKey, timelineInLane, timelineLaneCounts, type LegalComposerKind, type LegalEventDraft, type LegalPlanDraft, type LegalTimeline, type LegalTimelineDeadline, type LegalTimelineItem, type LegalTimelineLane } from '../../../lib/legal/legalTimeline'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { EmptyState } from '../../EmptyState'

/**
 * The Timeline (v2.5800): one vertical line of what has happened on a matter and what is planned next, with
 * notes on each item, drawn the same way on the Legal desk (theme tokens) and on the firm's portal (the
 * portal's paper). The kernel (`src/lib/legal/legalTimeline.ts`) merges the stream and the documents and
 * splits them around today; this file only draws, and takes the acts a side may perform:
 *
 *   - the office: plan a step, change one, mark one done, hold one back from counsel, undo one it wrote, and
 *     since v2.5836 (punch list #167) record what happened — an event on its own day, with the Evidence
 *     documents that prove it, held and undone like a planned step;
 *   - the firm: plan a step (through its own form, passed as `footer`) and undo its own;
 *   - the desk's preview and a read-only firm: nothing.
 *
 * Marking done keeps the step on the line, moved to the day it was done, reading *Done Oct 18. Planned for
 * Oct 20.* A document appears as a read-only *added* item with two doors (v2.6166): **Open the paper**, the file
 * itself in a new browser tab without leaving the line (the Evidence row's own open, `onOpenDocument`, a refusal
 * or a lost file worded under the line), and **Show on Evidence ↗**, which lands the Evidence tab on that row
 * (`onOpenEvidence` with the id). Since v2.5842
 * (punch list #170) the lien clock's deadlines sit on the line too, read only, each a diamond on its statutory
 * day with *Record it…* to the job's Lien window on the desk; a planned step may name the deadline it serves,
 * and reads *after the deadline* in red when it falls past it.
 */

export type TimelineLook = { text: string; muted: string; faint: string; hair: string; surface: string; band: string; accent: string; stop: string; ok: string; warn: string; font?: string }

/** The desk: theme tokens, so the panel follows light and dark. Saturated status colors stay literal, as the desk's pills do. */
export const DESK_LOOK: TimelineLook = { text: 'var(--text)', muted: 'var(--text-muted)', faint: 'var(--text-muted)', hair: 'var(--border)', surface: 'var(--surface)', band: 'var(--bg-muted)', accent: 'var(--text-blue-700)', stop: '#b42318', ok: '#1f7a3a', warn: '#9a6700' }
/** The firm's portal: the paper palette every portal surface pins light. */
export const PORTAL_LOOK: TimelineLook = { text: INK, muted: MUTED, faint: FAINT, hair: HAIR, surface: CARD, band: NOTE_BAND, accent: COPPER, stop: PAPER_RED, ok: PAPER_GREEN, warn: COPPER }

export type TimelineHold = {
  /** Hold a planned step back from counsel with a reason (#85 item 29), by its `held_overrides` key. */
  holdBack: (key: string, reason: string) => Promise<void>
  shareAgain: (key: string) => Promise<void>
}

export type TimelinePlanActs = {
  busy: boolean
  /** Plan a step; true when it saved. Absent on a side that cannot add (the desk's preview). */
  add?: (draft: LegalPlanDraft) => Promise<boolean>
  /** Record what happened (v2.5836); true when it saved. The office only. */
  addEvent?: (draft: LegalEventDraft) => Promise<boolean>
  /** The matter's live Evidence documents, for an event to name. */
  documents?: ReadonlyArray<{ id: string; title: string }>
  /** Change a live planned step. The office only. */
  update?: (entryId: string, draft: LegalPlanDraft) => Promise<boolean>
  /** Say a planned step happened, on a day not ahead of today. The office only. */
  markDone?: (entryId: string, doneOn: string, note: string) => Promise<boolean>
  /** Undo with a reason; `canUndo` says which items this side may undo. */
  undo?: (entryId: string, reason: string) => Promise<boolean>
  canUndo?: (item: LegalTimelineItem) => boolean
  /** The office's hold door; absent on the portal. */
  hold?: TimelineHold
}

export type LegalTimelinePanelProps = {
  timeline: LegalTimeline
  todayYmd: string
  reader: 'office' | 'firm'
  look?: TimelineLook
  /** Null: read only. */
  acts?: TimelinePlanActs | null
  /** A document item's door. */
  /** Show on Evidence (v2.6166): the Evidence tab opened on a document's row, lit; null lands on the tab alone. */
  onOpenEvidence?: (documentId: string | null) => void
  /** Open the paper (v2.6166): the file itself, the way the Evidence row opens it; rejects with the reason. Absent, the door is not drawn. */
  onOpenDocument?: (documentId: string) => Promise<void>
  /** Drawn under the line: the portal's own plan form. */
  footer?: ReactNode
  /** How many past items show before the fold. */
  pastShown?: number
  /** A deadline item's door to the job's Lien window (v2.5842); absent on the portal. */
  onOpenLienWindow?: (jobId: string) => void
  /** Doors drawn in the header's right (v2.5851: They said…, Call mode, Customer notes). */
  doors?: ReactNode
  /** Show the lane chips (v2.5851, the desk); the portal keeps the plain line. */
  lanes?: boolean
}

const EARLIER_SHOWN = 6
/** v2.5850: this many documents added on one day fold into one row until opened. */
const DOC_FOLD_AT = 4

type Burst = { kind: 'burst'; ymd: string; items: LegalTimelineItem[] } | { kind: 'one'; item: LegalTimelineItem }

/** v2.5850: consecutive documents that sit on one day because they were added that day (no day of their own) fold into one row. */
function foldDocumentBursts(items: ReadonlyArray<LegalTimelineItem>): Burst[] {
  const out: Burst[] = []
  let i = 0
  while (i < items.length) {
    const it = items[i]!
    if (it.kind === 'document' && it.stateWords === 'Added to Evidence.') {
      let j = i
      while (j < items.length && items[j]!.kind === 'document' && items[j]!.ymd === it.ymd && items[j]!.stateWords === 'Added to Evidence.') j++
      if (j - i >= DOC_FOLD_AT) { out.push({ kind: 'burst', ymd: it.ymd, items: items.slice(i, j) }); i = j; continue }
    }
    out.push({ kind: 'one', item: it })
    i++
  }
  return out
}

function chip(text: string, look: TimelineLook, color?: string, title?: string): ReactNode {
  return <span title={title} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: look.band, color: color ?? look.muted, whiteSpace: 'nowrap' }}>{text}</span>
}

function stateColor(item: LegalTimelineItem, look: TimelineLook): string {
  switch (item.state) {
    case 'overdue': return look.stop
    case 'due_today': return look.warn
    case 'done': return look.ok
    case 'planned': return look.accent
    case 'undone': return look.faint
    default: return look.muted
  }
}

export default function LegalTimelinePanel({ timeline: whole, todayYmd, reader, look = DESK_LOOK, acts = null, onOpenEvidence, onOpenDocument, footer, pastShown = EARLIER_SHOWN, onOpenLienWindow, doors, lanes = false }: LegalTimelinePanelProps) {
  const [allPast, setAllPast] = useState(false)
  const [lane, setLane] = useState<LegalTimelineLane | null>(null)
  // v2.5892: the composer sleeps behind one door so the line reads first.
  const [composerOpen, setComposerOpen] = useState(false)
  const canAdd = Boolean(acts?.add || acts?.addEvent)
  const timeline = timelineInLane(whole, lane)
  const laneCounts = timelineLaneCounts(whole)
  const total = timeline.past.length + timeline.today.length + timeline.upcoming.length
  const hiddenPast = allPast ? 0 : Math.max(0, timeline.past.length - pastShown)
  const past = hiddenPast ? timeline.past.slice(hiddenPast) : timeline.past
  const counts = timelineCountsWords(timeline.counts)
  const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: `1px solid ${look.hair}`, borderRadius: 4, background: look.surface, color: look.text, font: 'inherit', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
  const cap: CSSProperties = { margin: '14px 0 6px', fontSize: '0.74rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: look.muted, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }
  const rowProps = { look, todayYmd, reader, acts, onOpenEvidence, onOpenDocument, onOpenLienWindow, btn, deadlines: timeline.deadlines }
  const [openBursts, setOpenBursts] = useState<Record<string, boolean>>({})
  // v2.6107 (punch list #214, PR 4): the line as a strip of days; a press on a day unfolds the past and scrolls to it.
  const strip = timelineStrip(timeline, todayYmd)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const jumpToDay = (ymd: string) => {
    setAllPast(true)
    window.setTimeout(() => rootRef.current?.querySelector(`[data-legal-timeline-day="${ymd}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0)
  }
  const rows = (items: ReadonlyArray<LegalTimelineItem>) => foldDocumentBursts(items).map((b) => {
    if (b.kind === 'one') return <TimelineRow key={b.item.key} item={b.item} {...rowProps} />
    const key = `burst:${b.ymd}`
    if (openBursts[key]) return b.items.map((it) => <TimelineRow key={it.key} item={it} {...rowProps} />)
    return (
      <div key={key} data-legal-timeline-burst={b.ymd} data-legal-timeline-day={b.ymd} style={{ display: 'grid', gridTemplateColumns: '118px 18px 1fr', gap: 8, alignItems: 'start' }}>
        <div style={{ fontSize: '0.78rem', color: look.muted, textAlign: 'right', paddingTop: 10, paddingRight: 6, whiteSpace: 'nowrap' }}>{timelineDayWords(b.ymd, todayYmd)}</div>
        <div style={{ display: 'grid', justifyItems: 'center', alignSelf: 'stretch', gridTemplateRows: '14px 1fr' }}>
          <span aria-hidden style={{ marginTop: 11, width: 8, height: 8, borderRadius: 2, background: look.muted, border: `2px solid ${look.muted}`, boxSizing: 'border-box' }} />
          <span aria-hidden style={{ width: 2, background: look.hair, height: '100%', minHeight: 14 }} />
        </div>
        <div style={{ padding: '6px 0 10px', minWidth: 0, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{b.items.length} documents added to Evidence</span>
          <span style={{ fontSize: '0.78rem', color: look.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>{b.items.map((it) => it.what).join(' · ')}</span>
          <button type="button" onClick={() => setOpenBursts((o) => ({ ...o, [key]: true }))} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Show each</button>
          {onOpenEvidence ? <button type="button" onClick={() => onOpenEvidence(b.items[0]?.documentId ?? null)} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Show on Evidence ↗</button> : null}
        </div>
      </div>
    )
  })
  return (
    <div ref={rootRef} data-legal-timeline style={{ color: look.text, fontFamily: look.font }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '6px 0 2px' }}>
        <h4 style={{ margin: 0, fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: look.muted }}>What happened, and what is planned next</h4>
        {counts ? <span data-legal-timeline-counts title={counts} style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{timelineCountChips(timeline.counts).map((c) => <span key={c.key} data-legal-timeline-count={c.key} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: look.band, color: c.tone === 'stop' ? look.stop : c.tone === 'warn' ? look.warn : c.tone === 'ok' ? look.ok : look.muted, whiteSpace: 'nowrap' }}>{c.text}</span>)}</span> : null}
        {timeline.counts.held && reader === 'office' ? <span style={{ fontSize: '0.78rem', color: look.warn }}>{timeline.counts.held} held from counsel</span> : null}
        {doors ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{doors}</span> : null}
      </div>
      {lanes || canAdd ? (
        <div role="group" aria-label="Lanes" data-legal-timeline-lanes style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0 2px' }}>
          {lanes ? [{ lane: null as LegalTimelineLane | null, label: 'All' }, ...LEGAL_TIMELINE_LANES].map((l) => {
            const on = lane === l.lane
            const n = l.lane ? laneCounts[l.lane] : whole.past.length + whole.today.length + whole.upcoming.length
            return <button key={l.label} type="button" aria-pressed={on} onClick={() => setLane(l.lane)} style={{ ...btn, height: 24, fontSize: '0.72rem', ...(on ? { background: look.text, color: look.surface, border: `1px solid ${look.text}` } : null) }}>{l.label} · {n}</button>
          }) : null}
          {canAdd ? (
            <button type="button" data-legal-composer-door aria-expanded={composerOpen} onClick={() => setComposerOpen((o) => !o)} style={{ ...btn, gap: 5, marginLeft: 'auto', ...(composerOpen ? { background: look.text, color: look.surface, border: `1px solid ${look.text}` } : null) }}>
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
              Add to the timeline
            </button>
          ) : null}
        </div>
      ) : null}
      {total > 0 ? <LegalTimelineStrip strip={strip} look={look} onDay={jumpToDay} /> : null}
      {composerOpen && acts && canAdd ? <ComposerForm look={look} todayYmd={todayYmd} acts={acts} btn={btn} deadlines={timeline.deadlines} onClose={() => setComposerOpen(false)} /> : null}
      {total === 0 ? (
        // Empty words (punch list #184, sweep C): an empty lane offers All, and "Press Add to the timeline" is that press now.
        <div data-legal-timeline-empty>
          <EmptyState compact {...timelineEmptyWords({ laneLabel: lane ? LEGAL_TIMELINE_LANES.find((l) => l.lane === lane)?.label ?? null : null, canAdd, composerOpen, showAll: () => setLane(null), openComposer: () => setComposerOpen(true) })} />
        </div>
      ) : null}
      {timeline.past.length ? (
        <>
          <div style={cap}><span>Earlier</span>{hiddenPast ? <button type="button" onClick={() => setAllPast(true)} style={{ ...btn, height: 22, fontSize: '0.7rem', textTransform: 'none', letterSpacing: 0 }}>Show {hiddenPast} earlier</button> : null}</div>
          {rows(past)}
        </>
      ) : null}
      <div data-legal-timeline-today role="separator" aria-label={`Today, ${timelineDayWords(todayYmd, todayYmd)}`} style={{ display: 'grid', gridTemplateColumns: '118px 18px 1fr', alignItems: 'center', gap: 8, margin: '12px 0 4px' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: look.warn, textAlign: 'right', paddingRight: 6 }}>Today</span>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: look.warn, justifySelf: 'center' }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: look.muted }}>
          <span style={{ whiteSpace: 'nowrap' }}>{timelineDayWords(todayYmd, todayYmd)}</span>
          <span aria-hidden style={{ flex: 1, height: 1, background: look.warn, opacity: 0.6 }} />
        </span>
      </div>
      {rows(timeline.today)}
      {timeline.upcoming.length ? (
        <>
          <div style={cap}><span>Ahead</span></div>
          {rows(timeline.upcoming)}
        </>
      ) : null}
      {footer}
    </div>
  )
}

/**
 * One composer (v2.5892): collapsed behind the Add to the timeline door so the line reads first. The day
 * decides the kind — a day ahead of today plans a step, today or earlier records what happened — and the tag
 * beside the day overrides it. A planned day landing just before an open lien-clock deadline offers that
 * deadline in one line instead of a standing select; Serves a deadline… still opens the full pick.
 */
function ComposerForm({ look, todayYmd, acts, btn, deadlines, onClose }: { look: TimelineLook; todayYmd: string; acts: TimelinePlanActs; btn: CSSProperties; deadlines: ReadonlyArray<LegalTimelineDeadline>; onClose: () => void }) {
  const [draft, setDraft] = useState<{ on: string; body: string; notes: string; deadlineKey: string | null; documentIds: string[] }>({ on: todayYmd, body: '', notes: '', deadlineKey: null, documentIds: [] })
  const [override, setOverride] = useState<LegalComposerKind | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const both = Boolean(acts.add && acts.addEvent)
  const kind: LegalComposerKind = both ? composerKind(draft.on, todayYmd, override) : acts.add ? 'plan' : 'event'
  const problem = kind === 'plan' ? planDraftProblem(draft) : eventDraftProblem(draft, todayYmd)
  const input = inputStyle(look)
  const documents = acts.documents ?? []
  const shownDocs = docsOpen ? documents : documents.filter((d, i) => i < 3 || draft.documentIds.includes(d.id))
  const choices = deadlines.filter((d) => !d.recorded)
  const suggested = kind === 'plan' && !draft.deadlineKey && !pickOpen ? composerDeadlineSuggestion(deadlines, draft.on, dismissed) : null
  const served = kind === 'plan' && draft.deadlineKey ? deadlines.find((d) => d.key === draft.deadlineKey) : undefined
  const late = served && draft.on ? draft.on > served.ymd : false
  const toggleDoc = (id: string) => setDraft((d) => ({ ...d, documentIds: d.documentIds.includes(id) ? d.documentIds.filter((x) => x !== id) : [...d.documentIds, id] }))
  const save = async () => {
    setTouched(true)
    if (problem) return
    const ok = kind === 'plan'
      ? await acts.add!({ on: draft.on, body: draft.body.trim(), notes: draft.notes.trim(), deadlineKey: draft.deadlineKey })
      : await acts.addEvent!({ on: draft.on, body: draft.body.trim(), notes: draft.notes.trim(), documentIds: draft.documentIds })
    if (ok) {
      setDraft({ on: todayYmd, body: '', notes: '', deadlineKey: null, documentIds: [] })
      setOverride(null)
      setDismissed([])
      setTouched(false)
      onClose()
    }
  }
  return (
    <form data-legal-composer onSubmit={(e) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 8, padding: '10px 12px', margin: '8px 0 4px', border: `1px solid ${look.hair}`, borderRadius: 8, background: look.surface }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" aria-label={kind === 'plan' ? 'Day planned for' : 'Day it happened'} value={draft.on} min={`${Number(todayYmd.slice(0, 4)) - 3}${todayYmd.slice(4)}`} onChange={(e) => setDraft({ ...draft, on: e.target.value })} style={input} />
        <input autoFocus aria-label={kind === 'plan' ? 'What is planned' : 'What happened'} value={draft.body} placeholder={kind === 'plan' ? 'Mail the lien notice to the owner and the GC' : 'The GC’s notice of termination arrived by email'} onChange={(e) => setDraft({ ...draft, body: e.target.value })} style={{ ...input, flex: '1 1 220px' }} />
        {both ? (
          <button type="button" data-legal-composer-kind={kind} onClick={() => setOverride(kind === 'plan' ? 'event' : 'plan')} title="The day decides; press to change it" style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: look.band, color: kind === 'plan' ? look.accent : look.muted, border: `1px solid ${look.hair}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>{kind === 'plan' ? 'planned step' : 'happened'}</button>
        ) : null}
      </div>
      {both ? <div style={{ fontSize: '0.72rem', color: look.faint, marginTop: -2 }}>{kind === 'plan' ? 'A day ahead of today makes this a planned step. Tap the tag to change it.' : 'Today or earlier records what happened. Tap the tag to change it.'}</div> : null}
      <textarea aria-label={kind === 'plan' ? 'Notes' : 'Event notes'} value={draft.notes} rows={draft.notes.length > 90 ? 3 : 1} placeholder={kind === 'plan' ? 'Who does it, what goes with it, what happens if they do not answer' : 'Who was there, what was said, what it changes'} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={{ ...input, resize: 'vertical' }} />
      {served ? (
        <div data-legal-composer-serves style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', color: look.muted }}>
          <span>Serves {served.what} · {timelineDayWords(served.ymd, todayYmd)}</span>
          {late ? <span data-legal-plan-late role="status" style={{ color: look.stop, fontWeight: 600 }}>After the deadline: the clock says {timelineDayWords(served.ymd, todayYmd)}.</span> : null}
          <button type="button" onClick={() => setDraft({ ...draft, deadlineKey: null })} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>No</button>
        </div>
      ) : null}
      {suggested ? (
        <div data-legal-composer-suggest style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: look.band, border: `1px solid ${look.hair}`, borderRadius: 6, padding: '7px 10px' }}>
          <span aria-hidden style={{ width: 8, height: 8, border: `2px solid ${look.warn}`, transform: 'rotate(45deg)', flex: 'none' }} />
          <span style={{ fontSize: '0.8rem', flex: '1 1 240px' }}>It lands before the {suggested.what}, due {timelineDayWords(suggested.ymd, todayYmd)}. Does it serve that deadline?</span>
          <button type="button" onClick={() => setDraft({ ...draft, deadlineKey: suggested.key })} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text }}>Serves it</button>
          <button type="button" onClick={() => setDismissed((x) => [...x, suggested.key])} style={btn}>No</button>
        </div>
      ) : null}
      {kind === 'plan' && !served && !suggested && choices.length ? (
        pickOpen ? (
          <label style={{ display: 'grid', gap: 3, fontSize: '0.72rem', color: look.muted }}>
            Serves the deadline
            <select aria-label="Deadline this step serves" value="" onChange={(e) => { if (e.target.value) setDraft({ ...draft, deadlineKey: e.target.value }); setPickOpen(false) }} style={input}>
              <option value="">None</option>
              {choices.map((d) => <option key={d.key} value={d.key}>{d.what} · {timelineDayWords(d.ymd, todayYmd)}</option>)}
            </select>
          </label>
        ) : (
          <div><button type="button" onClick={() => setPickOpen(true)} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Serves a deadline…</button></div>
        )
      ) : null}
      {kind === 'event' && documents.length ? (
        <div data-legal-composer-documents style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: look.muted, marginRight: 2 }}>The documents that prove it</span>
          {shownDocs.map((d) => {
            const on = draft.documentIds.includes(d.id)
            return <button key={d.id} type="button" aria-pressed={on} onClick={() => toggleDoc(d.id)} style={{ ...btn, height: 24, borderRadius: 999, fontSize: '0.72rem', ...(on ? { background: look.text, color: look.surface, border: `1px solid ${look.text}` } : null) }}>{on ? '✓ ' : ''}{d.title}</button>
          })}
          {!docsOpen && documents.length > shownDocs.length ? <button type="button" onClick={() => setDocsOpen(true)} style={{ ...btn, height: 24, borderRadius: 999, fontSize: '0.72rem', color: look.muted }}>{documents.length - shownDocs.length} more…</button> : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={acts.busy || Boolean(problem)} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text, opacity: acts.busy || problem ? 0.6 : 1 }}>{kind === 'plan' ? 'Add to the timeline' : 'Record it on the timeline'}</button>
        <button type="button" onClick={onClose} style={btn}>Cancel</button>
        {touched && problem ? <span role="alert" style={{ fontSize: '0.78rem', color: look.stop }}>{problem}</span> : problem && draft.body ? <span style={{ fontSize: '0.78rem', color: look.muted }}>{problem}</span> : null}
      </div>
    </form>
  )
}

function inputStyle(look: TimelineLook): CSSProperties {
  return { font: 'inherit', fontSize: '0.82rem', padding: '5px 8px', border: `1px solid ${look.hair}`, borderRadius: 4, background: look.surface, color: look.text, minWidth: 0 }
}

/** Plan a step: the day, what, and notes. The Save button says what it does and sleeps until the draft is sound. */
function PlanForm({ look, todayYmd, busy, onSave, btn, initial, onCancel, saveLabel = 'Add to the timeline', title = 'Plan a step', deadlines = [] }: { look: TimelineLook; todayYmd: string; busy: boolean; onSave: (d: LegalPlanDraft) => Promise<boolean>; btn: CSSProperties; initial?: LegalPlanDraft; onCancel?: () => void; saveLabel?: string; title?: string; deadlines?: ReadonlyArray<LegalTimelineDeadline> }) {
  const [draft, setDraft] = useState<LegalPlanDraft>(initial ?? { on: '', body: '', notes: '', deadlineKey: null })
  // v2.5842: the deadlines a step may serve — the clock's open ones, plus the one the step already names.
  const choices = deadlines.filter((d) => !d.recorded || d.key === initial?.deadlineKey)
  const served = draft.deadlineKey ? deadlines.find((d) => d.key === draft.deadlineKey) : undefined
  const late = served && draft.on && draft.on > served.ymd
  const [touched, setTouched] = useState(false)
  const problem = planDraftProblem(draft)
  const input = inputStyle(look)
  const lab: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.72rem', color: look.muted }
  const save = async () => {
    setTouched(true)
    if (problem) return
    if (await onSave({ on: draft.on, body: draft.body.trim(), notes: draft.notes.trim(), deadlineKey: draft.deadlineKey ?? null })) {
      if (!initial) setDraft({ on: '', body: '', notes: '', deadlineKey: null })
      setTouched(false)
      onCancel?.()
    }
  }
  return (
    <form data-legal-plan-form onSubmit={(e) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: 8, padding: '10px 12px', margin: '8px 0 4px', border: `1px solid ${look.hair}`, borderRadius: 8, background: look.surface }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, auto) minmax(0, 1fr)', gap: 8 }}>
        <label style={lab}>Day<input type="date" aria-label="Day planned for" value={draft.on} min={`${Number(todayYmd.slice(0, 4)) - 3}${todayYmd.slice(4)}`} onChange={(e) => setDraft({ ...draft, on: e.target.value })} style={input} /></label>
        <label style={lab}>What<input aria-label="What is planned" value={draft.body} placeholder="Mail the lien notice to the owner and the GC" onChange={(e) => setDraft({ ...draft, body: e.target.value })} style={input} /></label>
      </div>
      <label style={lab}>Notes<textarea aria-label="Notes" value={draft.notes} rows={2} placeholder="Who does it, what goes with it, what happens if they do not answer" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={{ ...input, resize: 'vertical' }} /></label>
      {choices.length ? (
        <label style={lab}>
          Serves the deadline
          <select aria-label="Deadline this step serves" value={draft.deadlineKey ?? ''} onChange={(e) => setDraft({ ...draft, deadlineKey: e.target.value || null })} style={input}>
            <option value="">None</option>
            {choices.map((d) => <option key={d.key} value={d.key}>{d.what} · {timelineDayWords(d.ymd, todayYmd)}</option>)}
          </select>
          {late ? <span data-legal-plan-late role="status" style={{ fontSize: '0.76rem', color: look.stop, fontWeight: 600 }}>After the deadline: the clock says {timelineDayWords(served!.ymd, todayYmd)}.</span> : null}
        </label>
      ) : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy || Boolean(problem)} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text, opacity: busy || problem ? 0.6 : 1 }}>{saveLabel}</button>
        {onCancel ? <button type="button" onClick={onCancel} style={btn}>Cancel</button> : null}
        {touched && problem ? <span role="alert" style={{ fontSize: '0.78rem', color: look.stop }}>{problem}</span> : problem && (draft.body || draft.on) ? <span style={{ fontSize: '0.78rem', color: look.muted }}>{problem}</span> : null}
      </div>
    </form>
  )
}

type Mode = null | 'edit' | 'done' | 'hold' | 'undo'

function TimelineRow({ item, look, todayYmd, reader, acts, onOpenEvidence, onOpenDocument, onOpenLienWindow, btn, deadlines }: { item: LegalTimelineItem; look: TimelineLook; todayYmd: string; reader: 'office' | 'firm'; acts: TimelinePlanActs | null; onOpenEvidence?: (documentId: string | null) => void; onOpenDocument?: (documentId: string) => Promise<void>; onOpenLienWindow?: (jobId: string) => void; btn: CSSProperties; deadlines: ReadonlyArray<LegalTimelineDeadline> }) {
  const [mode, setMode] = useState<Mode>(null)
  const [doneOn, setDoneOn] = useState(todayYmd)
  const [doneNote, setDoneNote] = useState('')
  const [reason, setReason] = useState('')
  // v2.6166: Open the paper, in place; a refusal or a lost file reads its reason under the line.
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const canOpenPaper = item.kind === 'document' && Boolean(item.documentId) && Boolean(onOpenDocument)
  const openPaper = async () => {
    if (!onOpenDocument || !item.documentId) return
    setOpening(true)
    setOpenError(null)
    try {
      await onOpenDocument(item.documentId)
    } catch (e) {
      setOpenError(formatErrorMessage(e, 'Could not open the paper.'))
    } finally {
      setOpening(false)
    }
  }
  const color = stateColor(item, look)
  const struck = item.voided || item.held
  const input = inputStyle(look)
  const canEdit = Boolean(acts?.update) && item.isLivePlan
  const canDone = Boolean(acts?.markDone) && item.isLivePlan
  const canHold = Boolean(acts?.hold) && (item.kind === 'plan' || item.kind === 'event' || item.kind === 'said' || (item.kind === 'entry' && item.entryKind === 'offer')) && !item.voided
  const holdKey = timelineHoldKey(item)
  const canUndo = Boolean(acts?.undo) && (acts?.canUndo ? acts.canUndo(item) : item.isLivePlan)
  const dayWords = timelineDayWords(item.ymd, todayYmd)
  const kindChip = item.kind === 'plan' ? chip(item.state === 'done' ? 'planned step · done' : 'planned step', look, color) : item.kind === 'document' ? chip(item.documentChip ? `document · ${item.documentChip}` : 'document', look, item.documentChip === 'draft' ? look.warn : item.documentChip.startsWith('sent') ? look.ok : item.documentChip === 'received' ? look.accent : undefined, item.documentChip ? item.stateWords : undefined) : item.kind === 'event' ? chip(item.kindWords || 'happened', look) : item.kind === 'deadline' ? chip(item.kindWords || 'deadline', look, color) : item.kind === 'said' || item.kind === 'did' ? chip(item.kindWords, look, item.entryKind === 'note' ? look.stop : item.entryKind === 'promise' ? look.warn : undefined) : item.kindWords ? chip(item.kindWords, look, item.viaPortal ? look.accent : undefined) : null
  const canRecord = item.kind === 'deadline' && reader === 'office' && Boolean(onOpenLienWindow) && Boolean(item.deadlineJobId) && item.state !== 'done'
  const close = () => { setMode(null); setReason('') }
  return (
    <div data-legal-timeline-item={item.key} data-legal-timeline-state={item.state} data-legal-timeline-lane={item.lane} data-legal-timeline-day={item.ymd} style={{ display: 'grid', gridTemplateColumns: '118px 18px 1fr', gap: 8, alignItems: 'start' }}>
      <div style={{ fontSize: '0.78rem', color: item.state === 'overdue' || item.state === 'due_today' ? color : look.muted, textAlign: 'right', paddingTop: 10, paddingRight: 6, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dayWords}</div>
      <div style={{ display: 'grid', justifyItems: 'center', alignSelf: 'stretch', gridTemplateRows: '14px 1fr' }}>
        <span aria-hidden style={{ marginTop: 11, width: item.kind === 'document' ? 8 : 10, height: item.kind === 'document' ? 8 : 10, borderRadius: item.kind === 'document' || item.kind === 'deadline' ? 2 : 999, transform: item.kind === 'deadline' ? 'rotate(45deg)' : undefined, background: item.state === 'planned' || item.state === 'undone' ? look.surface : color, border: `2px solid ${color}`, boxSizing: 'border-box' }} />
        <span aria-hidden style={{ width: 2, background: look.hair, height: '100%', minHeight: 14 }} />
      </div>
      <div data-legal-timeline-hot={item.state === 'overdue' ? 'yes' : undefined} style={{ padding: '6px 0 10px', minWidth: 0, ...(item.state === 'overdue' ? { borderLeft: `3px solid ${look.stop}`, paddingLeft: 8 } : {}) }}>
        {mode === 'edit' && acts?.update ? (
          <PlanForm look={look} todayYmd={todayYmd} busy={acts.busy} btn={btn} title="Change this step" saveLabel="Save the step" initial={{ on: item.plannedYmd ?? item.ymd, body: item.what, notes: item.notes, deadlineKey: item.deadlineKey }} onSave={(d) => acts.update!(item.entryId ?? '', d)} onCancel={close} deadlines={deadlines} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, textDecoration: struck ? 'line-through' : undefined, color: struck ? look.muted : look.text, overflowWrap: 'anywhere' }}>{item.what || (item.kind === 'entry' ? item.kindWords : '')}</span>
              {kindChip}
              {item.amount != null ? <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: look.muted }}>{formatLegalMoney(item.amount)}</span> : null}
              <span style={{ fontSize: '0.74rem', color: look.faint }}>{item.byName}</span>
            </div>
            {item.notes ? <div data-legal-timeline-notes style={{ fontSize: '0.8rem', color: look.muted, whiteSpace: 'pre-wrap', margin: '3px 0 0', overflowWrap: 'anywhere' }}>{item.notes}</div> : null}
            {item.documents.length ? (
              <div data-legal-timeline-documents style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 0', alignItems: 'center' }}>
                {item.documents.map((d) => <span key={d.id} data-legal-timeline-document={d.id} style={{ fontSize: '0.74rem', padding: '1px 7px', borderRadius: 4, border: `1px solid ${look.hair}`, color: d.held && reader === 'office' ? look.warn : look.muted }}>📄 {d.title}{d.held && reader === 'office' ? ' · held' : ''}</span>)}
                {onOpenEvidence ? <button type="button" onClick={() => onOpenEvidence(item.documents[0]?.id ?? null)} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Show on Evidence ↗</button> : null}
              </div>
            ) : null}
            {item.stateWords && !(item.kind === 'document' && item.documentChip) ? <div data-legal-timeline-state-words style={{ fontSize: '0.76rem', color, margin: '3px 0 0', fontWeight: item.state === 'overdue' || item.state === 'due_today' ? 600 : 500 }}>{item.stateWords}</div> : null}
            {item.serves ? <div data-legal-timeline-serves={item.serves.late ? 'late' : 'in-time'} style={{ fontSize: '0.76rem', color: item.serves.late ? look.stop : look.muted, margin: '3px 0 0', fontWeight: item.serves.late ? 600 : undefined }}>Serves {item.serves.what} · {timelineDayWords(item.serves.ymd, todayYmd)}{item.serves.late ? ' · after the deadline' : ''}</div> : null}
            {item.held && reader === 'office' ? <div data-legal-timeline-held style={{ fontSize: '0.76rem', color: look.warn, margin: '3px 0 0' }}>Held from counsel{item.heldReason ? `: ${item.heldReason}` : '.'}</div> : null}
          </>
        )}
        {mode === 'done' && acts?.markDone ? (
          <form data-legal-plan-done onSubmit={(e) => { e.preventDefault(); void acts.markDone!(item.entryId ?? '', doneOn, doneNote.trim()).then((ok) => { if (ok) close() }) }} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <input type="date" aria-label="Day it was done" value={doneOn} max={todayYmd} onChange={(e) => setDoneOn(e.target.value)} style={input} />
            <input aria-label="What happened" value={doneNote} placeholder="What happened, in a few words" onChange={(e) => setDoneNote(e.target.value)} style={{ ...input, flex: '1 1 200px' }} />
            <button type="submit" disabled={acts.busy || !doneOn || doneOn > todayYmd} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text }}>Mark done</button>
            <button type="button" onClick={close} style={btn}>Cancel</button>
          </form>
        ) : null}
        {mode === 'hold' && acts?.hold ? (
          <form data-legal-plan-hold onSubmit={(e) => { e.preventDefault(); if (reason.trim() && holdKey) void acts.hold!.holdBack(holdKey, reason.trim()).then(close) }} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <input autoFocus aria-label="Why counsel should not see it" value={reason} placeholder="Why counsel should not see it" onChange={(e) => setReason(e.target.value)} style={{ ...input, flex: '1 1 220px' }} />
            <button type="submit" disabled={acts.busy || !reason.trim()} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text }}>Hold back</button>
            <button type="button" onClick={close} style={btn}>Cancel</button>
          </form>
        ) : null}
        {mode === 'undo' && acts?.undo ? (
          <form data-legal-plan-undo onSubmit={(e) => { e.preventDefault(); if (reason.trim()) void acts.undo!(item.entryId ?? '', reason.trim()).then((ok) => { if (ok) close() }) }} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <input autoFocus aria-label="Why undo it" value={reason} placeholder={reader === 'office' ? 'Why: the firm reads the reason' : 'Why: the office reads the reason'} onChange={(e) => setReason(e.target.value)} style={{ ...input, flex: '1 1 220px' }} />
            <button type="submit" disabled={acts.busy || !reason.trim()} style={{ ...btn, color: look.stop }}>Undo</button>
            <button type="button" onClick={close} style={btn}>Cancel</button>
          </form>
        ) : null}
        {mode === null ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: canEdit || canDone || canHold || canUndo || canRecord || canOpenPaper || (item.kind === 'document' && onOpenEvidence) || (item.held && acts?.hold) ? 6 : 0 }}>
            {item.state === 'overdue' && canDone ? <button type="button" data-legal-timeline-done-first onClick={() => { setDoneOn(todayYmd); setMode('done') }} style={{ ...btn, background: look.text, color: look.surface, borderColor: look.text }}>Mark done</button> : null}
            {canRecord ? <button type="button" data-legal-timeline-record onClick={() => onOpenLienWindow!(item.deadlineJobId!)} style={btn} title="Opens the job’s Lien window, where the paper is recorded">Record it…</button> : null}
            {canEdit ? <button type="button" onClick={() => setMode('edit')} style={btn}>Edit</button> : null}
            {canDone && item.state !== 'overdue' ? <button type="button" onClick={() => { setDoneOn(todayYmd); setMode('done') }} style={btn}>Mark done</button> : null}
            {canHold && !item.held ? <button type="button" onClick={() => setMode('hold')} style={btn} title={item.kind === 'event' ? 'Keep this event from the firm, with a reason only the office reads' : 'Keep this planned step from the firm, with a reason only the office reads'}>Hold from counsel…</button> : null}
            {item.held && acts?.hold && holdKey ? <button type="button" onClick={() => void acts.hold!.shareAgain(holdKey)} disabled={acts.busy} style={btn}>Share with counsel</button> : null}
            {canUndo ? <button type="button" onClick={() => setMode('undo')} style={btn}>Undo…</button> : null}
            {canOpenPaper ? <button type="button" data-legal-timeline-open-paper aria-busy={opening || undefined} onClick={() => void openPaper()} style={{ ...btn, height: 24, fontSize: '0.72rem' }} title="Opens the file itself in a new browser tab; the Timeline stays">Open the paper</button> : null}
            {item.kind === 'document' && onOpenEvidence ? <button type="button" data-legal-timeline-show-evidence onClick={() => onOpenEvidence(item.documentId)} style={{ ...btn, height: 24, fontSize: '0.72rem' }} title="Opens the Evidence tab on this paper’s row, lit">Show on Evidence ↗</button> : null}
          </div>
        ) : null}
        {openError ? <div role="alert" data-legal-timeline-open-error style={{ fontSize: '0.76rem', color: look.stop, marginTop: 4 }}>{openError}</div> : null}
      </div>
    </div>
  )
}
