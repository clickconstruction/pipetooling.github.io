/**
 * The dial (link PR 5): "Exploit before you elevate". One slider for the
 * pressed stage's pace, in dollars a week. Moving it re-reads the whole flow
 * (`applyDial` → `buildStageFlow`), so the cards above move with it, and
 * writes three readings — the pile, the link, the money — plus the marks on
 * the track (today, the pile stops growing, where the link moves, where
 * exploiting ends and elevating begins) and the pile over the next twelve
 * weeks. Pure.
 */
import { STAGE_META, STAGE_ORDER, buildStageFlow, stageUsd, type StageFlow, type StageFlowInput, type StageId } from './stageFlow'

/** Past this many times today's pace the dial reads as elevating, not exploiting. */
export const DIAL_ELEVATE_AT = 1.5
export const DIAL_WEEKS_AHEAD = 12

export type DialWords = { label: string; outWho: string; inWho: string | null; exploit: string; elevate: string; unitWord: string }

export const DIAL_WORDS: Record<StageId, DialWords> = {
  market: { label: 'asked a week', outWho: 'asks come in at', inWho: null, exploit: 'the GCs who invite us', elevate: 'ads and new GCs', unitWord: 'asks' },
  sales: { label: 'sold a week', outWho: 'sales sells', inWho: null, exploit: 'the follow-up we do now', elevate: 'more bids out', unitWord: 'jobs' },
  build: { label: 'built a week', outWho: 'the field builds', inWho: 'sales sells', exploit: 'the crews we have', elevate: 'another crew', unitWord: 'field hours' },
  bill: { label: 'billed a week', outWho: 'the office bills', inWho: 'the field finishes', exploit: 'the biller we have', elevate: 'a second biller', unitWord: 'jobs' },
  collect: { label: 'collected a week', outWho: 'customers pay', inWho: 'the office bills', exploit: 'the calls we make now', elevate: 'the Lien desk and a collections push', unitWord: 'invoices' },
}

export type DialSpec = {
  stage: StageId
  todayUsd: number
  minUsd: number
  maxUsd: number
  stepUsd: number
  /** Dollars per unit (a job, an invoice, a field hour, an ask); null when the page has no count. */
  perUnitUsd: number | null
  elevateAtUsd: number
}

/** Today's pace for a stage, in dollars a week; null when the stage does not read. */
export function todayPace(input: StageFlowInput, stage: StageId): number | null {
  if (stage === 'bill') return input.bill ? input.bill.outPerWeekUsd : null
  if (stage === 'collect') return input.collect ? input.collect.outPerWeekUsd : null
  if (stage === 'build') return input.build ? input.build.outPerWeekUsd : null
  if (stage === 'sales') return input.sales?.soldPerWeekUsd ?? null
  const m = input.market
  return m ? (m.bidsInvitedUsd + m.estimatesRequestedUsd) / Math.max(1, m.weeks) : null
}

export function dialSpec(input: StageFlowInput, stage: StageId, units: { perUnitUsd: number | null }): DialSpec | null {
  const today = todayPace(input, stage)
  if (today == null || !(today > 0)) return null
  const step = today >= 100_000 ? 5000 : 1000
  const round = (v: number) => Math.max(step, Math.round(v / step) * step)
  return { stage, todayUsd: today, minUsd: round(today * 0.25), maxUsd: round(today * 3), stepUsd: step, perUnitUsd: units.perUnitUsd, elevateAtUsd: today * DIAL_ELEVATE_AT }
}

/** The flow with the stage's pace set to `usd` a week; the stage it feeds takes it as its in-rate. */
export function applyDial(input: StageFlowInput, stage: StageId, usd: number): StageFlowInput {
  const out = { ...input }
  if (stage === 'bill' && input.bill) {
    out.bill = { ...input.bill, outPerWeekUsd: usd }
    if (input.collect) out.collect = { ...input.collect, inPerWeekUsd: usd }
  } else if (stage === 'collect' && input.collect) {
    out.collect = { ...input.collect, outPerWeekUsd: usd }
  } else if (stage === 'build' && input.build) {
    out.build = { ...input.build, outPerWeekUsd: usd }
    out.fieldPerWeekUsd = usd
    if (input.bill) out.bill = { ...input.bill, inPerWeekUsd: usd }
  } else if (stage === 'sales' && input.sales) {
    out.sales = { ...input.sales, soldPerWeekUsd: usd }
    if (input.build) out.build = { ...input.build, inPerWeekUsd: usd }
  } else if (stage === 'market' && input.market) {
    const m = input.market
    const today = (m.bidsInvitedUsd + m.estimatesRequestedUsd) / Math.max(1, m.weeks)
    const k = today > 0 ? usd / today : 1
    out.market = { ...m, bidsInvitedUsd: m.bidsInvitedUsd * k, estimatesRequestedUsd: m.estimatesRequestedUsd * k }
  }
  return out
}

