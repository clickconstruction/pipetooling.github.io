/**
 * Everything else waits (link PR 7): the four fixes people reach for first,
 * each a press that sets the dial to what the fix would do, so the cards show
 * the reflex fail instead of a sentence saying it would. Cut overhead is the
 * press that moves nothing, which is the point. Also the old list of the
 * other links' levers, kept behind a "?". Pure.
 */
import type { CallLink } from './calls'
import type { DialReading } from './dial'
import { STAGE_META, stageUsd, type StageFlow, type StageFlowInput, type StageId } from './stageFlow'

export type ReflexId = 'plumber' | 'bids' | 'fieldday' | 'overhead'

export type Reflex = {
  id: ReflexId
  label: string
  /** The stage whose dial the press sets; null for a press that moves nothing. */
  stage: StageId | null
  /** The dial value the press sets, dollars a week; null when the stage does not read or the press moves nothing. */
  usd: number | null
  /** How much the press adds to today's pace. */
  addUsd: number
}

export type ReflexInput = {
  stageInput: StageFlowInput
  /** Field hours a week over the window, for what a plumber or a field day finishes. */
  fieldHoursPerWeek: number | null
  fieldPeople: number
}

const PLUMBER_HOURS = 40
const DAY_HOURS = 8

export function buildReflexes(input: ReflexInput): Reflex[] {
  const build = input.stageInput.build
  const perHour = build && input.fieldHoursPerWeek && input.fieldHoursPerWeek > 0 ? build.outPerWeekUsd / input.fieldHoursPerWeek : null
  const buildToday = build ? build.outPerWeekUsd : null
  const plumberAdd = perHour != null ? perHour * PLUMBER_HOURS : buildToday != null ? buildToday * 0.12 : 0
  const dayAdd = perHour != null ? perHour * DAY_HOURS * Math.max(1, input.fieldPeople) : buildToday != null ? buildToday * 0.2 : 0
  const m = input.stageInput.market
  const marketToday = m ? (m.bidsInvitedUsd + m.estimatesRequestedUsd) / Math.max(1, m.weeks) : null
  const bidsAdd = marketToday != null ? marketToday / 3 : 0
  const round = (n: number) => Math.round(n / 1000) * 1000
  return [
    { id: 'plumber', label: 'Hire another plumber', stage: 'build', usd: buildToday != null ? round(buildToday + plumberAdd) : null, addUsd: round(plumberAdd) },
    { id: 'bids', label: 'Push for more bids', stage: 'market', usd: marketToday != null ? round(marketToday + bidsAdd) : null, addUsd: round(bidsAdd) },
    { id: 'fieldday', label: 'Add a field day', stage: 'build', usd: buildToday != null ? round(buildToday + dayAdd) : null, addUsd: round(dayAdd) },
    { id: 'overhead', label: 'Cut overhead 10%', stage: null, usd: null, addUsd: 0 },
  ]
}

export type ReflexLine = { text: string; tone: 'amber' | 'grey' }

/** What the press did, read from the flow before and the dial's reading after. */
export function reflexLine(input: { reflex: Reflex; before: StageFlow; reading: DialReading | null; stageInput: StageFlowInput; overheadPerDayUsd: number; billPerJobUsd: number | null }): ReflexLine {
  const { reflex, before, reading } = input
  const linkWord = (after: StageFlow | null): string => {
    if (!after || !after.linkId || after.linkId === before.linkId) return 'The link did not move.'
    return `${STAGE_META[after.linkId].name} becomes the link.`
  }
  if (reflex.id === 'overhead') {
    const perWeek = input.overheadPerDayUsd * 7 * 0.1
    return { text: `Cut overhead 10%: ${stageUsd(input.overheadPerDayUsd * 0.1)} a day, ${stageUsd(perWeek)} a week. Nothing above moved.${input.billPerJobUsd ? ` One finished job billed is about ${stageUsd(input.billPerJobUsd)}.` : ''}`, tone: 'grey' }
  }
  if (!reading || reflex.usd == null) return { text: `${reflex.label}: the stage this would move does not read yet.`, tone: 'grey' }
  const bill = input.stageInput.bill
  if (reflex.stage === 'build' && bill) {
    const billOut = bill.outPerWeekUsd
    const buildToday = input.stageInput.build ? input.stageInput.build.outPerWeekUsd : 0
    const waitsNow = Math.max(0, reflex.usd - billOut)
    const waitsToday = Math.max(0, buildToday - billOut)
    return { text: `${reflex.label}: the field finishes ${stageUsd(reflex.usd)} a week, ${stageUsd(reflex.addUsd)} more. The office still bills ${stageUsd(billOut)}, so ${stageUsd(waitsNow)} a week waits unbilled instead of ${stageUsd(waitsToday)}. ${linkWord(reading.flow)}`, tone: 'amber' }
  }
  if (reflex.stage === 'market') {
    const field = input.stageInput.fieldPerWeekUsd
    return { text: `${reflex.label}: ${stageUsd(reflex.addUsd)} more asked a week.${field != null ? ` The field still builds ${stageUsd(field)}. More sold only adds to the piles.` : ''} ${linkWord(reading.flow)}`, tone: 'amber' }
  }
  return { text: `${reflex.label}: ${linkWord(reading.flow)}`, tone: 'grey' }
}

/** The old list: each link's lever in a few words, shown behind the card's "?". */
export const LINK_LEVERS: Record<CallLink, string> = {
  market: 'more bids out, referrals',
  sales: 'follow up the bids out',
  build: 'a field day, hiring',
  bill: 'bill and collect',
  collect: 'chase, lien',
  decision: 'clear the piles',
  capital: 'bridge the gap',
  talent: 'hire, train',
}

export const LINK_LEVER_NAMES: Record<CallLink, string> = { market: 'Market', sales: 'Sales', build: 'Build', bill: 'Bill', collect: 'Collect', decision: 'Decision', capital: 'Capital', talent: 'Talent' }

export function otherLevers(litLink: CallLink | null): Array<{ id: CallLink; name: string; lever: string }> {
  return (Object.keys(LINK_LEVERS) as CallLink[]).filter((id) => id !== litLink).map((id) => ({ id, name: LINK_LEVER_NAMES[id], lever: LINK_LEVERS[id] }))
}
