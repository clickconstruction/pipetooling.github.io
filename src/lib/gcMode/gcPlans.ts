/**
 * GC mode — design spike. Plans: sheets and disciplines, who hears about a new set, the email, who opened it.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, PlanQuestion, PlanSheet, SpecSection, TradePackage } from './gcTypes'
import { weekdayDate } from './gcWords'
import { currentRev, partnerById } from './gcLookups'

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

const DISCIPLINES: Record<string, string> = {
  G: 'General',
  C: 'Civil',
  A: 'Architectural',
  ID: 'Interiors',
  S: 'Structural',
  M: 'Mechanical',
  E: 'Electrical',
  P: 'Plumbing',
  FP: 'Fire protection',
  L: 'Landscape',
  T: 'Technology',
}

export function sheetDiscipline(sheetId: string): string {
  const letters = sheetId.match(/^[A-Za-z]+/)?.[0].toUpperCase() ?? ''
  return DISCIPLINES[letters] ?? 'Other'
}

export interface SheetInSet extends PlanSheet {
  /** The newest set, up to the one being read, that changed this sheet. Null: as first issued. */
  changedInRev: number | null
  /** The sheet did not exist before an addendum named it. */
  added: boolean
  /** The title before the newest set that renamed it. */
  was?: string
}

/** A sheet a set took out, as it was titled when it went. */
export interface SheetGone extends PlanSheet {
  goneInRev: number
}

function walkSheets(project: GcProject, rev: number): { live: SheetInSet[]; gone: SheetGone[] } {
  const out = new Map<string, SheetInSet>()
  const gone = new Map<string, SheetGone>()
  for (const sheet of project.sheets) out.set(sheet.id, { ...sheet, changedInRev: null, added: false })
  const sets = project.planSets.filter((s) => s.rev <= rev).sort((a, b) => a.rev - b.rev)
  for (const set of sets) {
    for (const id of set.changedSheets) {
      const known = out.get(id)
      const title = set.addedSheets?.find((x) => x.id === id)?.title || gone.get(id)?.title || `Added by ${set.label}`
      out.set(id, known ? { id: known.id, title: known.title, changedInRev: set.rev, added: known.added } : { id, title, changedInRev: set.rev, added: true })
      gone.delete(id)
    }
    for (const x of set.retitledSheets ?? []) {
      const known = out.get(x.id)
      if (known) out.set(x.id, { ...known, title: x.title, was: known.title, changedInRev: set.rev })
    }
    for (const id of set.removedSheets ?? []) {
      const known = out.get(id)
      if (!known) continue
      out.delete(id)
      gone.set(id, { id, title: known.was ?? known.title, goneInRev: set.rev })
    }
  }
  return { live: [...out.values()], gone: [...gone.values()] }
}

/**
 * The drawings as they stand at one set: the bid set's index plus what each later set touched.
 * A sheet a set took out is not in it (`sheetsGoneAtRev` lists those).
 */
export function sheetsAtRev(project: GcProject, rev: number): SheetInSet[] {
  return walkSheets(project, rev).live
}

/** The sheets taken out by the sets up to this one, so a quote priced on them can still be read. */
export function sheetsGoneAtRev(project: GcProject, rev: number): SheetGone[] {
  return walkSheets(project, rev).gone
}

/** A sheet or section number with its dashes, dots and spaces dropped, so A101 meets A-101. */
export function bareId(id: string): string {
  return id.toUpperCase().replace(/[-.\s]/g, '')
}

/** What a pasted index does to the one we have: new, gone, renamed (same number, new title) and the same. */
export interface IndexDiff<T extends { id: string; title: string }> {
  added: T[]
  gone: T[]
  renamed: { id: string; from: string; to: string }[]
  same: T[]
}

/**
 * Compare a pasted index with the one we have. Numbers match without their dashes or dots, and a
 * matched number keeps the way our index writes it. Titles match without minding capitals.
 */
