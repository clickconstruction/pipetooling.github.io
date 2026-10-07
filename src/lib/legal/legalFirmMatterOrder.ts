/**
 * The order of the firm's matters (punch list #85, item 11): largest balance first, the newest
 * referral first when two balances match, and the function's own order (oldest referral first)
 * after that. The balance is the packet kernel's figure, built on the page, so the page sorts;
 * a matter whose packet could not be built keeps its place after the rest. Pure.
 */
export function orderFirmMatters<M extends { id: string; releasedAt: string | null }>(matters: ReadonlyArray<M>, balanceOf: (m: M) => number | null): M[] {
  const placed = matters.map((m, i) => ({ m, i, balance: balanceOf(m) }))
  placed.sort((a, b) => {
    if (a.balance == null || b.balance == null) return a.balance == null && b.balance == null ? a.i - b.i : a.balance == null ? 1 : -1
    if (b.balance !== a.balance) return b.balance - a.balance
    const ra = a.m.releasedAt ?? ''
    const rb = b.m.releasedAt ?? ''
    if (ra !== rb) return rb.localeCompare(ra)
    return a.i - b.i
  })
  return placed.map((p) => p.m)
}
