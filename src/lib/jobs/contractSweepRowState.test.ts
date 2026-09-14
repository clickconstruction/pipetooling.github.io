import { describe, expect, it } from 'vitest'
import { assessContractSweepRows, contractSweepFilterMatches, contractSweepSummary, isThinScope, type ContractSweepRowInput } from './contractSweepRowState'

function row(p: Partial<ContractSweepRowInput> & { id: string }): ContractSweepRowInput {
  return { jobNumber: p.id.replace(/^j/, ''), jobName: 'Mission Hills', email: 'kcallison@tfharper.com', revenue: 123600, scopeLines: ['14 × Water closet', '9 × Lavatory'], gcJob: false, ...p }
}

describe('assessContractSweepRows', () => {
  it('a row with an email, a real scope and an amount is Ready and Send all takes it', () => {
    const st = assessContractSweepRows([row({ id: 'j523' })]).get('j523')!
    expect(st.flags).toEqual(['ready'])
    expect(st.readyForBulk).toBe(true)
    expect(st.action).toBe('send')
  })

  it('a scope that is only the job name is thin — the row asks for scope before it sends', () => {
    expect(isThinScope(['Job'], 'Job')).toBe(true)
    expect(isThinScope([], 'Job')).toBe(true)
    expect(isThinScope(['job'], 'Job')).toBe(true)
    expect(isThinScope(['Water heater'], 'Gonzalez')).toBe(false)
    const st = assessContractSweepRows([row({ id: 'j683', jobName: 'Job', scopeLines: ['Job'], revenue: null })]).get('j683')!
    expect(st.flags).toEqual(['thin_scope', 'no_amount'])
    expect(st.readyForBulk).toBe(false)
    expect(st.action).toBe('add_scope')
  })

  it('no amount alone still sends one at a time, never in bulk', () => {
    const st = assessContractSweepRows([row({ id: 'j798', revenue: 0 })]).get('j798')!
    expect(st.flags).toEqual(['no_amount'])
    expect(st.readyForBulk).toBe(false)
    expect(st.action).toBe('send')
  })

  it('no email → Fix email; a GC job → file theirs, whatever else is true', () => {
    const states = assessContractSweepRows([row({ id: 'j778', email: '' }), row({ id: 'j523', gcJob: true }), row({ id: 'j804', gcJob: true, email: '' })])
    expect(states.get('j778')).toMatchObject({ flags: ['no_email'], emailOk: false, action: 'fix_email', readyForBulk: false })
    expect(states.get('j523')).toMatchObject({ flags: ['gc_job'], action: 'file_theirs', readyForBulk: false })
    expect(states.get('j804')).toMatchObject({ flags: ['gc_job', 'no_email'], action: 'file_theirs' })
  })

  it('rows sharing an email name each other', () => {
    const states = assessContractSweepRows([
      row({ id: 'j651', jobNumber: '651', email: 'Masondudley396@gmail.com' }),
      row({ id: 'j798', jobNumber: '798', email: 'masondudley396@gmail.com', revenue: null }),
      row({ id: 'j523' }),
    ])
    expect(states.get('j651')!.sameEmailAs).toEqual(['798'])
    expect(states.get('j798')!.sameEmailAs).toEqual(['651'])
    expect(states.get('j523')!.sameEmailAs).toEqual([])
  })

  it('the summary counts rows, dollars and distinct customers Send all would email; the filter splits To send from Needs a look', () => {
    const rows = [
      row({ id: 'j523' }),
      row({ id: 'j363', email: 'palmer@example.com', revenue: 31400 }),
      row({ id: 'j843', email: 'PALMER@example.com', revenue: 11920 }),
      row({ id: 'j683', jobName: 'Job', scopeLines: ['Job'], revenue: null }),
      row({ id: 'j804', gcJob: true, revenue: 32600 }),
    ]
    const states = assessContractSweepRows(rows)
    expect(contractSweepSummary(rows, states)).toEqual({ all: 5, toSend: 3, needsLook: 2, revenueTotal: 199520, customersToEmail: 2 })
    expect(rows.filter((r) => contractSweepFilterMatches(states.get(r.id), 'to_send')).map((r) => r.id)).toEqual(['j523', 'j363', 'j843'])
    expect(rows.filter((r) => contractSweepFilterMatches(states.get(r.id), 'needs_look')).map((r) => r.id)).toEqual(['j683', 'j804'])
    expect(rows.filter((r) => contractSweepFilterMatches(states.get(r.id), 'all')).length).toBe(5)
  })
})
