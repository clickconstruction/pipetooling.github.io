/**
 * Roster status summary for People → Contracts (v2.1405): counts a person's
 * document rows by signing state so the roster can show "2 unsent · 1 waiting"
 * chips beside the name instead of a lone far-right dot. Placeholder rows
 * (template lists the document but no person row exists yet) count as unsent —
 * matching getAggregateStatus, where any placeholder turns the dot red.
 */

export type PersonContractStatusCounts = {
  unsent: number
  sent: number
  signed: number
}

export function countPersonContractStatuses(
  rows: ReadonlyArray<{ version: { status: string } | null }>,
): PersonContractStatusCounts {
  const counts: PersonContractStatusCounts = { unsent: 0, sent: 0, signed: 0 }
  for (const row of rows) {
    const status = row.version?.status ?? 'unsent'
    if (status === 'signed') counts.signed++
    else if (status === 'sent') counts.sent++
    else counts.unsent++
  }
  return counts
}