export type DialMark = { usd: number; label: string }
export type DialLine = { head: 'the pile' | 'the link' | 'the money'; text: string; tone: 'red' | 'amber' | 'green' | 'grey' }

export type DialReading = {
  spec: DialSpec
  usd: number
  valueText: string
  unitText: string
  zone: { exploitShare: number; left: string; right: string }
  marks: DialMark[]
  /** The pile over the next twelve weeks at the chosen pace and at today's; feeders show Build's pile. */
  spark: { pileWord: string; newSeries: number[]; oldSeries: number[]; endText: string; tone: 'red' | 'amber' | 'green' }
  lines: DialLine[]
  /** The flow re-read at the chosen pace, for the cards. */
  flow: StageFlow
}

const isFeeder = (s: StageId): boolean => s === 'market' || s === 'sales'

function pileAndIn(input: StageFlowInput, stage: StageId): { pileUsd: number; inUsd: number; outUsd: number } | null {
  if (stage === 'bill' && input.bill) return { pileUsd: input.bill.pileUsd, inUsd: input.bill.inPerWeekUsd, outUsd: input.bill.outPerWeekUsd }
  if (stage === 'collect' && input.collect) return { pileUsd: input.collect.pileUsd, inUsd: input.collect.inPerWeekUsd, outUsd: input.collect.outPerWeekUsd }
  if (stage === 'build' && input.build) return { pileUsd: input.build.pileUsd, inUsd: input.build.inPerWeekUsd, outUsd: input.build.outPerWeekUsd }
  return null
}

const series = (pile: number, slopePerWeek: number): number[] => Array.from({ length: DIAL_WEEKS_AHEAD + 1 }, (_, t) => Math.max(0, pile + slopePerWeek * t))

