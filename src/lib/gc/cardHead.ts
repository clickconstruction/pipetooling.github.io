/**
 * GC mode, a project's card (to-do #108, PR 1 of the card in shape D): the head's facts line and its doors, as
 * words. The owner, 2026-10-14: the card was "very chaotic and not very intuitive"; its head mixed who-and-where
 * with every door to a window as one wrap of blue words. Now the name and the stage sit on the first line, the
 * facts on a second (`cardFactParts`), and the doors are grouped sets on the right, each door named with the fact
 * that says whether to open it (`cardDoors`). The page answers the gates and draws them; nothing here is JSX.
 */
import { daysUntil, shortDate, weekdayDate } from './words'

/** The card's stage as the page's rows read it (`GcProjectView.stage`). */
export type CardStage = 'bidding' | 'buyout' | 'building' | 'closed'

export interface CardFacts {
  address: string
  sqFt: number | null
  sizeNote: string
  /** Our customer's name and the firm that drew the plans, from the board. Null: the reader has no board. */
  owner: string | null
  architect: string | null
  stage: CardStage
  bidDue: string | null
  startDate: string | null
  startedOn: string | null
  lostOn: string | null
  closedOn: string | null
  today: string
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** The stage's own fact: when the bid is due, when the job starts or started, when it was lost or closed. */
export function stageWhen(f: CardFacts): string | null {
  if (f.lostOn) return `lost ${shortDate(f.lostOn)}`
  if (f.closedOn) return `closed ${shortDate(f.closedOn)}`
  switch (f.stage) {
    case 'bidding': {
      if (!f.bidDue) return 'no bid due day yet'
      const d = daysUntil(f.bidDue, f.today)
      return `bid due ${weekdayDate(f.bidDue)}, ${d === 0 ? 'today' : d > 0 ? `${days(d)} left` : `${days(-d)} ago`}`
    }
    case 'buyout': {
      if (!f.startDate) return 'no start date yet'
      const d = daysUntil(f.startDate, f.today)
      return `start ${weekdayDate(f.startDate)}, ${d === 0 ? 'today' : d > 0 ? `in ${days(d)}` : `${days(-d)} ago`}`
    }
    case 'building': {
      const on = f.startedOn ?? f.startDate
      return on ? `started ${weekdayDate(on)}` : 'started'
    }
    case 'closed':
      return 'closed'
  }
}

/** The facts line under the name, each part joined by " · " when drawn: where, how big, for whom, and the stage's own fact. */
export function cardFactParts(f: CardFacts): string[] {
  const parts: string[] = []
  if (f.address) parts.push(f.address)
  const size = [f.sqFt ? `${f.sqFt.toLocaleString('en-US')} sq ft` : '', f.sizeNote].filter(Boolean).join(' ')
  if (size) parts.push(size)
  const who = [f.owner ? `for ${f.owner}` : '', f.architect ? `drawn by ${f.architect}` : ''].filter(Boolean).join(', ')
  if (who) parts.push(who)
  const when = stageWhen(f)
  if (when) parts.push(when)
  return parts
}

/** The three sets a door belongs to: the job's own, the work being built, and the money team's. */
export type DoorGroup = 'job' | 'work' | 'money'

export const DOOR_GROUP_WORDS: Record<DoorGroup, string> = {
  job: 'The job',
  work: 'The work',
  money: 'Money',
}

export type DoorKey = 'plans' | 'papers' | 'questions' | 'newSet' | 'schedule' | 'start' | 'log' | 'punch' | 'submittals' | 'rfis' | 'draws' | 'changes' | 'bill' | 'billDay' | 'closeout' | 'number' | 'tabs' | 'prospects'

export interface CardDoor {
  key: DoorKey
  group: DoorGroup
  label: string
  /** The fact beside the label, when there is one: "1 open", "2 missed", "5 of 7". */
  count?: string
  tone?: 'warn' | 'bad'
  /** The walkthrough's anchor (New here?), on the first card only; the page says which. */
  tour?: 'gc-plans' | 'gc-new-set' | 'gc-questions'
  title?: string
}

export interface DoorFacts {
  stage: CardStage
  lost: boolean
  /** Which doors this reader has, as the page's gates answer. */
  can: {
    papers: boolean
    schedule: boolean
    start: boolean
    log: boolean
    punch: boolean
    submittals: boolean
    rfis: boolean
    draws: boolean
    changes: boolean
    bill: boolean
    billDay: boolean
    closeout: boolean
    number: boolean
    tabs: boolean
    /** Send the owner back to Prospects (v2.5561): the prospects staff, on a lost job. */
    prospects?: boolean
  }
  counts: {
    questionsOpen: number
    logMissed: number
    changeOrders: number
    billDayOk: number
    billDayGates: number
    tabs: number
  }
  /** The two panels the head toggles, open or shut. */
  open: { number: boolean; tabs: boolean }
}

/** Every door this reader has on this card, in the order the sets draw them. */
export function cardDoors(f: DoorFacts): CardDoor[] {
  const doors: CardDoor[] = []
  const building = f.stage === 'building'
  // The job's own: the plans, the papers, the questions, a new set, the schedule.
  doors.push({ key: 'plans', group: 'job', label: 'The plans', tour: 'gc-plans' })
  if (f.can.papers) doors.push({ key: 'papers', group: 'job', label: 'Papers' })
  doors.push({
    key: 'questions',
    group: 'job',
    label: 'Questions about the plans',
    tour: 'gc-questions',
    ...(f.counts.questionsOpen > 0 ? { count: `${f.counts.questionsOpen} open`, tone: 'warn' as const } : {}),
  })
  if (!f.lost) doors.push({ key: 'newSet', group: 'job', label: 'A new set of plans came in', tour: 'gc-new-set' })
  if (f.can.schedule) doors.push({ key: 'schedule', group: 'job', label: 'Schedule' })
  // The work: the start checklist on a won job, then the windows of a job being built.
  if (f.can.start && (f.stage === 'buyout' || building) && !f.lost) doors.push({ key: 'start', group: 'work', label: 'Get started' })
  if (f.can.log && building)
    doors.push({ key: 'log', group: 'work', label: 'Daily log', ...(f.counts.logMissed > 0 ? { count: `${f.counts.logMissed} missed`, tone: 'bad' as const } : {}) })
  if (f.can.punch && building) doors.push({ key: 'punch', group: 'work', label: 'Punch list' })
  if (f.can.submittals && building) doors.push({ key: 'submittals', group: 'work', label: 'Submittals' })
  if (f.can.rfis && building) doors.push({ key: 'rfis', group: 'work', label: 'RFIs' })
  if (f.can.draws && building) doors.push({ key: 'draws', group: 'work', label: 'Draws' })
  // The money team's: the contract's changes, the bills, Bill day, closeout, our number and the bid tabs.
  if (f.can.changes && f.stage !== 'bidding' && !f.lost)
    doors.push({ key: 'changes', group: 'money', label: 'Change orders', ...(f.counts.changeOrders > 0 ? { count: String(f.counts.changeOrders) } : {}) })
  if (f.can.bill && f.stage !== 'bidding' && !f.lost) doors.push({ key: 'bill', group: 'money', label: 'Bill the customer' })
  if (f.can.billDay)
    doors.push({ key: 'billDay', group: 'money', label: 'Bill day', count: `${f.counts.billDayOk} of ${f.counts.billDayGates}`, title: 'Opens Money → Bill day → From the trades on this job.' })
  if (f.can.closeout && (building || f.stage === 'closed')) doors.push({ key: 'closeout', group: 'money', label: 'Closeout' })
  if (f.lost && f.can.prospects) doors.push({ key: 'prospects', group: 'job', label: 'Send the owner back to Prospects', title: 'A GC lead on Prospects → Jobs to GC, this job marked lost, so the next call is on the deck' })
  if (f.can.number) doors.push({ key: 'number', group: 'money', label: f.open.number ? 'Hide our number' : 'Our number' })
  if (f.can.tabs && f.counts.tabs > 0)
    doors.push({ key: 'tabs', group: 'money', label: f.open.tabs ? 'Hide the bid tabs' : 'Bid tabs', ...(f.open.tabs ? {} : { count: String(f.counts.tabs) }) })
  return doors
}

/** The door's words as one string, for a hover or a test: "Questions about the plans · 1 open". */
export function doorWords(d: CardDoor): string {
  return d.count ? `${d.label} · ${d.count}` : d.label
}

/** The page's stage words (`GcProjectView.stage`) as the card's stage; anything else reads as bidding. */
export function cardStageOf(stage: string): CardStage {
  return stage === 'buyout' || stage === 'building' || stage === 'closed' ? stage : 'bidding'
}

/** The plans band's words beside its heading (PR 4): "Set 0 of Oct 8 · 46 sheets, 3 sections · 2 sets in all", or "no set yet". */
export function plansWords(p: { planSets: { label: string; issuedOn: string }[]; sheets: unknown[]; specs: unknown[] }): string {
  const newest = p.planSets[p.planSets.length - 1]
  if (!newest) return 'no set yet'
  const parts = [
    `${newest.label} of ${shortDate(newest.issuedOn)}`,
    `${p.sheets.length} ${p.sheets.length === 1 ? 'sheet' : 'sheets'}${p.specs.length > 0 ? `, ${p.specs.length} ${p.specs.length === 1 ? 'section' : 'sections'}` : ''}`,
  ]
  if (p.planSets.length > 1) parts.push(`${p.planSets.length} sets in all`)
  return parts.join(' · ')
}
