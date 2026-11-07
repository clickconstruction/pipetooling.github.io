/**
 * Papers on a part (punch list #239, the papers train): the documents that travel with a set of plans — specs,
 * submittals, schedules, scope and change orders, meeting notes, the owner's task list — kept in the same register as
 * the sets (`plan_sets`, migration `20261102010000`), beside the set each goes with (`marks_up_set_id`), with the
 * question it raised (`ask_lane`, `ask_request_id`) read back from the lane, and an owed state for a paper that has
 * not come. Keeping one writes the History line by trigger; `historyLineForPaper` writes the same words for the
 * screen. Pure.
 */
import type { PlanSetRow } from '../plans/planSets'

export type PaperKind = 'spec' | 'submittal' | 'schedule' | 'scope' | 'change_order' | 'meeting_notes' | 'task_list' | 'report' | 'sheet' | 'other'
export type PaperFrom = 'gc' | 'architect' | 'engineer' | 'supplier' | 'ours'
export type PaperAskLane = 'estimators' | 'dispatch'

export const PAPER_KINDS: ReadonlyArray<{ kind: PaperKind; label: string }> = [
  { kind: 'spec', label: 'Spec' },
  { kind: 'submittal', label: 'Submittal' },
  { kind: 'schedule', label: 'Schedule' },
  { kind: 'scope', label: 'Scope' },
  { kind: 'change_order', label: 'Change order' },
  { kind: 'meeting_notes', label: 'Meeting notes' },
  { kind: 'task_list', label: 'Task list' },
  { kind: 'report', label: 'Report' },
  { kind: 'sheet', label: 'Sheet' },
  { kind: 'other', label: 'Other' },
]

export const PAPER_FROMS: ReadonlyArray<{ from: PaperFrom; label: string; words: string }> = [
  { from: 'gc', label: 'The owner / GC', words: 'the owner' },
  { from: 'architect', label: 'The architect', words: 'the architect' },
  { from: 'engineer', label: 'The engineer', words: 'the engineer' },
  { from: 'supplier', label: 'A supplier', words: 'the supplier' },
  { from: 'ours', label: 'Us', words: 'ours' },
]

const PAPER_KIND_SET: ReadonlySet<string> = new Set(PAPER_KINDS.map((k) => k.kind))

/** A paper kind, as against a drawing kind a part can build from. */
export function isPaperKind(kind: string): kind is PaperKind {
  return PAPER_KIND_SET.has(kind)
}

export function kindLabel(kind: string): string {
  return PAPER_KINDS.find((k) => k.kind === kind)?.label ?? kind.replace('_', ' ')
}

export function fromWords(from: string): string {
  return PAPER_FROMS.find((f) => f.from === from)?.words ?? 'the owner'
}

/** The question a paper raised, as its lane's table holds it. */
export type PaperRequest = { id: string; lane: PaperAskLane; title: string; status: string; created_at: string; closed_at: string | null; closed_note: string | null }

export type PaperAsk = { lane: PaperAskLane; words: string; askedAt: string; answer: string | null; answeredAt: string | null }

/** A paper as the screens read it: the row, its ask resolved. */
export type Paper = PlanSetRow & { paperKind: PaperKind; ask: PaperAsk | null }

export function askFromRequest(r: PaperRequest): PaperAsk {
  const open = !r.closed_at && !['closed', 'done', 'resolved'].includes((r.status ?? '').toLowerCase())
  return { lane: r.lane, words: r.title, askedAt: r.created_at, answer: open ? null : (r.closed_note ?? '').trim() || null, answeredAt: open ? null : r.closed_at }
}

/** The paper rows among a part's sets, with their asks read from the requests handed in. */
export function papersFromRows(rows: ReadonlyArray<PlanSetRow>, requests: ReadonlyArray<PaperRequest>): Paper[] {
  const byId = new Map(requests.map((r) => [r.id, r]))
  return rows
    .filter((r) => isPaperKind(r.kind))
    .map((r) => {
      const req = r.ask_request_id ? byId.get(r.ask_request_id) : null
      return { ...r, paperKind: r.kind as PaperKind, ask: req ? askFromRequest(req) : r.ask_request_id && r.ask_lane ? { lane: r.ask_lane as PaperAskLane, words: 'asked', askedAt: r.created_at, answer: null, answeredAt: null } : null }
    })
}

/** *Oct 2* from a civil date or a stamp. */
export function dayWords(iso: string | null | undefined): string {
  if (!iso) return ''
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = civil ? new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3])) : new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The paper's own line: *Task list · the owner · came Jun 24*; an owed one reads *asked Sep 15*. */
export function paperLineWords(p: Pick<Paper, 'kind' | 'source' | 'came_at' | 'owed'>): string {
  return `${kindLabel(p.kind)} · ${fromWords(p.source)} · ${p.owed ? 'asked' : 'came'} ${dayWords(p.came_at)}`
}

/** The ask as a chip: *asked the estimators Jun 25 · waiting 3 days*, or *answered Jun 26*. */
export function askChipWords(ask: PaperAsk, nowMs: number): { words: string; open: boolean } {
  const lane = ask.lane === 'dispatch' ? 'Dispatch' : 'the estimators'
  if (ask.answeredAt) return { words: `answered ${dayWords(ask.answeredAt)}`, open: false }
  const days = Math.max(0, Math.floor((nowMs - Date.parse(ask.askedAt)) / 86_400_000))
  return { words: `asked ${lane} ${dayWords(ask.askedAt)} · ${days === 0 ? 'waiting since today' : `waiting ${days} ${days === 1 ? 'day' : 'days'}`}`, open: true }
}