export function buildDialReading(input: StageFlowInput, stage: StageId, usd: number, opts: { spec: DialSpec; todayYmd: string; dayLabel: (ymd: string) => string; fieldHoursPerWeek: number | null }): DialReading {
  const { spec } = opts
  const words = DIAL_WORDS[stage]
  const base = buildStageFlow(input)
  const adjusted = applyDial(input, stage, usd)
  const flow = buildStageFlow(adjusted)
  const dateAfterWeeks = (w: number): string => opts.dayLabel(new Date(Date.parse(`${opts.todayYmd}T00:00:00Z`) + Math.round(w * 7) * 86_400_000).toISOString().slice(0, 10))
  const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)
  const name = STAGE_META[stage].name

  // Units and zones.
  const units = spec.perUnitUsd && spec.perUnitUsd > 0 ? usd / spec.perUnitUsd : null
  const unitText = units == null ? '' : stage === 'build' ? `about ${Math.round(units)} ${words.unitWord} a week` : `about ${units >= 10 ? Math.round(units) : units.toFixed(1)} ${words.unitWord} a week`
  const exploitShare = Math.max(0, Math.min(1, (spec.elevateAtUsd - spec.minUsd) / (spec.maxUsd - spec.minUsd)))
  const zone = { exploitShare, left: `exploit · with ${words.exploit}`, right: `elevate · ${words.elevate}` }

  // Marks.
  const marks: DialMark[] = [{ usd: spec.todayUsd, label: 'today' }]
  const pile = pileAndIn(adjusted, stage)
  if (pile) {
    marks.push({ usd: pile.inUsd, label: 'the pile stops growing' })
    const others = flow.stages.filter((s) => s.id !== stage && s.readable && s.weeks != null)
    const othersMax = others.length ? Math.max(...others.map((s) => s.weeks as number)) : 0
    const other = others.find((s) => s.weeks === othersMax)
    if (other && othersMax > 0) {
      const cross = pile.pileUsd / othersMax
      marks.push({ usd: cross, label: base.linkId === stage ? `above here ${other.name} is the link` : `below here ${name} is the link` })
    }
    marks.push({ usd: spec.elevateAtUsd, label: `${words.elevate} from here` })
  } else if (input.fieldPerWeekUsd != null) {
    marks.push({ usd: input.fieldPerWeekUsd, label: 'the field’s pace' })
  }

  // The pile over twelve weeks.
  const fieldPace = input.fieldPerWeekUsd
  const buildPile = input.build ? input.build.pileUsd : 0
  const lines: DialLine[] = []
  let spark: DialReading['spark']
  if (pile) {
    const slopeNew = pile.inUsd - usd
    const todayPile = pileAndIn(input, stage) as { pileUsd: number; inUsd: number; outUsd: number }
    const slopeOld = todayPile.inUsd - todayPile.outUsd
    const newSeries = series(pile.pileUsd, slopeNew)
    const oldSeries = series(pile.pileUsd, slopeOld)
    const end = newSeries[DIAL_WEEKS_AHEAD] as number
    spark = { pileWord: 'the pile', newSeries, oldSeries, endText: stageUsd(end), tone: slopeNew > 0 ? 'red' : slopeNew === 0 ? 'amber' : 'green' }
    const net = usd - pile.inUsd
    const inWho = words.inWho ?? 'what comes in'
    if (net < 0) lines.push({ head: 'the pile', text: `${cap(inWho)} ${stageUsd(pile.inUsd)} a week and ${words.outWho} ${stageUsd(usd)}. The pile grows ${stageUsd(-net)} a week and reaches ${stageUsd(end)} in twelve weeks.`, tone: 'amber' })
    else if (net === 0) lines.push({ head: 'the pile', text: `${cap(words.outWho)} what ${inWho.replace(/^the /, 'the ')}: ${stageUsd(usd)} a week each way. The pile stays at ${stageUsd(pile.pileUsd)}.`, tone: 'amber' })
    else lines.push({ head: 'the pile', text: `${cap(inWho)} ${stageUsd(pile.inUsd)} a week and ${words.outWho} ${stageUsd(usd)}. The pile shrinks ${stageUsd(net)} a week and is gone by ${dateAfterWeeks(pile.pileUsd / net)}.`, tone: 'green' })
  } else {
    const fed = usd
    const slopeNew = fieldPace != null ? fed - fieldPace : 0
    const soldToday = spec.todayUsd
    const slopeOld = fieldPace != null ? soldToday - fieldPace : 0
    const newSeries = series(buildPile, slopeNew)
    const oldSeries = series(buildPile, slopeOld)
    const end = newSeries[DIAL_WEEKS_AHEAD] as number
    spark = { pileWord: 'Build’s pile', newSeries, oldSeries, endText: stageUsd(end), tone: slopeNew > 0 ? 'red' : slopeNew === 0 ? 'amber' : 'green' }
    if (fieldPace == null) lines.push({ head: 'the pile', text: 'The field’s pace is not readable yet, so the pile cannot be read against it.', tone: 'grey' })
    else if (stage === 'market') lines.push({ head: 'the pile', text: `${stageUsd(usd)} a week of asks against the ${stageUsd(fieldPace)} the field builds. Demand is ${usd >= fieldPace ? 'not' : ''} short of the field.`.replace('is  short', 'is short'), tone: usd >= fieldPace ? 'green' : 'red' })
    else if (fed > fieldPace) lines.push({ head: 'the pile', text: `The field gets ${stageUsd(fed)} a week of work and builds ${stageUsd(fieldPace)}. Build’s pile grows ${stageUsd(fed - fieldPace)} a week.`, tone: 'amber' })
    else if (fed === fieldPace) lines.push({ head: 'the pile', text: `The field gets ${stageUsd(fed)} a week of work, its pace exactly. Build’s pile holds at ${stageUsd(buildPile)}.`, tone: 'amber' })
    else lines.push({ head: 'the pile', text: `The field gets ${stageUsd(fed)} a week of work and builds ${stageUsd(fieldPace)}. It runs out of work by ${dateAfterWeeks(buildPile / (fieldPace - fed))}.`, tone: 'red' })
  }

  // The link.
  const linkName = flow.linkId ? STAGE_META[flow.linkId].name : null
  const myWeeks = flow.stages.find((s) => s.id === stage)?.weeks ?? null
  const linkWeeks = flow.linkId ? (flow.stages.find((s) => s.id === flow.linkId)?.weeks ?? null) : null
  const second = flow.linkId ? flow.stages.filter((s) => s.id !== flow.linkId && s.weeks != null).sort((a, b) => (b.weeks as number) - (a.weeks as number))[0] : undefined
  if (!linkName || linkWeeks == null) lines.push({ head: 'the link', text: 'No stage reads a pile yet, so nothing is the link.', tone: 'grey' })
  else if (isFeeder(stage)) lines.push({ head: 'the link', text: fieldPace != null && usd < fieldPace && stage === 'sales' ? `${linkName} is the weakest link until the field runs out of work. Then ${name} is.` : `${linkName} stays the weakest link. Selling more adds to the piles and does not move it.`, tone: 'grey' })
  else if (flow.linkId === stage) lines.push({ head: 'the link', text: `${name} is the weakest link: ${(myWeeks as number).toFixed(1)} weeks ${clearWords(stage)}.${second ? ` ${second.name} is next, ${(second.weeks as number).toFixed(1)} weeks.` : ''}`, tone: 'red' })
  else if (base.linkId === stage) lines.push({ head: 'the link', text: `${linkName} becomes the weakest link: ${linkWeeks.toFixed(1)} weeks ${clearWords(flow.linkId as StageId)}. ${name} is down to ${myWeeks == null ? '—' : myWeeks.toFixed(1)} weeks.`, tone: 'green' })
  else lines.push({ head: 'the link', text: `${linkName} stays the weakest link, ${linkWeeks.toFixed(1)} weeks. ${name} is at ${myWeeks == null ? '—' : myWeeks.toFixed(1)} weeks.`, tone: 'grey' })

  // The money.
  if (stage === 'bill' && input.bill) {
    const fin = input.bill.inPerWeekUsd
    lines.push({ head: 'the money', text: usd < fin ? `Of the field’s ${stageUsd(fin)} a week, ${stageUsd(usd)} becomes a bill. ${stageUsd(fin - usd)} a week is earned on paper and not billed.` : usd === fin ? `All of the field’s ${stageUsd(fin)} a week becomes a bill the week it is finished.` : `All of the field’s ${stageUsd(fin)} a week becomes a bill, plus ${stageUsd(usd - fin)} a week of the old pile.`, tone: 'grey' })
  } else if (stage === 'collect') {
    const d = usd - spec.todayUsd
    lines.push({ head: 'the money', text: Math.abs(d) < 1 ? `${stageUsd(usd)} a week into the bank, as today.` : `${stageUsd(usd)} a week into the bank, ${stageUsd(Math.abs(d))} ${d > 0 ? 'more' : 'less'} than today.`, tone: 'grey' })
  } else if (stage === 'build' && input.bill) {
    const billOut = input.bill.outPerWeekUsd
    lines.push({ head: 'the money', text: usd <= billOut ? `The field finishes ${stageUsd(usd)} a week and the office can bill ${stageUsd(billOut)}. Nothing new waits unbilled.` : `The field finishes ${stageUsd(usd)} a week for the office to bill. The office bills ${stageUsd(billOut)}, so ${stageUsd(usd - billOut)} a week waits unbilled.`, tone: 'grey' })
  } else if (stage === 'sales') {
    lines.push({ head: 'the money', text: `Each ${stageUsd(10_000)} more sold a week is ${stageUsd(10_000)} more for the field to build and the office to bill.`, tone: 'grey' })
  } else {
    const m = input.market
    const sold = input.sales?.soldPerWeekUsd ?? null
    const asked = m ? (m.bidsInvitedUsd + m.estimatesRequestedUsd) / Math.max(1, m.weeks) : null
    const share = sold != null && asked != null && asked > 0 ? sold / asked : null
    lines.push({ head: 'the money', text: share != null ? `By this window’s record, each ${stageUsd(100_000)} asked a week became about ${stageUsd(100_000 * share)} a week of work for the field.` : 'What a dollar asked becomes is not readable until Sales and Build read.', tone: 'grey' })
  }

  const valueText = `${stageUsd(usd)}/wk`
  return { spec, usd, valueText, unitText, zone, marks: marks.filter((mk) => mk.usd >= spec.minUsd && mk.usd <= spec.maxUsd), spark, lines, flow }
}

function clearWords(stage: StageId): string {
  if (stage === 'bill') return 'to bill what is already finished'
  if (stage === 'collect') return 'to collect what is already billed'
  if (stage === 'build') return 'to build what is already sold'
  return 'to clear'
}

export const DIAL_STAGES: ReadonlyArray<StageId> = STAGE_ORDER
