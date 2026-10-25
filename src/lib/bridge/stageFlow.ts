/**
 * The weakest link (the Bridge, link PR 1): the company as five stages in flow
 * order — Market → Sales → Build → Bill → Collect — each read as what comes in,
 * what goes out, and the pile waiting in front of it. One rule lights a stage:
 * the most weeks to clear what is already waiting, at today's pace. Market and
 * Sales feed the field, so they read by pace against it, not by weeks of pile
 * (their readings arrive in a later PR; until then they say so). Pure: no
 * React, no Supabase.
 *
 * A recorded call holds the link for its week (`heldLinkId`): another stage
 * takes it only by a clear margin, so a $1k wobble in billing does not move
 * the red on a Tuesday. Two stages within a tenth of each other read as a
 * pair ("the weakest link, with Build").
 */

export type StageId = 'market' | 'sales' | 'build' | 'bill' | 'collect'

export const STAGE_ORDER: ReadonlyArray<StageId> = ['market', 'sales', 'build', 'bill', 'collect']

/** A stage takes the link from a held call only when it reads this much longer. */
export const STAGE_HOLD_MARGIN = 1.15
/** Two stages within this share of each other read as a pair. */
export const STAGE_PAIR_MARGIN = 0.9
/** When more than this share of a stage's pile is a guess (Build, and Bill since v2.5834), it takes the link only by the hold margin. */
export const BUILD_GUESS_GATE = 1 / 3
/** The two readings of the field's pace agree when they are within this share of each other; then only one shows. */
export const PACE_AGREE_MARGIN = 0.05

export const STAGE_META: Record<StageId, { name: string; object: string; action: string; kind: string }> = {
  market: { name: 'Market', object: 'demand', action: 'bring in more asks', kind: 'not enough demand' },
  sales: { name: 'Sales', object: 'leads', action: 'win more of the asks', kind: 'leads that do not convert' },
  build: { name: 'Build', object: 'the work sold', action: 'finish more each week', kind: 'cannot do the work sold' },
  bill: { name: 'Bill', object: 'the work done', action: 'bill the day it finishes', kind: 'cannot bill the work done' },
  collect: { name: 'Collect', object: 'the work billed', action: 'collect by the due day', kind: 'cannot collect the work billed' },
}

export type PileStageInput = {
  /** What waits in front of the stage today, in dollars. */
  pileUsd: number
  /** Rows in the pile when there is a count worth showing (jobs, invoices); null otherwise. */
  pileCount: number | null
  /** Dollars a week flowing into the stage over the window. */
  inPerWeekUsd: number
  /** Dollars a week the stage turns over the window. */
  outPerWeekUsd: number
}

export type BuildStageInput = PileStageInput & {
  /** Open jobs whose percent the app can read. */
  knownJobs: number
  /** Contract on open jobs with no percent, read as half done; drawn grey. */
  guessUsd: number
  guessJobs: number
  /**
   * The field's pace read two ways: by the percents (`buildPace.ts`) and by the hours, the dollars the
   * field earned on recorded time. `outPerWeekUsd` is the larger (`withFieldPaces`); the card names the other.
   */
  paces?: { byPercentUsd: number; byHoursUsd: number }
}

/**
 * Feed Build the honest pace: the larger of built-by-percent and earned-by-hours. The percents are thin
 * on most open jobs, so by-percent reads low and would nominate Build on sparsity; the hours do not lie
 * about how much the field finished.
 */
export function withFieldPaces(build: BuildStageInput, byHoursUsd: number | null): BuildStageInput {
  if (byHoursUsd == null || !(byHoursUsd > 0)) return build
  const byPercentUsd = build.outPerWeekUsd
  return { ...build, outPerWeekUsd: Math.max(byPercentUsd, byHoursUsd), paces: { byPercentUsd, byHoursUsd } }
}

/** Bill (v2.5834): the known pile is finished work less what is billed; the guess is the working jobs with no percent, read as half done and drawn grey. */
export type BillStageInput = PileStageInput & { guessUsd?: number; guessJobs?: number }

export type CollectStageInput = PileStageInput & { lateCount: number }

/** Market (link PR 4): the asks that came in over the window, by value. */
export type MarketStageInput = {
  bidsInvited: number
  bidsInvitedUsd: number
  estimatesRequested: number
  estimatesRequestedUsd: number
  weeks: number
}