export function indexDiff<T extends { id: string; title: string }>(have: T[], next: T[]): IndexDiff<T> {
  const was = new Map(have.map((x) => [bareId(x.id), x]))
  const now = new Set(next.map((x) => bareId(x.id)))
  const plain = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()
  const out: IndexDiff<T> = { added: [], gone: [], renamed: [], same: [] }
  for (const x of next) {
    const old = was.get(bareId(x.id))
    if (!old) out.added.push(x)
    else if (x.title.trim() !== '' && plain(old.title) !== plain(x.title)) out.renamed.push({ id: old.id, from: old.title, to: x.title })
    else out.same.push(old)
  }
  for (const x of have) if (!now.has(bareId(x.id))) out.gone.push(x)
  return out
}

/** "Delete sheet C-201", "C-201 is deleted", "Section 09 30 13 removed": the numbers a note takes out. */
const TAKEN_OUT_BEFORE = /\b(?:delete[ds]?|remove[ds]?|void(?:ed)?|omit(?:s|ted)?|withdraw[ns]?)\s+(?:sheets?\s+|sections?\s+)?$/i
const TAKEN_OUT_AFTER = /^\s*(?:is\s+|are\s+|has\s+been\s+|have\s+been\s+)?[:\-–—]?\s*(?:deleted|removed|voided|omitted|withdrawn|taken\s+out)\b/i

/**
 * The numbers in a note that it says are taken out: the word comes right before the number
 * ("delete sheet C-201") or right after it ("C-201 is deleted"). "Delete the pond per C-201"
 * takes nothing out. `found` gives the numbers in the note as the caller reads them.
 */
export function takenOutInText(text: string, found: (line: string) => string[]): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ')
    for (const id of found(line)) {
      // The number as the note writes it: "09-30-13" and "093013" are both 09 30 13.
      const loose = new RegExp(bareId(id).split('').map((c) => c.replace(/[^A-Z0-9]/g, '\\$&')).join('[-.\\s]?'), 'i')
      const m = loose.exec(line)
      if (!m) continue
      const before = line.slice(0, m.index)
      const after = line.slice(m.index + m[0].length)
      if ((TAKEN_OUT_BEFORE.test(before) || TAKEN_OUT_AFTER.test(after)) && !out.includes(id)) out.push(id)
    }
  }
  return out
}

/**
 * Sheet numbers found in pasted notes, each once, in the order they appear. With a dash: "E-201",
 * "FP-101", "A-1.01". Without one, only a full number reads as a sheet ("A101", "A1.01"), so a
 * word like R30 or T24 in the notes is not taken for a drawing.
 */
export function sheetsInText(text: string): string[] {
  const found = text.toUpperCase().match(/\b[A-Z]{1,2}(?:-\d{2,3}|-?\d\.\d{2}|\d{3})[A-Z]?\b/g) ?? []
  return [...new Set(found)]
}

/**
 * A sheet number as the project's index writes it: "A101" in the notes is "A-101" in a set that
 * uses dashes. A sheet the index does not have is written the way the index writes its others.
 */
export function sheetAsIndexed(project: GcProject, id: string): string {
  const bare = (x: string) => x.toUpperCase().replace(/[-.\s]/g, '')
  const known = [...project.sheets, ...project.planSets.flatMap((s) => s.addedSheets ?? [])].find((s) => bare(s.id) === bare(id))
  if (known) return known.id
  const upper = id.toUpperCase()
  const dashed = project.sheets.filter((s) => s.id.includes('-')).length > project.sheets.length / 2
  return dashed && !upper.includes('-') ? upper.replace(/^([A-Z]+)/, '$1-') : upper
}

/**
 * The people on our team who can say they checked a set: the job's own team first (its project
 * manager, then its superintendents), then everyone else on our other jobs, each once.
 */
export function ourPeople(state: GcState, project: GcProject): string[] {
  const rank = (role: string) => (role === 'projectManager' ? 0 : 1)
  const own = [...(project.team ?? [])].sort((a, b) => rank(a.role) - rank(b.role)).map((c) => c.name)
  const rest = state.projects.flatMap((p) => p.team ?? []).sort((a, b) => rank(a.role) - rank(b.role)).map((c) => c.name)
  return [...new Set([...own, ...rest])]
}

