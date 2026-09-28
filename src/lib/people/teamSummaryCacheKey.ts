// What the Team Summary's rows depend on, as one string: the popup compares
// it with the key the inline table was built under and reuses those rows when
// nothing moved. Extracted from `buildTeamSummaryCacheKey` in
// `PeopleReviewTab.tsx`.

export type TeamSummaryCacheKeyInput = {
  start: string
  end: string
  onlyPaidInFull: boolean
  /** The people on the table. Order does not matter — the key sorts them. */
  roster: readonly string[]
  /** Pay config by person name; only the salary flag and the wage enter the key. */
  payConfig: Record<string, { is_salary?: boolean | null; hourly_wage?: number | null } | undefined>
}

/**
 * `start::end::paid::roster::payConfig`. The roster and the pay config names
 * are sorted so member order cannot move the key; the pay config part carries
 * salary flag + wage so a wage-only edit, which leaves the roster as it was,
 * still misses the cache.
 */
export function buildTeamSummaryCacheKey(input: TeamSummaryCacheKeyInput): string {
  const roster = [...input.roster].sort().join(',')
  const pc = Object.keys(input.payConfig)
    .sort()
    .map((n) => {
      const cfg = input.payConfig[n]
      if (!cfg) return `${n}:?`
      return `${n}:${cfg.is_salary ? 's' : 'h'}${cfg.hourly_wage ?? ''}`
    })
    .join('|')
  return [input.start, input.end, input.onlyPaidInFull ? '1' : '0', roster, pc].join('::')
}
