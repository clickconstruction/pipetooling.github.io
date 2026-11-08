// Wheels' fuel by person (punch list #52 follow-up, v2.6671): read from People → Spending's kernel
// over the same window, so the three screens agree on whose fuel a charge is. Spending's rule
// (`spendingWhoForCharge`): the charge's attribution, else Company cards on a company card, else
// the card's holder, else nobody. Before this Wheels added fuel by attribution alone, so a held
// card's fuel with no attribution sat in the "no person on it" list by card while Spending and
// Review's fuel on no job gave it to the holder. Pure.

import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { categoryTagForCharge, type CategoryTagLookups } from '../banking/categoryTags'
import { cardChargeAllocationCounts, cardChargeCostUsd } from '../jobs/cardChargeAllocationFilter'
import { buildSpendingRollup, cardChargeExclusionsFromRows, spendingWhoForCharge, type SpendingDirectory } from './spendingRollup'

/** Fuel on one card: the nickname when the office gave it one, else the card's last four. */
export type WheelsCardGroup = { cardId: string | null; label: string; usd: number; n: number }

export type WheelsFuel = {
  /** users.id → the person's fuel in the window: attributed to them, else on a card they hold. A refund comes off. */
  fuelByUser: Map<string, number>
  /** Fuel that reaches no login: nobody attributed and no holder, or a person record with no login. By card, biggest first. */
  unattributedUsd: number
  unattributedCards: WheelsCardGroup[]
  /** Fuel-tag charges Spending gives to Company cards (no attribution, a company card): management tools, not anyone's fuel. By card. */
  companyCardSpend: { usd: number; n: number; byCard: WheelsCardGroup[] }
}

const EMPTY_DIRECTORY: SpendingDirectory = { userNameById: new Map(), personById: new Map() }

export function emptyWheelsFuel(): WheelsFuel {
  return { fuelByUser: new Map(), unattributedUsd: 0, unattributedCards: [], companyCardSpend: { usd: 0, n: 0, byCard: [] } }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function wheelsCardLabel(cardId: string | null, nickname: string | null): string {
  if (!cardId) return 'no card'
  return nickname?.trim() || `card …${cardId.replace(/-/g, '').slice(-4)}`
}

function addToGroup(groups: Map<string, WheelsCardGroup>, c: CardChargeWindowRow, cost: number): void {
  const key = c.debitCardId ?? '(no card)'
  const g = groups.get(key) ?? { cardId: c.debitCardId, label: wheelsCardLabel(c.debitCardId, c.cardNickname), usd: 0, n: 0 }
  g.usd += cost
  g.n += 1
  groups.set(key, g)
}

function finishGroups(groups: Map<string, WheelsCardGroup>): WheelsCardGroup[] {
  return [...groups.values()].map((g) => ({ ...g, usd: round2(g.usd) })).sort((a, b) => b.usd - a.usd || a.label.localeCompare(b.label))
}

/**
 * The window's card charges → each login's fuel by Spending's rule, and the fuel that reaches
 * no login or a company card, by card. `fuelByUser` is read straight off `buildSpendingRollup`'s
 * rows (their ⛽ column); the by-card lists walk the same charges with the same classifier
 * (`categoryTagForCharge`), the same card rule (an Internal Transfer is not spend) and the same
 * owner (`spendingWhoForCharge`). With no fuel tag everything is empty.
 */
export function wheelsFuelFromSpending(args: {
  charges: readonly CardChargeWindowRow[]
  lookups: CategoryTagLookups
  fuelTagId: string | null
  directory?: SpendingDirectory
}): WheelsFuel {
  if (!args.fuelTagId) return emptyWheelsFuel()
  const directory = args.directory ?? EMPTY_DIRECTORY
  const rollup = buildSpendingRollup({
    charges: args.charges,
    lookups: args.lookups,
    fuelTagId: args.fuelTagId,
    officeJobId: null,
    sortingFloorYmd: null,
    directory,
  })
  const fuelByUser = new Map<string, number>()
  for (const r of rollup.rows) {
    if (r.who.userId && Math.abs(r.fuel) >= 0.005) fuelByUser.set(r.who.userId, r.fuel)
  }

  const exclusions = cardChargeExclusionsFromRows(args.charges)
  const unattributed = new Map<string, WheelsCardGroup>()
  const company = new Map<string, WheelsCardGroup>()
  let unattributedUsd = 0
  let companyUsd = 0
  let companyN = 0
  for (const c of args.charges) {
    if (!cardChargeAllocationCounts({ mercury_transaction_id: c.id, amount: c.amount }, exclusions)) continue
    if (categoryTagForCharge(args.lookups, c.labelId, c.bankCategory)?.id !== args.fuelTagId) continue
    const { who } = spendingWhoForCharge(c, directory)
    if (who.userId) continue
    const cost = cardChargeCostUsd(c.amount)
    if (who.kind === 'company') {
      companyUsd += cost
      companyN += 1
      addToGroup(company, c, cost)
    } else {
      unattributedUsd += cost
      addToGroup(unattributed, c, cost)
    }
  }
  return {
    fuelByUser,
    unattributedUsd: round2(unattributedUsd),
    unattributedCards: finishGroups(unattributed),
    companyCardSpend: { usd: round2(companyUsd), n: companyN, byCard: finishGroups(company) },
  }
}
