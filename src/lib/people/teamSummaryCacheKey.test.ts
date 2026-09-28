import { describe, expect, it } from 'vitest'
import { buildTeamSummaryCacheKey, type TeamSummaryCacheKeyInput } from './teamSummaryCacheKey'

const base: TeamSummaryCacheKeyInput = {
  start: '2026-08-05',
  end: '2026-09-03',
  onlyPaidInFull: false,
  roster: ['Bo', 'Al'],
  payConfig: {
    Bo: { is_salary: false, hourly_wage: 30 },
    Al: { is_salary: true, hourly_wage: null },
  },
}

describe('buildTeamSummaryCacheKey', () => {
  it('joins the range, the paid flag, the roster and the pay config', () => {
    expect(buildTeamSummaryCacheKey(base)).toBe('2026-08-05::2026-09-03::0::Al,Bo::Al:s|Bo:h30')
  })

  it('does not move when the roster or the pay config arrive in another order', () => {
    const shuffled: TeamSummaryCacheKeyInput = {
      ...base,
      roster: ['Al', 'Bo'],
      payConfig: { Al: base.payConfig.Al, Bo: base.payConfig.Bo },
    }
    expect(buildTeamSummaryCacheKey(shuffled)).toBe(buildTeamSummaryCacheKey(base))
  })

  it('moves on a wage-only edit', () => {
    const raised = { ...base, payConfig: { ...base.payConfig, Bo: { is_salary: false, hourly_wage: 32 } } }
    expect(buildTeamSummaryCacheKey(raised)).not.toBe(buildTeamSummaryCacheKey(base))
  })

  it('moves when hourly becomes salary', () => {
    const salaried = { ...base, payConfig: { ...base.payConfig, Bo: { is_salary: true, hourly_wage: 30 } } }
    expect(buildTeamSummaryCacheKey(salaried)).toContain('Bo:s30')
  })

  it('moves on the range and on the paid-in-full toggle', () => {
    expect(buildTeamSummaryCacheKey({ ...base, end: '2026-09-04' })).not.toBe(buildTeamSummaryCacheKey(base))
    expect(buildTeamSummaryCacheKey({ ...base, onlyPaidInFull: true })).toContain('::1::')
  })

  it('counts pay config people who are not on the table', () => {
    const extra = { ...base, payConfig: { ...base.payConfig, Cy: { is_salary: false, hourly_wage: 25 } } }
    expect(buildTeamSummaryCacheKey(extra)).toBe('2026-08-05::2026-09-03::0::Al,Bo::Al:s|Bo:h30|Cy:h25')
  })

  it('writes a missing row as ? and a missing wage as nothing', () => {
    const gaps = { ...base, payConfig: { Al: undefined, Bo: { is_salary: false } } }
    expect(buildTeamSummaryCacheKey(gaps)).toBe('2026-08-05::2026-09-03::0::Al,Bo::Al:?|Bo:h')
  })

  it('is stable for an empty roster and pay config', () => {
    expect(buildTeamSummaryCacheKey({ ...base, roster: [], payConfig: {} })).toBe('2026-08-05::2026-09-03::0::::')
  })
})