/** Sales (link PR 4): what went out and what came back, bids and estimates apart. */
export type SalesStageInput = {
  bids: { sentUsd: number; wonUsd: number; startedUsd: number; lostUsd: number }
  estimates: { sentUsd: number; wonUsd: number; lostUsd: number }
  awaiting: { bids: number; bidsUsd: number; estimates: number; estimatesUsd: number }
  /** Dollars a week sold to the field, by the contract on jobs created; null until Build reads. */
  soldPerWeekUsd: number | null
}

export type StageFlowInput = {
  market: MarketStageInput | null
  sales: SalesStageInput | null
  bill: BillStageInput | null
  collect: CollectStageInput | null
  build: BuildStageInput | null
  /** Dollars a week the field builds, the pace the feeders read against; null until Build reads. */
  fieldPerWeekUsd: number | null
  /** The link a recorded call holds this week, if any. */
  heldLinkId: StageId | null
}

export type StageTone = 'link' | 'pair' | 'plain' | 'muted' | 'green'

export type StageReading = {
  id: StageId
  name: string
  object: string
  action: string
  readable: boolean
  pile: {
    /** "$233k finished, not yet billed" */
    headline: string
    sub: string[]
    usd: number | null
    /** Share of the pile the app can only guess at, 0–1; drawn grey. */
    guessShare: number
  }
  /** Two lines, each with a subject: "the field finishes" · "$34k" · "a week" (the tail defaults to "a week"). */
  flow: Array<{ who: string; usd: string; tail?: string }>
  /** Sales only: SENT / WON / LOST for bids and estimates. */
  table?: { head: [string, string, string]; rows: Array<{ label: string; cells: [string, string, string]; note?: string }> }
  weeks: number | null
  /** "10.6 weeks to bill what is already finished"; for a feeder, its pace line. */
  weeksText: string
  /** A feeder's second pace line: "the field builds $35k a week". */
  weeksText2?: string
  badge: string
  tone: StageTone
  isLink: boolean
}

export type StageFlow = {
  stages: StageReading[]
  /** The stage lit as the link, after the held call is honoured. Null when nothing reads. */
  linkId: StageId | null
  /** The stage the numbers alone would light. */
  nominatedId: StageId | null
  /** The held call stands although another stage reads longer. */
  heldStands: boolean
  /** The stage within a tenth of the link, read as its pair. */
  pairId: StageId | null
}

