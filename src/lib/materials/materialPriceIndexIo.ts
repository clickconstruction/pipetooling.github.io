/**
 * The reads behind What your materials cost (v2.4391): a year of takeoff lines priced from the
 * book, folded into the basket, and the whole price history. The math is
 * `materialPriceIndex.ts`.
 *
 * Left out of the basket: robot-researched parts (`material_parts.is_robot`), prices filed under
 * the robots' web research house, and lines on a robot's own bids. A line whose bid is hidden
 * from the reader still counts toward the spend, but never as an open bid.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRobotBid } from '../bidBoardScope'
import { roughCountMultiplier } from '../bids/bidTakeoffHelpers'
import { fetchAllRows } from '../supabasePaging'
import { calendarYmdInAppTzFromIso, startOfYmdInAppTzMs, ymdAddDays } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { BasketPair, PriceEvent } from './materialPriceIndex'

/** The supply house robot-researched web prices are filed under (seeded by `20260830210000_robot_price_research.sql`). */
export const ROBOT_RESEARCH_HOUSE_NAME = '🤖 Web Research'

/** How far back the takeoff lines that weight the basket reach. */
export const BASKET_DAYS = 365

type LineRow = {
  id: string
  quantity: number | string | null
  unit_price: number | string | null
  bid_id: string
  row: { n: number | string | null } | null
  bid: { outcome: string | null; adopted_into_bid_id: string | null; estimator_id: string | null; created_by: string | null } | null
  price: {
    part_id: string
    supply_house_id: string
    price: number | string
    updated_at: string | null
    part: { name: string | null; service_type_id: string | null; is_robot: boolean | null } | null
    house: { name: string | null } | null
  } | null
}

type HistoryRow = {
  id: string
  part_id: string | null
  supply_house_id: string | null
  old_price: number | string | null
  new_price: number | string | null
  changed_at: string
}

export const BASKET_LINE_SELECT =
  'id, quantity, unit_price, bid_id, row:bids_count_rows(n:count), bid:bids(outcome, adopted_into_bid_id, estimator_id, created_by), price:material_part_prices(part_id, supply_house_id, price, updated_at, part:material_parts(name, service_type_id, is_robot), house:supply_houses(name))'

/** The twins' user ids, to leave a robot's bids out; empty when the reader may not see them. */
async function loadTwinUserIds(db: SupabaseClient): Promise<ReadonlySet<string>> {
  try {
    const { data, error } = await db.from('users').select('id').eq('is_digital_twin', true)
    if (error) return new Set()
    return new Set(((data as Array<{ id: string }> | null) ?? []).map((r) => r.id))
  } catch {
    return new Set()
  }
}

/** Fold takeoff lines into basket pairs: spend, today's price, names and open bids per part + house. */
export function basketFromLines(rows: ReadonlyArray<LineRow>, opts: { serviceTypeId: string; twinUserIds: ReadonlySet<string> }): BasketPair[] {
  const pairs = new Map<string, BasketPair & { openBids: Set<string> }>()
  for (const line of rows) {
    const price = line.price
    if (!price?.part || price.part.is_robot) continue
    if (price.part.service_type_id !== opts.serviceTypeId) continue
    if ((price.house?.name ?? '') === ROBOT_RESEARCH_HOUSE_NAME) continue
    if (line.bid && isRobotBid(line.bid, opts.twinUserIds)) continue
    const qty = Number(line.quantity)
    const unit = Number(line.unit_price)
    if (!(qty > 0) || !(unit > 0)) continue
    const key = `${price.part_id}|${price.supply_house_id}`
    let pair = pairs.get(key)
    if (!pair) {
      pair = {
        partId: price.part_id,
        houseId: price.supply_house_id,
        partName: price.part.name ?? 'Part',
        houseName: price.house?.name ?? 'Supply house',
        spend: 0,
        price: Number(price.price),
        priceUpdatedDay: price.updated_at ? calendarYmdInAppTzFromIso(price.updated_at) : null,
        openBidCount: 0,
        openBids: new Set(),
      }
      pairs.set(key, pair)
    }
    pair.spend += qty * unit * roughCountMultiplier(line.row?.n)
    if (line.bid && line.bid.outcome == null && line.bid.adopted_into_bid_id == null) pair.openBids.add(line.bid_id)
  }
  return [...pairs.values()].map(({ openBids, ...p }) => ({ ...p, openBidCount: openBids.size }))
}

/** History rows as price events; a row without a part, a house or a new price is skipped. */
export function eventsFromHistory(rows: ReadonlyArray<HistoryRow>): PriceEvent[] {
  const out: PriceEvent[] = []
  for (const r of rows) {
    if (!r.part_id || !r.supply_house_id || r.new_price == null) continue
    out.push({
      partId: r.part_id,
      houseId: r.supply_house_id,
      oldPrice: r.old_price == null ? null : Number(r.old_price),
      newPrice: Number(r.new_price),
      day: calendarYmdInAppTzFromIso(r.changed_at),
      at: r.changed_at,
    })
  }
  return out
}

/** Everything `computeMaterialPriceIndex` needs for one trade. Throws on a failed read. */
export async function loadMaterialPriceIndexInputs(
  db: SupabaseClient,
  args: { serviceTypeId: string; today: string },
): Promise<{ basket: BasketPair[]; events: PriceEvent[] }> {
  const sinceIso = new Date(startOfYmdInAppTzMs(ymdAddDays(args.today, -BASKET_DAYS))).toISOString()
  const [twinUserIds, lines, history] = await Promise.all([
    loadTwinUserIds(db),
    fetchAllRows<LineRow>(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            db
              .from('bids_takeoff_rough_part_lines')
              .select(BASKET_LINE_SELECT)
              .not('source_material_part_price_id', 'is', null)
              .gt('unit_price', 0)
              .gte('created_at', sinceIso)
              .order('id', { ascending: true })
              .range(from, to),
          'load takeoff lines for material prices',
        )) as unknown as LineRow[] | null,
        error: null,
      }),
      'load takeoff lines for material prices',
    ),
    fetchAllRows<HistoryRow>(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            db
              .from('material_part_price_history')
              .select('id, part_id, supply_house_id, old_price, new_price, changed_at')
              .order('changed_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to),
          'load price history',
        )) as HistoryRow[] | null,
        error: null,
      }),
      'load price history',
    ),
  ])
  const basket = basketFromLines(lines, { serviceTypeId: args.serviceTypeId, twinUserIds })
  const inBasket = new Set(basket.map((p) => `${p.partId}|${p.houseId}`))
  const events = eventsFromHistory(history).filter((e) => inBasket.has(`${e.partId}|${e.houseId}`))
  return { basket, events }
}
