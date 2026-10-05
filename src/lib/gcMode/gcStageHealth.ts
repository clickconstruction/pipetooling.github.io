/**
 * GC mode — design spike: how the stage is going, for the strip under a project's title (the owner,
 * 2026-10-04: "at the top of this page we should have some sort of visual that describes the health
 * of the stage"; he took the revised design in `to-dos/gc-mode/stage-health-mockup.html`). Every
 * stage reads the same way: a verdict with its reason, the stage's calendar, one tile a trade, a few
 * numbers, and the one thing to do next. The counts are the ring's own (`stageProgress`), so the
 * board and the project page never give two answers.
 */
import type { GcProject, GcState, TradePackage } from './gcTypes'
import { money, shortDate, weekdayDate, daysUntil } from './gcWords'
import { currentRev, partnerById, planLabel } from './gcLookups'
import { questionsCloseOn } from './gcPlans'
import { startChecklist } from './gcStart'
import { BIDS_WANTED, bidIsStale, bidsIn, carriedAmount, carriedUncosted, isGuess, quoteRanOut } from './gcBids'
import { projectPeople } from './gcProjectPeople'
import { ownCrewWork } from './gcBuilding'
import { milestoneRows, openInspectionFailures, scheduleSummary, daysBetween } from './gcBuildingSchedule'
import { submittalRows } from './gcBuildingSubmittals'
import { punchCounts } from './gcBuildingPunch'
import { missingLogs } from './gcBuildingLog'
import { priceToOwner } from './gcCustomers'
import { stageProgress } from './gcProgress'

export type HealthVerdict = 'on track' | 'watch' | 'behind'

/** The project tab the next step opens. */
export type HealthTab = 'packages' | 'plans' | 'number' | 'tabs' | 'contracts' | 'start' | 'submittals' | 'schedule' | 'log' | 'draws' | 'owner' | 'closeout'

/** A tile's state: done for this stage, under way or waiting on a company, a hole or waiting on us, our own crew. */
export type TileState = 'good' | 'warn' | 'bad' | 'ours'

/** One small mark on a tile: a quote in, or a paper. On (done), wait (on them), us (on us), off (not yet). */
export type TileDot = 'on' | 'wait' | 'us' | 'off'

export interface HealthTile {
  packageId: string
  trade: string
  state: TileState
  /** The tile's main line: a number, "Pick 1 of 2", "No quote", "Our own crew". */
  main: string
  note: string
  dots?: TileDot[]
  /** Building: the percent done. */
  pct?: number
}

/** One day of the stage's calendar (the owner, 2026-10-04: "squares for days separated with a little bit of space where one week becomes the next"). */
export interface CalendarDay {
  on: string
  /** One of the stage's own days. Days before or after only fill out a week, drawn faint. */
  inStage: boolean
  weekend: boolean
  past: boolean
  today: boolean
  /** A deadline on the day: questions close and quotes wanted, or the last day (the bid due, the start). */
  deadline?: 'close' | 'due'
  /** Said under the square, for the days that matter. */
  label?: string
  /** A short tag on the square: "A1" for Addendum 1. */
  tag?: string
  /** What came in that day: quotes, or papers while buying out. */
  came: string[]
  questions: number
  /** Companies that said they would send their quote by this day and have not. */
  promised: string[]
  /** Everything about the day, for the hover. */
  events: string[]
}

/** One week of a long stage: building is drawn a square a week. */
export interface CalendarWeek {
  start: string
  month: number
  past: boolean
  current: boolean
  inStage: boolean
  /** A milestone in the week: met, late, the next one due, or the finish. */
  kind?: 'met' | 'late' | 'next' | 'end'
  marks: ('good' | 'bad')[]
  events: string[]
}

export interface StageCalendar {
  mode: 'days' | 'weeks'
  /** Days mode: the stage's weeks, Monday to Sunday. */
  weeks: CalendarDay[][]
  /** Weeks mode: one square a week. */
  squares: CalendarWeek[]
  /** The line over the calendar, each a bold value and its words: "5 working days left", "9 of 14 quotes in". */
  summary: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }[]
  /** A stage with no last day yet: the words for the open end ("No start date"). */
  openEnd?: string
}

export interface HealthNumber {
  label: string
  value: string
  note: string
  tone?: 'good' | 'warn' | 'bad'
  /** Money a teammate does not see in the real build (the owner and the controller do, as on the Money tab). */
  money?: boolean
}

export interface HealthBar {
  label: string
  /** 0 to 100. */
  pct: number
  /** A tick to measure against: the plan, or the work in place. */
  mark?: number
  value: string
  kind: 'work' | 'time' | 'billed' | 'paid'
  money?: boolean
}

export interface StageHealth {
  verdict: HealthVerdict
  /** The reason, in one sentence or two. */
  why: string
  /** The one thing to do now, and the tab it opens. Null: nothing waits on us. */
  next: { words: string; tab: HealthTab } | null
  /** The stage's calendar: days while bidding and buying out, weeks while building. */
  calendar: StageCalendar
  tiles: HealthTile[]
  numbers: HealthNumber[]
  bars: HealthBar[]
  /** Buying out with no start date: the strip offers to set one. */
  askStartDate: boolean
}

