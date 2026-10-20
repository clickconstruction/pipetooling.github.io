/**
 * What to deal with first (link PR 6): tiers, not a leaderboard. The link
 * first; what throttles it with it; the stage that would be the link after it
 * next; what moves when the link moves follows; what is ahead of the field
 * waits. Each row carries the reading that put it there and its first move.
 * Pure.
 */
import type { CallLink } from './calls'
import { LINK_DESK } from './linkDesk'
import type { ResourceReading } from './resources'
import { STAGE_ORDER, type StageFlow, type StageId } from './stageFlow'

export type OrderTier = 'First' | 'With it' | 'Next' | 'Follows' | 'Waits'

export const ORDER_RULE = 'The stage with the most weeks to clear what is already waiting comes first. What throttles it comes with it. The stage that would be the link after it comes next. What moves when the link moves follows. What is ahead of the field waits.'

export const ORDER_TIER_WHY: Record<OrderTier, string> = {
  First: 'the most weeks to clear what is already waiting',
  'With it': 'what throttles the link; clearing it is part of exploiting the link',
  Next: 'the link once the first one moves',
  Follows: 'moves when the link moves; nothing to do here first',
  Waits: 'ahead of the field; more here only adds to the piles',
}

export type OrderRow = {
  rank: number
  id: CallLink
  name: string
  badge: string
  reading: string
  firstMove: string
  tier: OrderTier
  tierWhy: string
  /** The first row of its tier carries the tier head. */
  tierHead: boolean
  pressed: boolean
}

export type Order = { rows: OrderRow[]; pressedLine: string }

export function buildOrder(input: { flow: StageFlow; resources: ResourceReading[]; pressedId: CallLink | null }): Order {
  const { flow, resources } = input
  const byId = new Map<StageId, StageFlow['stages'][number]>(flow.stages.map((s) => [s.id, s]))
  const pileStages = flow.stages.filter((s) => s.readable && s.weeks != null)
  const link = flow.linkId ? byId.get(flow.linkId) ?? null : null
  const sorted = [...pileStages].sort((a, b) => (b.weeks as number) - (a.weeks as number))
  const second = link ? sorted.find((s) => s.id !== link.id) ?? null : null
  const tiers: Array<{ tier: OrderTier; ids: CallLink[] }> = [
    { tier: 'First', ids: link ? [link.id] : [] },
    { tier: 'With it', ids: resources.filter((r) => r.throttles).map((r) => r.id) },
    { tier: 'Next', ids: second ? [second.id] : [] },
    { tier: 'Follows', ids: [...pileStages.filter((s) => s !== link && s !== second).map((s) => s.id as CallLink), ...resources.filter((r) => !r.throttles).map((r) => r.id as CallLink)] },
    { tier: 'Waits', ids: flow.stages.filter((s) => s.readable && s.weeks == null).map((s) => s.id as CallLink) },
  ]
  // A stage the app cannot read yet sits last, in Waits, and says so.
  const unread = STAGE_ORDER.filter((id) => !(byId.get(id)?.readable)).map((id) => id as CallLink)
  tiers[4]!.ids.push(...unread)

  const rows: OrderRow[] = []
  let rank = 0
  for (const t of tiers) {
    t.ids.forEach((id, i) => {
      rank += 1
      const st = (STAGE_ORDER as ReadonlyArray<string>).includes(id) ? byId.get(id as StageId) : undefined
      const rs = resources.find((r) => r.id === id)
      const name = st ? st.name : rs ? rs.name : id
      const badge = st ? st.badge : rs ? rs.badge : ''
      const reading = st ? (st.readable ? [st.weeksText, st.weeksText2].filter(Boolean).join('; ') || st.pile.headline : 'the app does not read this stage yet') : rs ? `${rs.gauge} · ${rs.kind}` : ''
      rows.push({ rank, id, name, badge, reading, firstMove: LINK_DESK[id]?.moves[0]?.title ?? '', tier: t.tier, tierWhy: ORDER_TIER_WHY[t.tier], tierHead: i === 0, pressed: id === input.pressedId })
    })
  }
  const pressed = rows.find((r) => r.pressed)
  const pressedLine = pressed ? `You pressed ${pressed.name}: ${pressed.rank === 1 ? 'first' : pressed.tier.toLowerCase()} · ${pressed.tierWhy}.` : ''
  return { rows, pressedLine }
}