/** The History line keeping a paper writes (the trigger's words), so the screen shows it before the keep. */
export function historyLineForPaper(p: { kind: string; name: string; source: string; memo: string; owed: boolean; askWords: string | null; askLane: PaperAskLane | null }, goesWithName: string | null, replacesName: string | null): string {
  if (p.owed) return `Owed: ${p.name} from ${p.source === 'ours' ? 'us' : fromWords(p.source)}${p.memo ? ` · ${p.memo}` : ''}`
  const bits = [`Kept ${kindLabel(p.kind).toLowerCase()} ${p.name}, ${fromWords(p.source)}${goesWithName ? `, on ${goesWithName}` : ''}${p.memo ? `: ${p.memo}` : ''}`]
  if (replacesName) bits.push(`replaces ${replacesName}`)
  if (p.askWords) bits.push(`asked ${p.askLane === 'dispatch' ? 'Dispatch' : 'the estimators'}: ${p.askWords}`)
  return bits.join(' · ')
}

export type PapersView = {
  /** Papers grouped by the set they go with: the set's id, or '' for the part itself. Newest first inside each. */
  bySet: Array<{ setId: string; papers: Paper[] }>
  owed: Paper[]
  openAsks: number
  /** Every paper that is not owed. */
  count: number
}

export function buildPapersView(papers: ReadonlyArray<Paper>, partId: string): PapersView {
  const mine = papers.filter((p) => p.part_id === partId)
  const owed = mine.filter((p) => p.owed).sort((a, b) => b.came_at.localeCompare(a.came_at))
  const kept = mine.filter((p) => !p.owed)
  const groups = new Map<string, Paper[]>()
  for (const p of kept) {
    const k = p.marks_up_set_id ?? ''
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const bySet = [...groups.entries()].map(([setId, ps]) => ({ setId, papers: ps.sort((a, b) => b.came_at.localeCompare(a.came_at)) }))
  return { bySet, owed, openAsks: mine.filter((p) => p.ask && !p.ask.answeredAt).length, count: kept.length }
}

/** The part row's chips on the Plans look: *3 papers*, *1 asks*, *1 owed*. */
export function paperChipWords(v: PapersView): { papers: string | null; asks: string | null; owed: string | null } {
  return {
    papers: v.count ? `${v.count} ${v.count === 1 ? 'paper' : 'papers'}` : null,
    asks: v.openAsks ? `${v.openAsks} ${v.openAsks === 1 ? 'asks' : 'ask'}` : null,
    owed: v.owed.length ? `${v.owed.length} owed` : null,
  }
}

export type PaperDraft = { kind: PaperKind; name: string; from: PaperFrom; cameOn: string; memo: string; link: string; goesWithSetId: string | null; replacesPaperId: string | null; asks: boolean; askLane: PaperAskLane; askWords: string }

export function emptyPaperDraft(today: string, goesWithSetId: string | null): PaperDraft {
  return { kind: 'spec', name: '', from: 'gc', cameOn: today, memo: '', link: '', goesWithSetId, replacesPaperId: null, asks: false, askLane: 'estimators', askWords: '' }
}

export function paperDraftProblem(d: PaperDraft, owed: boolean): string | null {
  if (!d.name.trim()) return 'Give the paper a name.'
  if (!owed && d.link.trim() && !/^https?:\/\//i.test(d.link.trim())) return 'Paste the paper’s link, starting with https://, or leave it empty for now.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.cameOn)) return 'The day reads as a date, like 2026-06-24.'
  if ((d.asks || owed) && !d.askWords.trim()) return owed ? 'Say who owes it and what it is.' : 'Say what it asks of us, in a line.'
  return null
}

/** Who a paper is from, guessed from the sender's address, for the mailbox door. */
export function fromGuess(address: string | null | undefined): PaperFrom {
  const a = (address ?? '').toLowerCase()
  if (/architect/.test(a)) return 'architect'
  if (/engin|structural/.test(a)) return 'engineer'
  if (/reece|supply|ferguson|specbook|texasps/.test(a)) return 'supplier'
  if (/clickplumbing|pipetexas/.test(a)) return 'ours'
  return 'gc'
}

/** The kind, guessed from a mail's subject, for the mailbox door. */
export function kindGuess(subject: string): PaperKind {
  const s = subject.toLowerCase()
  if (/submittal/.test(s)) return 'submittal'
  if (/\bspec/.test(s)) return 'spec'
  if (/schedule|gantt|\bloads?\b/.test(s)) return 'schedule'
  if (/change order/.test(s)) return 'change_order'
  if (/scope/.test(s)) return 'scope'
  if (/notes:|meeting/.test(s)) return 'meeting_notes'
  if (/task list/.test(s)) return 'task_list'
  if (/report|evaluation/.test(s)) return 'report'
  return 'other'
}

/** A mail's subject as a paper's name: the Re and Fwd stripped, cut to the column. */
export function nameFromSubject(subject: string): string {
  return subject.replace(/^((re|fwd?|fw):\s*)+/i, '').trim().slice(0, 200)
}

/** The parts a paper may move to (v2.6632): every other part of the site, in the look's order. */
export function partsToMoveTo(parts: ReadonlyArray<{ id: string; name: string }>, partId: string): Array<{ id: string; name: string }> {
  return parts.filter((p) => p.id !== partId)
}

/**
 * The History line a move writes (v2.6632), the app's own since the trigger writes only on a keep: the paper, the part
 * it was on and the part it is on now. The set it went with stays on the old part, so the paper goes on the new part itself.
 */
export function moveLineForPaper(p: { kind: string; name: string }, fromPart: string, toPart: string): string {
  return `Moved ${kindLabel(p.kind).toLowerCase()} ${p.name} from ${fromPart} to ${toPart}; it goes on ${toPart} itself now.`
}