/** Bidding is behind with a trade that has no quote this close to the bid, or anything left this close. */
export const HEALTH_HOLE_DAYS = 7
export const HEALTH_LAST_DAYS = 2
/** Buying out is behind when the start is this close and a trade is not ready. */
export const HEALTH_START_DAYS = 7
/** Building is behind when the work slips more than this many days past the plan. */
export const HEALTH_SLIP_DAYS = 7

function companyOf(state: GcState, pkg: TradePackage, inviteId: string | null): string | null {
  const invite = pkg.invites.find((i) => i.id === inviteId)
  return invite ? (partnerById(state, invite.partnerId)?.company ?? null) : null
}

/**
 * A trade has a number when it carries a real quote with a cost on every line that has not run
 * out, or our own crew's priced number: the ring's rule, and now the header's (the owner,
 * 2026-10-04: one page, one answer).
 */
export function tradeHasNumber(state: GcState, pkg: TradePackage): boolean {
  const amount = carriedAmount(pkg)
  if (amount === null || isGuess(pkg) || carriedUncosted(pkg).length > 0) return false
  const carriedFrom = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return !(!pkg.sow && carriedFrom?.bid && quoteRanOut(carriedFrom.bid, state.today))
}

/** How the stage is going. Null for a bid we lost or a closed job: nothing is going. */
export function stageHealth(state: GcState, project: GcProject): StageHealth | null {
  if (project.lostOn || project.closedOn) return null
  if (project.stage === 'pursuing') return biddingHealth(state, project)
  if (project.stage === 'buyout') return buyoutHealth(state, project)
  return buildingHealth(state, project)
}

// ---------------------------------------------------------------------------------------------
// Bidding: the trades against the bid date
// ---------------------------------------------------------------------------------------------

function biddingHealth(state: GcState, project: GcProject): StageHealth {
  const today = state.today
  const newest = currentRev(project)
  const tiles: HealthTile[] = project.packages.map((pkg) => {
    const amount = carriedAmount(pkg)
    const has = tradeHasNumber(state, pkg)
    if (pkg.selfPerform) {
      return { packageId: pkg.id, trade: pkg.trade, state: has ? 'ours' : 'bad', main: has && amount !== null ? money(amount) : 'Not priced', note: has ? `Our own crew · ${pkg.selfPerform.ref}` : 'Price our own bid' }
    }
    const quotes = bidsIn(pkg).filter((i) => !(i.bid && quoteRanOut(i.bid, today)))
    const stale = quotes.filter((i) => bidIsStale(project, pkg, i))
    const dots: TileDot[] = quotes.map((i) => (bidIsStale(project, pkg, i) ? 'wait' : 'on'))
    while (dots.length < BIDS_WANTED) dots.push('off')
    const who = companyOf(state, pkg, pkg.awardedInviteId ?? pkg.carried)
    const uncosted = carriedUncosted(pkg)
    const asked = pkg.invites.filter((i) => i.status === 'invited' || i.status === 'opened').length
    if (has && amount !== null) {
      const over = amount - pkg.budget
      return {
        packageId: pkg.id,
        trade: pkg.trade,
        state: stale.length > 0 ? 'warn' : 'good',
        main: money(amount),
        note: stale.length > 0 ? `${stale.length} ${stale.length === 1 ? 'quote' : 'quotes'} on old plans` : over > 0 && pkg.budget > 0 ? `${who ?? 'Carried'} · ${money(over)} over budget` : (who ?? 'Carried'),
        dots,
      }
    }
    if (amount !== null && uncosted.length > 0) {
      return { packageId: pkg.id, trade: pkg.trade, state: 'warn', main: `${money(amount)} + ?`, note: `${uncosted.length === 1 ? 'A line has' : `${uncosted.length} lines have`} no cost`, dots }
    }
    if (quotes.length > 0) {
      const old = stale.length > 0 ? `${companyOf(state, pkg, stale[0]?.id ?? null) ?? 'One'} priced old plans` : quotes.length < BIDS_WANTED ? `${asked > 0 ? `${asked} still asked` : 'Ask more companies'}` : 'Pick one to use'
      return { packageId: pkg.id, trade: pkg.trade, state: 'warn', main: `Pick 1 of ${quotes.length}`, note: old, dots }
    }
    return { packageId: pkg.id, trade: pkg.trade, state: 'bad', main: isGuess(pkg) && amount !== null ? `Our guess ${money(amount)}` : 'No quote', note: asked > 0 ? `${asked} asked, none in` : 'Ask more companies', dots }
  })

  const holes = tiles.filter((t) => t.state === 'bad')
  const withNumber = project.packages.filter((p) => tradeHasNumber(state, p)).length
  const left = tiles.filter((t) => t.state !== 'good' && t.state !== 'ours').length
  const due = project.bidDue
  const daysLeft = due ? daysUntil(due, today) : null
  const sent = project.ourBidSentOn
  const daysWords = daysLeft === null ? 'No bid date' : daysLeft < 0 ? `The bid was due ${weekdayDate(due ?? today)}` : daysLeft === 0 ? 'The bid is due today' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
  const holeNames = holes.map((t) => t.trade)
  const names = (list: string[]) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)

  let verdict: HealthVerdict
  let why: string
  if (sent) {
    verdict = 'on track'
    why = `Our bid went in ${weekdayDate(sent)}. Waiting on the customer.`
  } else if ((daysLeft !== null && daysLeft < 0) || (holes.length > 0 && daysLeft !== null && daysLeft <= HEALTH_HOLE_DAYS) || (left > 0 && daysLeft !== null && daysLeft <= HEALTH_LAST_DAYS)) {
    verdict = 'behind'
    why = holes.length > 0
      ? `${daysWords} and ${holes.length === 1 ? '1 trade has' : `${holes.length} trades have`} no quote: ${names(holeNames)}.`
      : `${daysWords} and ${left === 1 ? '1 trade still needs' : `${left} trades still need`} work before our bid goes in.`
  } else if (left > 0) {
    verdict = 'watch'
    why = `${daysWords}. ${withNumber} of ${tiles.length} trades have a number${holes.length > 0 ? `, and ${names(holeNames)} ${holes.length === 1 ? 'has' : 'have'} no quote` : ''}.`
  } else {
    verdict = 'on track'
    why = `${daysWords}. Every trade has a number on ${planLabel(project, newest)}. Send our bid.`
  }

  // The next step: a hole first, then a trade short of quotes, a quote to pick, a line with no cost, a quote on old plans, then the bid.
  const hired = project.packages.filter((p) => !p.selfPerform)
  const short = hired.find((p) => !tradeHasNumber(state, p) && bidsIn(p).filter((i) => !(i.bid && quoteRanOut(i.bid, today))).length === 0)
  const pick = hired.find((p) => carriedAmount(p) === null && bidsIn(p).length > 0)
  const uncostedPkg = hired.find((p) => carriedAmount(p) !== null && carriedUncosted(p).length > 0)
  const stalePkg = hired.flatMap((p) => bidsIn(p).filter((i) => bidIsStale(project, p, i)).map((i) => ({ p, i })))[0]
  const next: StageHealth['next'] = sent
    ? null
    : short
      ? { words: `Ask more companies for ${short.trade}`, tab: 'packages' }
      : pick
        ? { words: `Pick the quote we'll use for ${pick.trade}`, tab: 'packages' }
        : uncostedPkg
          ? { words: `Set the missing cost on ${uncostedPkg.trade}`, tab: 'packages' }
          : stalePkg
            ? { words: `Ask ${partnerById(state, stalePkg.i.partnerId)?.company ?? 'them'} to confirm on ${planLabel(project, newest)}`, tab: 'packages' }
            : { words: 'Send our bid', tab: 'number' }

  const calendar = biddingCalendar(state, project)

  // Everyone we are waiting on, each once: the board row's count (projectPeople), so the two agree.
  const people = projectPeople(state, project)
  const numbers: HealthNumber[] = [
    { label: 'Trades with a number', value: `${withNumber} of ${tiles.length}`, note: holes.length > 0 ? `${holes.length} with no quote` : left > 0 ? `${left} to finish` : 'all in', tone: withNumber === tiles.length ? 'good' : holes.length > 0 ? 'bad' : 'warn' },
    { label: 'Our bid', value: sent ? 'Sent' : 'Not sent', note: sent ? weekdayDate(sent) : due ? `due ${weekdayDate(due)}` : 'no due date', ...(sent ? { tone: 'good' as const } : {}) },
    {
      label: 'People to call',
      value: String(people.count),
      note: people.count === 0 ? 'nobody right now' : people.late > 0 ? `${people.late} late` : 'none late yet',
      ...(people.late > 0 ? { tone: 'bad' as const } : people.count > 0 ? { tone: 'warn' as const } : {}),
    },
  ]
  return { verdict, why, next, calendar, tiles, numbers, bars: [], askStartDate: false }
}

