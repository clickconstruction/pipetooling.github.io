/** Minimal shape for Job Total = sum of Specific Work extended amounts (named rows only). Matches JobFormModal. */
export type JobFixtureLineForRevenue = {
  name: string
  count: number
  line_unit_price: number | null
}

export function revenueDollarsFromFixtures(fixtures: JobFixtureLineForRevenue[]): number {
  let s = 0
  for (const f of fixtures) {
    if (!(f.name ?? '').trim()) continue
    const c = Number(f.count)
    const qty = Number.isFinite(c) && c > 0 ? c : 1
    const unit = f.line_unit_price ?? 0
    s += qty * (Number.isFinite(unit) ? unit : 0)
  }
  return Math.round(s * 100) / 100
}