/** What a later set can be called. An addendum comes while we bid; a bulletin once the job is ours. */
export const SET_KINDS: { kind: string; numbered: boolean }[] = [
  { kind: 'Addendum', numbered: true },
  { kind: 'Bulletin', numbered: true },
  { kind: 'Revised set', numbered: false },
  { kind: 'Permit set', numbered: false },
  { kind: 'Construction set', numbered: false },
]

/** The kind a new set starts as: an addendum while we bid, a bulletin once the job is ours. */
export function defaultSetKind(project: GcProject): string {
  return project.stage === 'pursuing' ? 'Addendum' : 'Bulletin'
}

/** The next set's name for a kind. Each numbered kind counts on its own: Addendum 2, then Bulletin 1. */
export function nextSetLabel(project: GcProject, kind: string): string {
  const numbered = SET_KINDS.find((k) => k.kind === kind)?.numbered ?? false
  const labels = project.planSets.map((s) => s.label)
  if (numbered) {
    const n = labels.filter((l) => new RegExp(`^${kind} \\d+$`).test(l)).length
    return `${kind} ${n + 1}`
  }
  if (!labels.includes(kind)) return kind
  let n = 2
  while (labels.includes(`${kind} ${n}`)) n += 1
  return `${kind} ${n}`
}

export interface PlanRecipient {
  partner: Partner
  pkg: TradePackage
  invite: Invite
  /** The new set changes this company's trade. */
  touched: boolean
  /** They have a number in that the change may move. */
  hasBid: boolean
}

/**
 * Who hears about a new set of plans. While we are bidding: every company bidding, on every
 * trade. Once the job is ours: only the company on each trade (the one awarded, or the one we
 * carry until we award). A company that passed is never on the list.
 */
export function planRecipients(state: GcState, project: GcProject, touches: string[]): PlanRecipient[] {
  const out: PlanRecipient[] = []
  for (const pkg of project.packages) {
    const picked = pkg.awardedInviteId ?? (pkg.carried && pkg.carried !== 'plug' && pkg.carried !== 'self' ? pkg.carried : null)
    for (const invite of pkg.invites) {
      if (invite.status === 'declined') continue
      if (project.stage !== 'pursuing' && invite.id !== picked) continue
      const partner = partnerById(state, invite.partnerId)
      if (!partner) continue
      out.push({ partner, pkg, invite, touched: touches.includes(pkg.id), hasBid: invite.bid !== null })
    }
  }
  return out.sort((a, b) => Number(b.touched) - Number(a.touched))
}

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * The words a company reads when a new set goes out. Two versions: their trade changed, or it did
 * not. `lines`: the scope lines of their trade that read from a changed sheet, named in the email.
 * `adds`: scope lines the set adds to their trade. `moves`: sentences on their activities' new dates.
 * `specs`: the sections of the manual the set revises, with their titles. `gone`: the sheets and
 * sections it takes out, each with its title.
 */
export function planEmail(
  project: GcProject,
  label: string,
  note: string,
  sheets: string[],
  r: PlanRecipient | null,
  more: { lines?: string[]; adds?: string[]; moves?: string[]; specs?: SpecSection[]; gone?: string[] } = {},
): { subject: string; body: string[] } {
  const lines = more.lines ?? []
  const adds = more.adds ?? []
  const moves = (more.moves ?? []).map((m) => ` ${m}`).join('')
  const body = [`${label} for ${project.name} is out. Your portal now shows it.`, `What changed: ${note || 'see the sheets below.'}`]
  if (sheets.length > 0) body.push(`Sheets: ${sheets.join(', ')}.`)
  if (more.specs && more.specs.length > 0) body.push(`Spec sections: ${more.specs.map((x) => `${x.id} ${x.title}`.trim()).join(', ')}.`)
  if (more.gone && more.gone.length > 0) body.push(`Taken out of the set: ${more.gone.join(', ')}.`)
  if (!r) return { subject: `${project.name}: ${label} is out`, body }
  const trade = r.pkg.trade.toLowerCase()
  const named = lines.map((l) => l.toLowerCase())
  const added = adds.map((l) => l.toLowerCase())
  const touches =
    (added.length === 0 ? '' : ` It adds ${andList(added)} to your scope.`) +
    (named.length === 0 ? '' : named.length === 1 ? ` The line it touches is ${named[0]}.` : ` The lines it touches are ${andList(named)}.`)
  if (r.touched && project.stage === 'pursuing') {
    body.push(
      r.hasBid
        ? `This changes ${trade}.${touches} Please open the plans and confirm your number, or send a new one${project.bidDue ? `, by ${weekdayDate(project.bidDue)}` : ''}.`
        : `This changes ${trade}.${touches} Please price the new set${project.bidDue ? `. Your number is due ${weekdayDate(project.bidDue)}` : ''}.`,
    )
  } else if (r.touched) {
    body.push(`This changes ${trade}.${touches}${moves} Build from this set. If it changes your price, tell us before you do the work.`)
  } else {
    body.push(`It does not change ${trade}. No action needed. It is for your records.`)
  }
  return { subject: `${project.name}: ${label} is out${r.touched ? ' and it changes your trade' : ''}`, body }
}