// ---------------------------------------------------------------------------------------------
// Buying out: ready to start, trade by trade
// ---------------------------------------------------------------------------------------------

/** Whose move a step of Get started is: done, theirs, ours, or not yet (nothing to judge before the award). */
function stepDot(key: string, detail: string, done: boolean): TileDot {
  if (done) return 'on'
  if (detail === 'after the award') return 'off'
  if (key === 'awarded') return 'us'
  if (key === 'msa') return detail.startsWith('sent') ? 'wait' : 'us'
  if (key === 'coi' || key === 'w9') return 'wait'
  if (key === 'sow') return detail.startsWith('sent') ? 'wait' : 'us'
  return 'us'
}

const STEP_WORDS: Record<string, string> = { awarded: 'Not awarded', msa: 'Master agreement', coi: 'Insurance', w9: 'W-9', sow: 'Statement of work' }

function buyoutHealth(state: GcState, project: GcProject): StageHealth {
  const today = state.today
  const list = startChecklist(state, project)
  const tiles: HealthTile[] = list.trades.map((t) => {
    const self = t.checks.find((c) => c.key === 'self')
    if (self) return { packageId: t.pkg.id, trade: t.pkg.trade, state: self.done ? 'ours' : 'bad', main: 'Our own crew', note: self.done ? `Ready · ${t.pkg.selfPerform?.ref ?? ''}`.trim() : 'Price our own bid' }
    const dots = t.checks.map((c) => stepDot(c.key, c.detail, c.done))
    // The step that waits on us comes first in the note; else the first one still open.
    const open = t.checks.find((c) => stepDot(c.key, c.detail, c.done) === 'us') ?? t.checks.find((c) => !c.done)
    const company = t.partner?.company
    const carried = carriedAmount(t.pkg)
    const note = !open
      ? `Ready · ${company ?? ''}`.trim()
      : open.key === 'awarded'
        ? `Not awarded${carried !== null ? ` · ${companyOf(state, t.pkg, t.pkg.carried) ?? 'carried'} ${money(carried)}` : ''}`
        : `${STEP_WORDS[open.key] ?? open.label} ${open.detail}`
    return { packageId: t.pkg.id, trade: t.pkg.trade, state: t.ready ? 'good' : dots.includes('us') ? 'bad' : 'warn', main: t.ready ? 'Ready' : `${t.checks.filter((c) => !c.done).length} to go`, note, dots }
  })
  const ready = list.trades.filter((t) => t.ready).length
  const onThem = list.trades.flatMap((t) => t.checks.map((c) => stepDot(c.key, c.detail, c.done))).filter((d) => d === 'wait').length
  const onUs = list.trades.flatMap((t) => t.checks.map((c) => stepDot(c.key, c.detail, c.done))).filter((d) => d === 'us').length
  const ourSide = [...list.owner, list.schedule]
  const ourDone = ourSide.filter((c) => c.done).length
  const start = project.startDate
  const daysToStart = start ? daysUntil(start, today) : null
  const notAwarded = list.trades.filter((t) => t.checks.some((c) => c.key === 'awarded' && !c.done)).map((t) => t.pkg.trade)

  let verdict: HealthVerdict
  let why: string
  if (list.ready) {
    verdict = 'on track'
    why = 'Everything is in. Open Get started and start the job.'
  } else if (start && daysToStart !== null && daysToStart <= HEALTH_START_DAYS) {
    verdict = 'behind'
    why = `${daysToStart <= 0 ? 'The start date has come' : `Start in ${daysToStart} ${daysToStart === 1 ? 'day' : 'days'}`} and ${list.trades.length - ready} of ${list.trades.length} trades are not ready.`
  } else {
    verdict = 'watch'
    why = `${start ? `Start ${weekdayDate(start)}.` : 'No start date yet.'} ${ready} of ${list.trades.length} trades are ready.${notAwarded.length > 0 ? ` ${notAwarded.join(' and ')} ${notAwarded.length === 1 ? 'is' : 'are'} not awarded.` : ''}`
  }

  // The next step: what waits on us, in the order it has to happen.
  const firstUs = list.trades.find((t) => t.checks.some((c) => stepDot(c.key, c.detail, c.done) === 'us'))
  const usCheck = firstUs?.checks.find((c) => stepDot(c.key, c.detail, c.done) === 'us')
  const next: StageHealth['next'] = list.ready
    ? { words: 'Start the job', tab: 'start' }
    : notAwarded.length > 0
      ? { words: `Award ${notAwarded[0]}`, tab: 'contracts' }
      : !start
        ? { words: 'Set a start date', tab: 'start' }
        : firstUs && usCheck
          ? { words: usCheck.key === 'msa' ? `Send ${firstUs.pkg.trade} the master agreement` : `Send ${firstUs.pkg.trade} its statement of work`, tab: 'contracts' }
          : !list.schedule.done
            ? { words: 'Draw the schedule', tab: 'schedule' }
            : { words: 'Get the papers in from the companies', tab: 'contracts' }

  const calendar = buyoutCalendar(state, project)
  const numbers: HealthNumber[] = [
    { label: 'Our side', value: `${ourDone} of ${ourSide.length}`, note: ourSide.filter((c) => !c.done).map((c) => (c.key === 'ownerContract' ? 'contract' : c.key === 'startDate' ? 'start date' : c.key === 'schedule' ? 'schedule' : 'permit')).join(', ') || 'all in', tone: ourDone === ourSide.length ? 'good' : 'warn' },
    { label: 'Trades ready', value: `${ready} of ${list.trades.length}`, note: `${onThem} ${onThem === 1 ? 'paper waits' : 'papers wait'} on companies, ${onUs} on us`, tone: ready === list.trades.length ? 'good' : onUs > 0 ? 'bad' : 'warn' },
    { label: 'Start', value: start ? weekdayDate(start) : 'No date', note: start ? (daysToStart !== null && daysToStart >= 0 ? `in ${daysToStart} ${daysToStart === 1 ? 'day' : 'days'}` : 'the day has come') : 'set one to start the clock', ...(start ? {} : { tone: 'bad' as const }) },
  ]
  return {
    verdict,
    why,
    next,
    calendar,
    tiles,
    numbers,
    bars: [],
    askStartDate: !start,
  }
}

