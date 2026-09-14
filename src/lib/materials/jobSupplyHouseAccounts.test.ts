import { describe, expect, it } from 'vitest'
import {
  buildHouseJobAccountRoster,
  contactRoleOf,
  countHouseRoster,
  houseRosterSummary,
  jobAccountPolicyOf,
  jobAccountRepOf,
  jobAccountsForJob,
  openedViaPhrase,
  type JobSupplyHouseAccountRow,
} from './jobSupplyHouseAccounts'

function account(overrides: Partial<JobSupplyHouseAccountRow> & { job_id: string; supply_house_id: string }): JobSupplyHouseAccountRow {
  return {
    id: `${overrides.job_id}-${overrides.supply_house_id}`,
    status: 'open',
    account_ref: '',
    opened_via: null,
    rep_contact_id: null,
    requested_by: null,
    requested_at: null,
    requested_from_counter: false,
    opened_by: null,
    opened_at: null,
    note: '',
    ...overrides,
  }
}

describe('house policy and contact role', () => {
  it('reads a missing column as the safe default', () => {
    expect(jobAccountPolicyOf({})).toBe('optional')
    expect(jobAccountPolicyOf({ job_accounts: 'expects' })).toBe('expects')
    expect(jobAccountPolicyOf({ job_accounts: 'bogus' })).toBe('optional')
    expect(contactRoleOf({})).toBe('price_requests')
    expect(contactRoleOf({ role: 'job_accounts' })).toBe('job_accounts')
  })

  it('finds the job-accounts rep and skips archived ones', () => {
    const reps = [
      { id: 'a', name: 'Cristian', email: 'c@f.com', phone: null, role: 'price_requests' },
      { id: 'b', name: 'Curly', email: 'curly@f.com', phone: '210-344-4950', role: 'job_accounts', archived_at: '2026-01-01' },
      { id: 'c', name: 'Curly Conley', email: 'curly2@f.com', phone: '210-344-4950', role: 'job_accounts' },
    ]
    expect(jobAccountRepOf(reps)?.id).toBe('c')
    expect(jobAccountRepOf(reps.slice(0, 1))).toBeNull()
  })

  it('phrases how an account was opened', () => {
    expect(openedViaPhrase('phone')).toBe('opened by phone')
    expect(openedViaPhrase('packet')).toBe('opened with the packet')
    expect(openedViaPhrase('counter')).toBe('opened at the counter')
    expect(openedViaPhrase(null)).toBe('opened')
  })
})

describe('buildHouseJobAccountRoster', () => {
  const HOUSE = 'ferguson'
  const invoices = [
    { id: 'i1', amount: 1000, is_paid: false, job_allocations: [{ job_id: 'j804', pct: 100 }] },
    { id: 'i2', amount: 500, is_paid: true, job_allocations: [{ job_id: 'j804', pct: 100 }] },
    { id: 'i3', amount: 800, is_paid: false, job_allocations: [{ job_id: 'j964', pct: 50 }, { job_id: 'j951', pct: 50 }] },
    { id: 'i4', amount: 100, is_paid: false, job_allocations: [] },
  ]

  it('lists accounts and the evidence case, requested first, then bought-no-account, then open, then not needed', () => {
    const rows = buildHouseJobAccountRoster(HOUSE, [
      account({ job_id: 'j964', supply_house_id: HOUSE, status: 'open', account_ref: 'JA-4114' }),
      account({ job_id: 'j951', supply_house_id: HOUSE, status: 'requested', requested_at: '2026-09-14T18:40:00Z' }),
      account({ job_id: 'j100', supply_house_id: HOUSE, status: 'not_needed', note: 'buys on the builder account' }),
      account({ job_id: 'j999', supply_house_id: 'reece', status: 'open' }),
    ], invoices)
    expect(rows.map((r) => `${r.jobId}:${r.kind}`)).toEqual([
      'j951:requested',
      'j804:bought_no_account',
      'j964:open',
      'j100:not_needed',
    ])
    const j804 = rows.find((r) => r.jobId === 'j804')!
    expect(j804.invoiceCount).toBe(2)
    expect(j804.allocatedTotal).toBe(1500)
    expect(j804.unpaidTotal).toBe(1000)
    const j964 = rows.find((r) => r.jobId === 'j964')!
    expect(j964.account?.account_ref).toBe('JA-4114')
    expect(j964.allocatedTotal).toBe(400)
    expect(rows.some((r) => r.jobId === 'j999')).toBe(false)
  })

  it('orders within a kind by unpaid dollars', () => {
    const rows = buildHouseJobAccountRoster(HOUSE, [], [
      { id: 'a', amount: 100, is_paid: false, job_allocations: [{ job_id: 'small', pct: 100 }] },
      { id: 'b', amount: 900, is_paid: false, job_allocations: [{ job_id: 'big', pct: 100 }] },
    ])
    expect(rows.map((r) => r.jobId)).toEqual(['big', 'small'])
  })

  it('counts and summarises', () => {
    const rows = buildHouseJobAccountRoster(HOUSE, [
      account({ job_id: 'j964', supply_house_id: HOUSE, status: 'open' }),
      account({ job_id: 'j951', supply_house_id: HOUSE, status: 'requested' }),
    ], invoices)
    const counts = countHouseRoster(rows)
    expect(counts).toEqual({ requested: 1, boughtNoAccount: 1, open: 1, notNeeded: 0 })
    expect(houseRosterSummary(counts)).toBe('1 open · 1 requested · 1 bought with no account')
    expect(houseRosterSummary({ requested: 0, boughtNoAccount: 0, open: 0, notNeeded: 0 })).toBe('none yet')
  })
})

describe('jobAccountsForJob', () => {
  const houses = [
    { id: 'ferguson', name: 'Ferguson', job_accounts: 'expects' },
    { id: 'reece', name: 'Reece', job_accounts: 'expects' },
    { id: 'hughes', name: 'Hughes Supply', job_accounts: 'optional' },
    { id: 'amazon', name: 'Amazon', job_accounts: 'none' },
  ]

  it('shows every expecting house, none for the ones with no row, and an optional house only when it has a row', () => {
    const views = jobAccountsForJob('j964', houses, [
      account({ job_id: 'j964', supply_house_id: 'ferguson', status: 'open' }),
      account({ job_id: 'j964', supply_house_id: 'hughes', status: 'requested' }),
      account({ job_id: 'other', supply_house_id: 'reece', status: 'open' }),
    ])
    expect(views.map((v) => `${v.houseName}:${v.state}`)).toEqual(['Ferguson:open', 'Reece:none', 'Hughes Supply:requested'])
  })

  it('reads not_needed as its own state', () => {
    const views = jobAccountsForJob('j1', houses, [account({ job_id: 'j1', supply_house_id: 'ferguson', status: 'not_needed' })])
    expect(views[0]?.state).toBe('not_needed')
  })
})