// ---------------------------------------------------------------------------------------------
// Questions about the plans: a trade asks, the architect answers, every company on the trade hears
// ---------------------------------------------------------------------------------------------

export type QuestionState = 'asked' | 'with the architect' | 'answered'

/** Questions close this many days before our bid is due (the owner, 2026-10-03). */
export const QUESTIONS_CLOSE_DAYS = 3

/**
 * The day questions close on a project we are bidding: three days before our bid is due. From
 * that day on no company can ask. Null: they never close, because there is no due date or the
 * job is ours (questions while building are part of the work).
 */
export function questionsCloseOn(project: GcProject): string | null {
  if (project.stage !== 'pursuing' || !project.bidDue) return null
  const [y, m, d] = project.bidDue.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - QUESTIONS_CLOSE_DAYS)).toISOString().slice(0, 10)
}

/** A company can still ask today. Never on a bid we lost: nobody is open on it. */
export function questionsOpen(project: GcProject, today: string): boolean {
  if (project.lostOn) return false
  const close = questionsCloseOn(project)
  return close === null || today < close
}

/** Where a question stands: asked and not sent on, with the architect, or answered. */
export function questionState(q: PlanQuestion): QuestionState {
  if (q.answer !== null) return 'answered'
  return q.sentToArchitectOn ? 'with the architect' : 'asked'
}

/** The project's questions still waiting on an answer, the oldest first. */
export function openQuestions(project: GcProject): PlanQuestion[] {
  return project.questions.filter((q) => q.answer === null).sort((a, b) => a.askedOn.localeCompare(b.askedOn))
}

/** One trade's questions, the newest first. */
export function questionsFor(project: GcProject, packageId: string): PlanQuestion[] {
  return project.questions.filter((q) => q.packageId === packageId).sort((a, b) => b.askedOn.localeCompare(a.askedOn))
}

/** Answered questions no set has carried yet: the ones a new set can put in its note. */
export function answeredNotInSet(project: GcProject): PlanQuestion[] {
  return project.questions.filter((q) => q.answer !== null && q.inSetRev === undefined)
}

/**
 * Who hears an answer: every company on the question's trade while we bid, only the company on it
 * once the job is ours. The same rule a new set follows. A company that passed hears nothing.
 */
export function questionRecipients(state: GcState, project: GcProject, q: PlanQuestion): PlanRecipient[] {
  return planRecipients(state, project, [q.packageId]).filter((r) => r.pkg.id === q.packageId)
}

/** A question and its answer as one line for a set's note: "E-301, Electrical: … Answer: …" */
export function questionInNote(project: GcProject, q: PlanQuestion): string {
  const trade = project.packages.find((p) => p.id === q.packageId)?.trade ?? 'A trade'
  const about = q.sheets && q.sheets.length > 0 ? `${q.sheets.join(', ')}, ${trade}` : trade
  return `${about}: ${q.text.trim()} Answer: ${(q.answer ?? '').trim()}`
}

/** How many invited trade partners have opened the newest set. */
export function plansReach(project: GcProject): { have: number; of: number } {
  const rev = currentRev(project)
  const invites = project.packages.flatMap((p) => p.invites).filter((i) => i.status !== 'declined')
  return { have: invites.filter((i) => i.seenRev === rev).length, of: invites.length }
}