// ---------------------------------------------------------------------------------------------
// Building: work against time, money against work
// ---------------------------------------------------------------------------------------------

function buildingHealth(state: GcState, project: GcProject): StageHealth {
  const today = state.today
  const progress = stageProgress(state, project)
  const sum = scheduleSummary(project, today)
  const failures = openInspectionFailures(project)
  const submittals = submittalRows(state, project).filter((r) => r.state !== 'approved')
  const submittalOnUs = submittals.filter((r) => r.state === 'us')
  const noLog = missingLogs(project, today)

  // Each trade's tile, with what waits on it or on us.
  const tiles: HealthTile[] = project.packages.flatMap((pkg) => {
    const crew = ownCrewWork(pkg)
    const sov = pkg.sow?.sov
    if (!crew && !sov) return []
    const worth = crew ? crew.worth : (sov ?? []).reduce((s, l) => s + l.amount, 0)
    const done = crew ? crew.done : (sov ?? []).reduce((s, l) => s + (l.amount * l.pctReported) / 100, 0)
    const pct = worth === 0 ? 0 : Math.round((done / worth) * 100)
    const company = companyOf(state, pkg, pkg.awardedInviteId)
    const failed = failures.find((f) => f.failure.packageIds.includes(pkg.id))
    const draw = (pkg.sow?.draws ?? []).find((d) => d.status === 'requested')
    const sub = submittalOnUs.find((r) => r.pkg?.id === pkg.id)
    const punch = punchCounts(project, pkg.id)
    const onUs = Boolean(draw || sub)
    const note = failed
      ? `${failed.label} failed ${shortDate(failed.failure.on)}`
      : draw
        ? `Draw ${draw.number} waits on our approval`
        : sub
          ? `Their submittal waits on us${sub.neededBy === today ? ', needed today' : ''}`
          : punch.open > 0
            ? `${punch.open} punch ${punch.open === 1 ? 'item' : 'items'} to fix`
            : crew
              ? 'Our own crew'
              : (company ?? pkg.trade)
    const state_: TileState = crew ? 'ours' : failed || onUs ? 'bad' : pct >= 100 ? 'good' : 'warn'
    return [{ packageId: pkg.id, trade: pkg.trade, state: state_, main: `${pct}%`, note, pct }]
  })

  // What waits on us: draws to approve or pay, submittals, punch items to check, look-ahead marks, a missing log.
  const draws = project.packages.flatMap((p) => (p.sow?.draws ?? []).filter((d) => d.status === 'requested' || d.status === 'approved'))
  const punchToCheck = project.packages.reduce((n, p) => n + punchCounts(project, p.id).fixed, 0)
  const lookAheadWaiting = sum?.lookAhead.waiting ?? 0
  const onUsItems = draws.length + submittalOnUs.length + (punchToCheck > 0 ? 1 : 0) + (lookAheadWaiting > 0 ? 1 : 0) + (noLog.length > 0 ? 1 : 0)

  const rows = milestoneRows(state, project)
  const finish = rows.find((r) => /substantial/i.test(r.milestone.label))
  const late = rows.filter((r) => r.state === 'late' || r.state === 'missed')
  const daysBehind = sum?.daysBehind ?? 0
  const donePct = Math.round(sum?.donePct ?? 0)
  const plannedPct = Math.round(sum?.plannedPct ?? 0)
  const startOn = project.startedOn ?? project.startDate ?? today
  const endOn = finish?.due ?? null

  let verdict: HealthVerdict
  let why: string
  if (progress.share >= 1) {
    verdict = 'on track'
    why = 'All the work is reported. Close out the trades and the job.'
  } else if (!sum) {
    verdict = 'watch'
    why = 'No schedule is drawn, so nothing says whether the work is on time.'
  } else if (daysBehind > HEALTH_SLIP_DAYS) {
    verdict = 'behind'
    why = `${daysBehind} days behind the plan. ${donePct}% done where ${plannedPct}% was planned.`
  } else if (daysBehind > 0 || late.length > 0 || failures.length > 0) {
    verdict = 'watch'
    const parts = [
      daysBehind > 0 ? `${daysBehind} ${daysBehind === 1 ? 'day' : 'days'} behind the plan.` : 'On the plan.',
      ...late.slice(0, 1).map((r) => `${r.milestone.label} ${r.milestone.metOn ? 'finished' : 'is'} ${r.daysLate} ${r.daysLate === 1 ? 'day' : 'days'} late.`),
      failures.length > 0 && late.length === 0 ? `The ${failures[0]?.label.toLowerCase()} failed.` : null,
      endOn ? `The finish holds at ${shortDate(endOn)}.` : null,
    ].filter(Boolean)
    why = parts.join(' ')
  } else {
    verdict = 'on track'
    why = `On the plan: ${donePct}% done${endOn ? `, finish ${shortDate(endOn)}` : ''}.`
  }

  // The next step: a draw past its pay-by day is checked by the ring; here, what we can do today first.
  const todaySub = submittalOnUs.find((r) => r.neededBy && r.neededBy <= today) ?? submittals.find((r) => r.daysLate > 0 && r.state === 'us')
  const requested = project.packages.flatMap((p) => (p.sow?.draws ?? []).filter((d) => d.status === 'requested').map((d) => ({ p, d })))[0]
  const next: StageHealth['next'] = progress.share >= 1
    ? { words: 'Close out the job', tab: 'closeout' }
    : todaySub
      ? { words: `Answer ${todaySub.company}'s submittal, ${todaySub.submittal.title.toLowerCase()}${todaySub.neededBy === today ? ', needed today' : ''}`, tab: 'submittals' }
      : requested
        ? { words: `Approve draw ${requested.d.number} for ${companyOf(state, requested.p, requested.p.awardedInviteId) ?? requested.p.trade}`, tab: 'draws' }
        : failures[0]
          ? { words: `Get the ${failures[0].label.toLowerCase()} passed, again ${shortDate(failures[0].failure.reinspectOn)}`, tab: 'schedule' }
          : lookAheadWaiting > 0
            ? { words: `Check the trades' look-ahead marks`, tab: 'schedule' }
            : noLog.length > 0
              ? { words: `Write the daily log for ${weekdayDate(noLog[0] ?? today)}`, tab: 'log' }
              : null

  const calendar = buildingCalendar(state, project, startOn, endOn)

  // Money against work: the price, billed and paid (Bill the customer), the work in place by the ring's weights.
  const price = priceToOwner(project).price
  const billed = project.ownerBilling?.billed ?? 0
  const paid = project.ownerBilling?.paid ?? 0
  const held = project.ownerBilling?.retainageHeld ?? 0
  const inPlace = Math.round(progress.share * 100)
  const notBilled = Math.max(0, progress.share * price - billed)
  const pct = (n: number) => (price > 0 ? Math.round((n / price) * 100) : 0)
  const timeAll = endOn ? Math.max(1, daysBetween(startOn, endOn)) : null
  const timeUsed = endOn ? Math.min(Math.max(0, daysBetween(startOn, today)), timeAll ?? 0) : null
  const bars: HealthBar[] = [
    ...(sum ? [{ label: 'Work done', pct: donePct, mark: plannedPct, value: `${donePct}% · plan ${plannedPct}%`, kind: 'work' as const }] : []),
    ...(timeAll !== null && timeUsed !== null ? [{ label: 'Time used', pct: Math.round((timeUsed / timeAll) * 100), value: `${timeUsed} of ${timeAll} days`, kind: 'time' as const }] : []),
    ...(price > 0 ? [{ label: 'Billed the customer', pct: pct(billed), mark: inPlace, value: `${pct(billed)}% · work ${inPlace}%`, kind: 'billed' as const, money: true }] : []),
    ...(price > 0 ? [{ label: 'Paid us', pct: pct(paid), value: `${pct(paid)}% of the price`, kind: 'paid' as const, money: true }] : []),
  ]
  const numbers: HealthNumber[] = [
    ...(endOn ? [{ label: 'Finish', value: shortDate(endOn), note: `${daysUntil(endOn, today)} days left${finish && finish.addedDays > 0 ? `, ${finish.addedDays} added by change orders` : ''}`, tone: (daysBehind > HEALTH_SLIP_DAYS ? 'bad' : 'good') as 'bad' | 'good' }] : []),
    ...(notBilled >= 1000 ? [{ label: 'Not billed yet', value: `about ${money(Math.round(notBilled / 1000) * 1000)}`, note: 'work in place past our last bill', tone: 'warn' as const, money: true }] : []),
    ...(billed > 0 ? [{ label: 'Billed, not paid', value: money(billed - paid), note: held > 0 ? `retainage held ${money(held)}` : 'nothing held', money: true }] : []),
    { label: 'Waiting on us', value: String(onUsItems), note: onUsItems === 0 ? 'nothing' : [draws.length > 0 ? `${draws.length} ${draws.length === 1 ? 'draw' : 'draws'}` : null, submittalOnUs.length > 0 ? `${submittalOnUs.length} ${submittalOnUs.length === 1 ? 'submittal' : 'submittals'}` : null, punchToCheck > 0 ? 'a punch check' : null, lookAheadWaiting > 0 ? 'look-ahead marks' : null, noLog.length > 0 ? 'a daily log' : null].filter(Boolean).join(', '), ...(onUsItems > 0 ? { tone: 'bad' as const } : {}) },
  ]
  return { verdict, why, next, calendar, tiles, numbers, bars, askStartDate: false }
}

