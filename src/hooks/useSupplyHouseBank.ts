import { useCallback, useEffect, useMemo, useState } from 'react'
import { SUPPLY_BANK_FROM_YMD, supplyBankLines, unclaimedHouseLines, type SupplyBankLine, type UnclaimedHouseLine } from '../lib/materials/payments/supplyPaymentBank'
import type { SupplyBankIo } from '../lib/materials/payments/supplyPaymentBankIo'

/** Bank lines are read from a few days before payments became rows, so a payment typed on the first day still finds its line. */
const READ_FROM_YMD = '2026-11-12'

export type SupplyHouseBank = {
  /** Money out, as lines. Empty while loading, or when this login cannot read the bank. */
  lines: SupplyBankLine[]
  /** The bank line each live payment claims, by payment id. */
  matchedByPayment: ReadonlyMap<string, string>
  /** Every bank line some payment claims. */
  taken: ReadonlySet<string>
  /** Bank lines to a supply house that no payment claims. */
  unclaimed: UnclaimedHouseLine[]
  reload: () => void
}

/**
 * The bank side of supply house payments, for Accounts payable: one read of the feed's money out, the matches that
 * stand, and the lines to a house nobody has recorded. Everything fails soft to "no offer".
 */
export function useSupplyHouseBank(enabled: boolean, io: SupplyBankIo, houses: ReadonlyArray<{ id: string; name: string }>): SupplyHouseBank {
  const [lines, setLines] = useState<SupplyBankLine[]>([])
  const [matches, setMatches] = useState<{ paymentId: string; transactionId: string }[]>([])
  /** What the Tally settled, and the set of candidates it was read for: a line is listed only once that read is in. */
  const [settled, setSettled] = useState<{ forIds: string; ids: ReadonlySet<string> }>({ forIds: '', ids: new Set() })
  const [key, setKey] = useState(0)
  const reload = useCallback(() => setKey((k) => k + 1), [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void (async () => {
      const [rows, matched] = await Promise.all([io.loadBankRows(READ_FROM_YMD).catch(() => []), io.loadMatches().catch(() => [])])
      if (!alive) return
      setLines(supplyBankLines(rows))
      setMatches(matched)
    })()
    return () => {
      alive = false
    }
  }, [enabled, io, key])

  const matchedByPayment = useMemo(() => new Map(matches.map((m) => [m.paymentId, m.transactionId])), [matches])
  const taken = useMemo(() => new Set(matches.map((m) => m.transactionId)), [matches])
  // Before the Tally's word is read, every line to a house is a candidate; the ones it settled drop out after.
  const candidates = useMemo(() => unclaimedHouseLines(lines, houses, taken, new Set(), SUPPLY_BANK_FROM_YMD), [lines, houses, taken])
  const candidateIds = candidates.map((c) => c.line.id).join(',')

  useEffect(() => {
    if (!enabled || !candidateIds) {
      setSettled({ forIds: '', ids: new Set() })
      return
    }
    let alive = true
    io.loadSettled(candidateIds.split(','))
      .then((found) => {
        if (alive) setSettled({ forIds: candidateIds, ids: found })
      })
      // A read that fails lists nothing: a counter purchase must not be offered as a payment of bills.
      .catch(() => {
        if (alive) setSettled({ forIds: '', ids: new Set() })
      })
    return () => {
      alive = false
    }
  }, [enabled, io, candidateIds])

  const unclaimed = useMemo(() => (settled.forIds === candidateIds && candidateIds ? candidates.filter((c) => !settled.ids.has(c.line.id)) : []), [candidates, settled, candidateIds])
  return { lines, matchedByPayment, taken, unclaimed, reload }
}