export function stageUsd(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 100_000) return `${sign}$${Math.round(a / 1000)}k`
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${sign}$${Math.round(a)}`
}

const perWeek = (usd: number): string => stageUsd(usd)

/** Weeks to clear the pile at the stage's own pace; null when the stage turns nothing. */
export function weeksToClear(pileUsd: number, outPerWeekUsd: number): number | null {
  if (!(outPerWeekUsd > 0)) return null
  if (!(pileUsd > 0)) return 0
  return pileUsd / outPerWeekUsd
}

const oneDecimal = (w: number): string => (w >= 100 ? `${Math.round(w)}` : w.toFixed(1))

const CLEAR_WORDS: Record<'build' | 'bill' | 'collect', string> = {
  build: 'to build what is already sold',
  bill: 'to bill what is already finished',
  collect: 'to collect what is already billed',
}

function notReadable(id: StageId): StageReading {
  const m = STAGE_META[id]
  return {
    id,
    name: m.name,
    object: m.object,
    action: m.action,
    readable: false,
    pile: { headline: 'not readable yet', sub: ['the app does not count this pile yet'], usd: null, guessShare: 0 },
    flow: [],
    weeks: null,
    weeksText: '',
    badge: 'not readable yet',
    tone: 'muted',
    isLink: false,
  }
}

function pileStage(id: 'build' | 'bill' | 'collect', input: PileStageInput, who: [string, string], pile: { headline: string; sub: string[]; guessShare: number }, weeksText: (w: number | null) => string): StageReading {
  const m = STAGE_META[id]
  const weeks = weeksToClear(input.pileUsd, input.outPerWeekUsd)
  return {
    id,
    name: m.name,
    object: m.object,
    action: m.action,
    readable: true,
    pile: { headline: pile.headline, sub: pile.sub, usd: input.pileUsd, guessShare: pile.guessShare },
    flow: [
      { who: who[0], usd: perWeek(input.inPerWeekUsd) },
      { who: who[1], usd: perWeek(input.outPerWeekUsd) },
    ],
    weeks,
    weeksText: weeksText(weeks),
    badge: '',
    tone: 'plain',
    isLink: false,
  }
}

function feederBadge(perWeekUsd: number | null, fieldPerWeekUsd: number | null, ahead: string, behind: string): { badge: string; tone: StageTone } {
  if (perWeekUsd == null || fieldPerWeekUsd == null) return { badge: 'wait', tone: 'plain' }
  return perWeekUsd >= fieldPerWeekUsd ? { badge: ahead, tone: 'green' } : { badge: behind, tone: 'pair' }
}

export function buildStageFlow(input: StageFlowInput): StageFlow {
  const byId = new Map<StageId, StageReading>()

  if (input.market) {
    const m = input.market
    const asks = m.bidsInvited + m.estimatesRequested
    const perWeek = (m.bidsInvitedUsd + m.estimatesRequestedUsd) / Math.max(1, m.weeks)
    const meta = STAGE_META.market
    const { badge, tone } = feederBadge(perWeek, input.fieldPerWeekUsd, 'not short', 'short of the field')
    byId.set('market', {
      id: 'market',
      name: meta.name,
      object: meta.object,
      action: meta.action,
      readable: true,
      pile: { headline: `${asks} ${asks === 1 ? 'ask' : 'asks'} in ${Math.round(m.weeks)} weeks`, sub: [`${m.bidsInvited} ${m.bidsInvited === 1 ? 'bid' : 'bids'} invited`, `${m.estimatesRequested} ${m.estimatesRequested === 1 ? 'estimate' : 'estimates'} requested`], usd: null, guessShare: 0 },
      flow: [
        { who: 'bids', usd: stageUsd(m.bidsInvitedUsd), tail: 'from GCs' },
        { who: 'estimates', usd: stageUsd(m.estimatesRequestedUsd), tail: 'from customers' },
      ],
      weeks: null,
      weeksText: `about ${stageUsd(perWeek)} a week`,
      badge,
      tone,
      isLink: false,
    })
  } else byId.set('market', notReadable('market'))

  if (input.sales) {
    const sl = input.sales
    const meta = STAGE_META.sales
    const awaitingUsd = sl.awaiting.bidsUsd + sl.awaiting.estimatesUsd
    const { badge, tone } = feederBadge(sl.soldPerWeekUsd, input.fieldPerWeekUsd, 'ahead of the field · wait', 'behind the field')
    byId.set('sales', {
      id: 'sales',
      name: meta.name,
      object: meta.object,
      action: meta.action,
      readable: true,
      pile: { headline: `${stageUsd(awaitingUsd)} awaiting an answer`, sub: [`${sl.awaiting.bids} ${sl.awaiting.bids === 1 ? 'bid' : 'bids'}, ${stageUsd(sl.awaiting.bidsUsd)}`, `${sl.awaiting.estimates} ${sl.awaiting.estimates === 1 ? 'estimate' : 'estimates'}, ${stageUsd(sl.awaiting.estimatesUsd)}`], usd: null, guessShare: 0 },
      flow: [],
      table: {
        head: ['sent', 'won', 'lost'],
        rows: [
          { label: 'bids', cells: [stageUsd(sl.bids.sentUsd), stageUsd(sl.bids.wonUsd + sl.bids.startedUsd), stageUsd(sl.bids.lostUsd)], note: sl.bids.startedUsd > 0 ? `won counts ${stageUsd(sl.bids.startedUsd)} of bids that became jobs` : undefined },
          { label: 'estimates', cells: [stageUsd(sl.estimates.sentUsd), stageUsd(sl.estimates.wonUsd), stageUsd(sl.estimates.lostUsd)] },
        ],
      },
      weeks: null,
      weeksText: sl.soldPerWeekUsd != null ? `sold ${stageUsd(sl.soldPerWeekUsd)} of work a week` : 'sold: not readable until Build reads',
      weeksText2: input.fieldPerWeekUsd != null ? `the field builds ${stageUsd(input.fieldPerWeekUsd)} a week` : undefined,
      badge,
      tone,
      isLink: false,
    })
  } else byId.set('sales', notReadable('sales'))

  if (input.build) {
    const b = input.build
    const total = b.pileUsd + b.guessUsd
    const guessShare = total > 0 ? b.guessUsd / total : 0
    const sub: string[] = []
    if (b.knownJobs > 0) sub.push(`on ${b.knownJobs} ${b.knownJobs === 1 ? 'job that has' : 'jobs that have'} a %`)
    if (b.guessJobs > 0) sub.push(`grey: ${b.guessJobs} ${b.guessJobs === 1 ? 'job has' : 'jobs have'} no %`)
    const reading = pileStage('build', b, ['sales sells', 'the field builds'], { headline: `${stageUsd(b.pileUsd)} left to build`, sub, guessShare }, (w) => {
      if (w == null) return 'no pace to read'
      if (b.guessUsd > 0 && b.outPerWeekUsd > 0) {
        const hi = (b.pileUsd + b.guessUsd / 2) / b.outPerWeekUsd
        return `${Math.round(w)} to ${Math.round(hi)} weeks ${CLEAR_WORDS.build}`
      }
      return `${oneDecimal(w)} weeks ${CLEAR_WORDS.build}`
    })
    // Both readings of the field's pace when they disagree: the larger is the pace, the other is named.
    if (b.paces) {
      const { byPercentUsd, byHoursUsd } = b.paces
      const hoursLead = byHoursUsd >= byPercentUsd
      const other = hoursLead ? byPercentUsd : byHoursUsd
      const agree = Math.abs(byHoursUsd - byPercentUsd) <= Math.max(byHoursUsd, byPercentUsd) * PACE_AGREE_MARGIN
      reading.flow[1] = { who: 'the field builds', usd: perWeek(b.outPerWeekUsd), tail: agree ? 'a week' : hoursLead ? 'a week by hours' : 'a week by the percents' }
      if (!agree) reading.flow.push({ who: hoursLead ? 'by the percents' : 'by hours', usd: perWeek(other), tail: 'a week' })
    }
    byId.set('build', reading)
  } else byId.set('build', notReadable('build'))

  if (input.bill) {
    const b = input.bill
    const guessUsd = b.guessUsd ?? 0
    const guessJobs = b.guessJobs ?? 0
    const total = b.pileUsd + guessUsd
    const guessShare = total > 0 ? guessUsd / total : 0
    const sub: string[] = []
    if (b.pileCount != null && b.pileCount > 0) sub.push(guessJobs > 0 ? `on ${b.pileCount} ${b.pileCount === 1 ? 'job that has' : 'jobs that have'} a %` : `on ${b.pileCount} ${b.pileCount === 1 ? 'job' : 'jobs'}`)
    if (guessJobs > 0) sub.push(`grey: ${guessJobs} ${guessJobs === 1 ? 'job has' : 'jobs have'} no %`)
    byId.set(
      'bill',
      pileStage('bill', b, ['the field finishes', 'the office bills'], { headline: `${stageUsd(b.pileUsd)} finished, not yet billed`, sub, guessShare }, (w) => {
        if (w == null) return 'no pace to read'
        if (guessUsd > 0 && b.outPerWeekUsd > 0) {
          const hi = (b.pileUsd + guessUsd / 2) / b.outPerWeekUsd
          if (Math.round(hi) !== Math.round(w)) return `${Math.round(w)} to ${Math.round(hi)} weeks ${CLEAR_WORDS.bill}`
        }
        return `${oneDecimal(w)} weeks ${CLEAR_WORDS.bill}`
      }),
    )
  } else byId.set('bill', notReadable('bill'))

  if (input.collect) {
    const c = input.collect
    byId.set(
      'collect',
      pileStage('collect', c, ['the office bills', 'customers pay'], { headline: `${stageUsd(c.pileUsd)} billed, not yet paid`, sub: c.lateCount > 0 ? [`${c.lateCount} ${c.lateCount === 1 ? 'invoice' : 'invoices'} late`] : [], guessShare: 0 }, (w) => (w == null ? 'no pace to read' : `${oneDecimal(w)} weeks ${CLEAR_WORDS.collect}`)),
    )
  } else byId.set('collect', notReadable('collect'))

  // The rule: the pile stage with the most weeks to clear. A held call stands unless overtaken by a clear margin.
  const candidates = STAGE_ORDER.map((id) => byId.get(id) as StageReading).filter((s) => s.readable && s.weeks != null)
  const sorted = [...candidates].sort((a, b) => (b.weeks as number) - (a.weeks as number))
  let nominated = sorted[0] ?? null
  // A thin reading does not take the link: with more than a third of its pile a guess (Build, or Bill since v2.5834), a stage leads only by the hold margin.
  let thinBuild: StageReading | null = null
  if (nominated && nominated.pile.guessShare > BUILD_GUESS_GATE && sorted[1] && (nominated.weeks as number) < (sorted[1].weeks as number) * STAGE_HOLD_MARGIN) {
    thinBuild = nominated
    nominated = sorted[1]
  }
  const held = input.heldLinkId ? candidates.find((s) => s.id === input.heldLinkId) ?? null : null
  let link: StageReading | null = nominated
  let heldStands = false
  if (held && nominated && held.id !== nominated.id) {
    if ((nominated.weeks as number) < (held.weeks as number) * STAGE_HOLD_MARGIN) {
      link = held
      heldStands = true
    }
  }
  const second = link ? sorted.find((s) => s.id !== link!.id) ?? null : null
  const pair = link && second && (second.weeks as number) >= (link.weeks as number) * STAGE_PAIR_MARGIN ? second : null

  const stages = STAGE_ORDER.map((id) => {
    const s = byId.get(id) as StageReading
    if (!s.readable || s.weeks == null) return s
    if (link && s.id === link.id) {
      const extra = s.pile.guessShare > 0 ? ' · set the %s' : ''
      return { ...s, isLink: true, tone: 'link' as const, badge: `${pair ? `the weakest link, with ${pair.name}` : 'the weakest link'}${extra}` }
    }
    if (thinBuild && s.id === thinBuild.id && link && s.id !== link.id) {
      return { ...s, tone: 'pair' as const, badge: `reads ${oneDecimal(s.weeks as number)} weeks on a thin % · set the %s` }
    }
    if (link && heldStands && nominated && s.id === nominated.id) {
      return { ...s, tone: 'plain' as const, badge: `reads ${oneDecimal(s.weeks as number)} weeks · the call holds ${link.name}` }
    }
    if (pair && s.id === pair.id) {
      const extra = s.pile.guessShare > 0 ? ' · set the %s' : ''
      return { ...s, tone: 'pair' as const, badge: `a close second${extra}` }
    }
    if (link && STAGE_ORDER.indexOf(s.id) > STAGE_ORDER.indexOf(link.id)) {
      return { ...s, tone: 'plain' as const, badge: `moves with ${link.name}` }
    }
    return { ...s, tone: 'plain' as const, badge: 'wait' }
  })

  return { stages, linkId: link?.id ?? null, nominatedId: nominated?.id ?? null, heldStands, pairId: pair?.id ?? null }
}

/** The one-line rule the page opens on, and the longer reading behind its "?". */
export const STAGE_RULE_LINE = 'Find the slowest step. Everything waits on it. We measure the week by what the field earned, billed and paid.'

export const STAGE_RULE_LONG =
  'A business is only as good as its weakest link. Work piles up in front of that link and starves everything after it. Throughput is what the field earns, billed and collectable. Grow it through the link. Cutting cost everywhere else makes the piles bigger and the week no better.'

export const STAGE_RULE_POINTS: ReadonlyArray<{ head: string; text: string }> = [
  { head: '1 · The goal', text: 'The goal is to make money. Everything else is a means to it.' },
  { head: '2 · The bottleneck’s hour', text: 'An hour lost at the slowest step is lost for the whole company. An hour saved anywhere else is a mirage.' },
  { head: '3 · Busy is not productive', text: 'Keeping everyone busy is not the same as making money. A plant where every resource runs flat out drowns in inventory.' },
  { head: '4 · Balance flow, not capacity', text: 'Put the slowest boy at the front of the hike and lighten his pack. The troop arrives together.' },
  { head: '5 · Beware of inertia', text: 'Once the slowest step moves, yesterday’s rules become today’s constraint. Find the next one.' },
]