// ---------------------------------------------------------------------------------------------
// The calendar: a square a day, a little space where one week becomes the next (the owner,
// 2026-10-04, `bid-calendar-mockup.html`). Weekends are narrow, each day carries what happened on
// it, the deadlines ahead are marked, and building, months long, is a square a week.
// ---------------------------------------------------------------------------------------------

/**
 * The day we want every quote in: the day questions close, three days before our bid is due, so
 * there are days left to level the quotes and price our bid. Null: no bid date, or not bidding.
 * The trades' portal gives it as their due day (the Portal lane's `portalQuoteDue`): if this ever
 * stops being the questions-close day, say which one the trades' due day follows.
 */
export function quotesWantedOn(project: GcProject): string | null {
  return questionsCloseOn(project)
}

function addDay(on: string, n: number): string {
  const d = new Date(`${on}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 0 for Monday through 6 for Sunday. */
function weekday(on: string): number {
  return (new Date(`${on}T12:00:00Z`).getUTCDay() + 6) % 7
}

const mondayOfDay = (on: string) => addDay(on, -weekday(on))

/** Working days from today to the day, counting both (a weekend today counts from Monday). */
export function workingDaysLeft(today: string, until: string): number {
  let n = 0
  for (let d = today; d <= until; d = addDay(d, 1)) if (weekday(d) < 5) n++
  return n
}

/** The days from one Monday to the Sunday after the last day, each set out as a blank. */
function blankWeeks(from: string, to: string, today: string): CalendarDay[][] {
  const weeks: CalendarDay[][] = []
  for (let monday = mondayOfDay(from); monday <= to; monday = addDay(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const on = addDay(monday, i)
        return { on, inStage: on >= from && on <= to, weekend: i >= 5, past: on < today, today: on === today, came: [], questions: 0, promised: [], events: [] }
      }),
    )
  }
  return weeks
}

function dayOf(weeks: CalendarDay[][], on: string): CalendarDay | undefined {
  for (const w of weeks) for (const d of w) if (d.on === on) return d
  return undefined
}

/** A set's tag on its square: "A1" for Addendum 1, "B2" for Bulletin 2, else its first letters. */
function setTag(label: string): string {
  const m = label.match(/^(\w)\w*\s+(\d+)$/)
  if (m) return `${m[1]}${m[2]}`
  return label
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3)
}

function biddingCalendar(state: GcState, project: GcProject): StageCalendar {
  const today = state.today
  const first = project.planSets[0]?.issuedOn ?? today
  const due = project.bidDue ?? addDay(today, 14)
  const weeks = blankWeeks(first, due, today)
  const at = (on: string) => dayOf(weeks, on)
  const close = quotesWantedOn(project)
  const sent = project.ourBidSentOn

  const firstSet = project.planSets[0]
  const start = at(first)
  if (start && firstSet) {
    start.label = firstSet.label
    start.events.push(`${firstSet.label} came in.`)
  }
  for (const set of project.planSets.slice(1)) {
    const d = at(set.issuedOn)
    if (!d) continue
    d.tag = setTag(set.label)
    d.label = set.label
    d.events.push(`${set.label} went out.`)
  }
  const invitedBy = new Map<string, number>()
  for (const pkg of project.packages) {
    for (const inv of pkg.invites) {
      invitedBy.set(inv.invitedOn, (invitedBy.get(inv.invitedOn) ?? 0) + 1)
      const company = partnerById(state, inv.partnerId)?.company ?? 'A company'
      if (inv.bid) at(inv.bid.submittedOn)?.came.push(company)
      if (inv.declineReason) at(inv.declineReason.on)?.events.push(`${company} passed on ${pkg.trade}.`)
      // A day they said they would send it, newest promise first, until the quote comes.
      const promise = !inv.bid ? [...(inv.contacts ?? [])].reverse().find((c) => c.promisedBy)?.promisedBy : undefined
      if (promise) at(promise)?.promised.push(company)
    }
  }
  for (const [on, n] of invitedBy) at(on)?.events.push(`${n} ${n === 1 ? 'company' : 'companies'} invited.`)
  for (const q of project.questions) {
    const asked = at(q.askedOn)
    if (asked) asked.questions += 1
    if (q.answeredOn) at(q.answeredOn)?.events.push('A question was answered.')
  }
  if (project.preBid) {
    const d = at(project.preBid.on)
    if (d) {
      d.label = 'Pre-bid meeting'
      d.events.push(`The pre-bid meeting${project.preBid.mandatory ? ', required to quote' : ''}.`)
    }
  }
  if (close) {
    const d = at(close)
    if (d) {
      d.deadline = 'close'
      d.label = 'Questions close · quotes wanted'
      d.events.push('Questions close. Every quote wanted by today.')
    }
  }
  if (project.bidDue) {
    const d = at(project.bidDue)
    if (d) {
      d.deadline = 'due'
      d.label = 'Bid due'
      d.events.push('Our bid is due.')
    }
  }
  if (sent) {
    const d = at(sent)
    if (d) {
      d.label = 'Bid sent'
      d.events.push('Our bid went in.')
    }
  }
  const t = at(today)
  if (t) t.label = t.label ? `Today · ${t.label}` : 'Today'
  for (const w of weeks) {
    for (const d of w) {
      if (d.came.length > 0) d.events.push(`${d.came.length} ${d.came.length === 1 ? 'quote' : 'quotes'} in: ${d.came.join(', ')}.`)
      if (d.questions > 0) d.events.push(`${d.questions === 1 ? 'A question was' : `${d.questions} questions were`} asked.`)
      if (d.promised.length > 0) d.events.push(`${d.promised.join(', ')} said ${d.promised.length === 1 ? 'its quote comes' : 'their quotes come'} by today.`)
    }
  }

  const hired = project.packages.filter((p) => !p.selfPerform)
  const wanted = hired.length * BIDS_WANTED
  const quotesIn = hired.reduce((n, p) => n + Math.min(BIDS_WANTED, bidsIn(p).filter((i) => !(i.bid && quoteRanOut(i.bid, today))).length), 0)
  const open = project.questions.filter((q) => !q.answeredOn).length
  const left = project.bidDue && !sent ? workingDaysLeft(today, project.bidDue) : null
  const summary: StageCalendar['summary'] = [
    ...(left !== null ? [{ label: left === 1 ? 'working day left, counting today' : 'working days left, counting today', value: String(left), ...(left <= HEALTH_LAST_DAYS ? { tone: 'bad' as const } : {}) }] : []),
    { label: 'quotes in', value: `${quotesIn} of ${wanted}`, tone: quotesIn >= wanted ? 'good' : 'warn' },
    ...(open > 0 ? [{ label: open === 1 ? 'question open' : 'questions open', value: String(open), tone: 'warn' as const }] : []),
  ]
  return { mode: 'days', weeks, squares: [], summary }
}

/** Buying out shows the last three weeks and the days to the start; the contract day is in the summary when it is earlier. */
const BUYOUT_WEEKS_BACK = 3

function buyoutCalendar(state: GcState, project: GcProject): StageCalendar {
  const today = state.today
  const won = project.ownerContractSignedOn ?? project.ourBidSentOn ?? today
  const from = won < addDay(mondayOfDay(today), -7 * (BUYOUT_WEEKS_BACK - 1)) ? addDay(mondayOfDay(today), -7 * (BUYOUT_WEEKS_BACK - 1)) : won
  const start = project.startDate
  const to = start ?? addDay(today, 13)
  const weeks = blankWeeks(from, to, today)
  const at = (on: string) => dayOf(weeks, on)
  if (project.ownerContractSignedOn) {
    const d = at(project.ownerContractSignedOn)
    if (d) {
      d.label = 'Contract signed'
      d.events.push(`Our contract with ${project.owner} was signed.`)
    }
  }
  if (project.permitOn) {
    const d = at(project.permitOn)
    if (d) {
      d.label = 'Permit'
      d.came.push('the permit')
      d.events.push('The permit came in.')
    }
  }
  for (const pkg of project.packages) {
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const partner = invite ? partnerById(state, invite.partnerId) : undefined
    const company = partner?.company ?? pkg.trade
    if (pkg.sow?.sentOn) at(pkg.sow.sentOn)?.events.push(`The statement of work went to ${company}.`)
    if (pkg.sow?.signedOn) {
      const d = at(pkg.sow.signedOn)
      if (d) {
        d.came.push(`${company}'s statement of work`)
        d.events.push(`${company} signed the statement of work.`)
      }
    }
    if (partner?.msaSignedOn) {
      const d = at(partner.msaSignedOn)
      if (d) {
        d.came.push(`${company}'s master agreement`)
        d.events.push(`${company} signed the master agreement.`)
      }
    }
  }
  if (start) {
    const d = at(start)
    if (d) {
      d.deadline = 'due'
      d.label = 'Start'
      d.events.push('The job starts.')
    }
  }
  const t = at(today)
  if (t) t.label = t.label ? `Today · ${t.label}` : 'Today'
  for (const w of weeks) for (const d of w) if (d.came.length > 0 && !d.events.some((e) => e.includes('signed') || e.includes('came in'))) d.events.push(`In: ${d.came.join(', ')}.`)
  const summary: StageCalendar['summary'] = start
    ? [{ label: workingDaysLeft(today, start) === 1 ? 'working day to the start' : 'working days to the start', value: String(workingDaysLeft(today, start)), ...(workingDaysLeft(today, start) <= 5 ? { tone: 'bad' as const } : {}) }]
    : [{ label: 'No start date yet', value: '', tone: 'bad' }]
  if (project.ownerContractSignedOn && project.ownerContractSignedOn < from) summary.push({ label: 'contract signed', value: shortDate(project.ownerContractSignedOn) })
  return { mode: 'days', weeks, squares: [], summary, ...(start ? {} : { openEnd: 'No start date' }) }
}

