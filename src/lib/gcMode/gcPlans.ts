/**
 * GC mode — design spike. Plans: sheets and disciplines, who hears about a new set, the email, who opened it.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, PlanQuestion, PlanSheet, SpecSection, TradePackage } from './gcTypes'
import { weekdayDate } from './gcWords'
import { partnerById } from './gcLookups'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { preBidInvited } from '../gc/preBid'
import { questionsCloseOn } from '../gc/planQuestions'
export { plansReach } from '../gc/lookups'

export { questionState, questionsCloseOn, questionsFor } from '../gc/planQuestions'

export { preBidInvited } from '../gc/preBid'

// The pure sheet kernels live in the real build's library now (NEW_PROJECT_REAL_BUILD.md, PR 1).
export { bareId, indexDiff, sheetDiscipline, sheetsInText, takenOutInText } from '../gc/plans'
export type { IndexDiff } from '../gc/plans'

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

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
      const listed = set.addedSheets?.find((x) => x.id === id)
      const title = listed?.title || gone.get(id)?.title || `Added by ${set.label}`
      // A discipline the office picked stays with the sheet. A new sheet keeps its page of the set's PDF.
      out.set(
        id,
        known
          ? { id: known.id, title: known.title, ...(known.discipline ? { discipline: known.discipline } : {}), changedInRev: set.rev, added: known.added }
          : { id, title, ...(listed?.discipline ? { discipline: listed.discipline } : {}), ...(listed?.page ? { page: listed.page } : {}), changedInRev: set.rev, added: true },
      )
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
        ? `This changes ${trade}.${touches} Please open the plans and confirm your quote, or send a new one${project.bidDue ? `, by ${weekdayDate(project.bidDue)}` : ''}.`
        : `This changes ${trade}.${touches} Please price the new set${project.bidDue ? `. Your quote is due ${weekdayDate(project.bidDue)}` : ''}.`,
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

/** A company can still ask today. Never on a bid we lost: nobody is open on it. */
export function questionsOpen(project: GcProject, today: string): boolean {
  if (project.lostOn) return false
  const close = questionsCloseOn(project)
  return close === null || today < close
}

/** The project's questions still waiting on an answer, the oldest first. */
export function openQuestions(project: GcProject): PlanQuestion[] {
  return project.questions.filter((q) => q.answer === null).sort((a, b) => a.askedOn.localeCompare(b.askedOn))
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

// ---------------------------------------------------------------------------------------------
// The pre-bid meeting: who is invited, the meeting in words, who came, the minutes for the next set
// ---------------------------------------------------------------------------------------------

/** "10:00" reads "10 AM", "14:30" reads "2:30 PM". Anything else reads as typed. */
export function timeWords(at: string): string {
  const m = at.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return at.trim()
  const h = Number(m[1])
  const mins = m[2] ?? '00'
  const half = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return mins === '00' ? `${h12} ${half}` : `${h12}:${mins} ${half}`
}

/** The meeting has been held: who came is recorded. */
export function preBidHeld(project: GcProject): boolean {
  return Boolean(project.preBid && project.preBid.attended !== null)
}

/** The meeting in a line: "Pre-bid meeting Tue Oct 6 at 10 AM, at the site. Coming is required to quote." */
export function preBidWords(project: GcProject): string | null {
  const m = project.preBid
  if (!m) return null
  const firm = project.architect.trim() || 'The architect'
  const who = m.host === 'architect' ? `${firm}${firm.endsWith('s') ? "'" : "'s"} pre-bid meeting` : 'Our pre-bid walk'
  return `${who} ${weekdayDate(m.on)} at ${timeWords(m.at)}, at ${m.place}.${m.mandatory ? ' Coming is required to quote.' : ''}`
}

/** A company that missed a pre-bid meeting it had to come to. Only once the meeting is held. */
export function missedMandatoryPreBid(state: GcState, project: GcProject, partnerId: string): boolean {
  const m = project.preBid
  if (!m || !m.mandatory || m.attended === null || m.attended.includes(partnerId)) return false
  return preBidInvited(state, project).some((r) => r.partner.id === partnerId)
}

/**
 * The minutes the next set carries: when it was, who came, and how many questions were raised there.
 * The answers themselves ride as every answer does (`answeredNotInSet`). Null until it is held, or
 * once a set has carried them.
 */
export function preBidMinutesLine(state: GcState, project: GcProject): string | null {
  const m = project.preBid
  if (!m || m.attended === null || m.minutesInSetRev !== undefined) return null
  const came = m.attended.map((id) => partnerById(state, id)?.company).filter((c): c is string => Boolean(c))
  const raised = project.questions.filter((q) => q.atPreBid).length
  const who = came.length === 0 ? 'No company came.' : `${andList(came)} came.`
  const asked = raised === 0 ? '' : ` ${raised} ${raised === 1 ? 'question was' : 'questions were'} raised. The answers are below.`
  return `Pre-bid meeting minutes, ${weekdayDate(m.on)} at ${timeWords(m.at)}, ${m.place}: ${who}${asked}`
}

/** The invitation a company gets: the day, the time, the place, and whether it has to come to quote. */
export function preBidInviteEmail(project: GcProject, partner: Partner): { subject: string; body: string[] } {
  const m = project.preBid
  if (!m) return { subject: '', body: [] }
  const body = [
    `You are invited to the pre-bid meeting for ${project.name}.`,
    `When: ${weekdayDate(m.on)} at ${timeWords(m.at)}.`,
    `Where: ${m.place}.`,
    m.mandatory ? 'Coming is required to quote this project.' : 'Coming is not required, but questions raised there are answered for every company quoting.',
    `Bring your questions about the plans. ${partner.contact ? `See you there, ${partner.contact.split(' ')[0]}.` : ''}`.trim(),
  ]
  return { subject: `${project.name}: pre-bid meeting ${weekdayDate(m.on)}${m.mandatory ? ', required to quote' : ''}`, body }
}