function buildingCalendar(state: GcState, project: GcProject, startOn: string, endOn: string | null): StageCalendar {
  const today = state.today
  const rows = milestoneRows(state, project)
  const lastOn = endOn ?? addDay(today, 28)
  const squares: CalendarWeek[] = []
  const thisMonday = mondayOfDay(today)
  for (let monday = mondayOfDay(startOn); monday <= lastOn; monday = addDay(monday, 7)) {
    squares.push({
      start: monday,
      month: new Date(`${monday}T12:00:00Z`).getUTCMonth(),
      past: monday < thisMonday,
      current: monday === thisMonday,
      inStage: true,
      marks: [],
      events: [],
    })
  }
  const week = (on: string) => squares.find((w) => w.start === mondayOfDay(on))
  const nextDue = rows.filter((r) => r.state === 'due').sort((a, b) => (a.due < b.due ? -1 : 1))[0]
  for (const r of rows) {
    const isFinish = /substantial/i.test(r.milestone.label)
    const w = week(r.milestone.metOn ?? r.due)
    if (!w) continue
    const late = r.state === 'late' || r.state === 'missed'
    const kind: CalendarWeek['kind'] = isFinish ? 'end' : late ? 'late' : r.milestone.metOn ? 'met' : r === nextDue ? 'next' : undefined
    if (kind && (!w.kind || kind === 'end' || kind === 'late')) w.kind = kind
    if (r.milestone.metOn) w.marks.push(late ? 'bad' : 'good')
    w.events.push(
      r.milestone.metOn
        ? `${r.milestone.label} met ${shortDate(r.milestone.metOn)}${late ? `, ${r.daysLate} days late` : ''}.`
        : late
          ? `${r.milestone.label} was due ${shortDate(r.due)}, ${r.daysLate} days late.`
          : `${r.milestone.label} due ${shortDate(r.due)}.`,
    )
  }
  for (const f of openInspectionFailures(project)) {
    const w = week(f.failure.on)
    if (!w) continue
    w.marks.push('bad')
    w.events.push(`The ${f.label.toLowerCase()} failed ${shortDate(f.failure.on)}. Re-inspection ${shortDate(f.failure.reinspectOn)}.`)
  }
  const sum = scheduleSummary(project, today)
  const weeksLeft = endOn ? Math.max(0, Math.ceil(daysBetween(today, endOn) / 7)) : null
  const summary: StageCalendar['summary'] = [
    ...(weeksLeft !== null ? [{ label: weeksLeft === 1 ? 'week to the finish' : 'weeks to the finish', value: String(weeksLeft) }] : []),
    ...(sum && sum.milestones.of > 0 ? [{ label: `of ${sum.milestones.of} milestones on time`, value: String(sum.milestones.hit), ...(sum.milestones.hit < sum.milestones.of ? { tone: 'warn' as const } : { tone: 'good' as const }) }] : []),
  ]
  return { mode: 'weeks', weeks: [], squares, summary }
}
