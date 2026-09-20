import { describe, expect, it } from 'vitest'
import { assessContractSweepRows, contractSweepFilterMatches, contractSweepFooterSentence, contractSweepPrimary, contractSweepSummary, isThinScope, type ContractSweepRowInput } from './contractSweepRowState'

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

describe('the pane footer (PR 2)', () => {
  it('names the primary and the sentence for each state', () => {
    const states = assessContractSweepRows([
      row({ id: 'j523' }),
      row({ id: 'j363', email: 'palmer@example.com', revenue: 31400 }),
      row({ id: 'j843', jobNumber: '843', email: 'palmer@example.com', revenue: 11920 }),
      row({ id: 'j683', jobName: 'Job', scopeLines: ['Job'], revenue: null, email: 'may@x.com' }),
      row({ id: 'j778', email: '' }),
      row({ id: 'j804', gcJob: true, email: 'estimating@summitgc.net' }),
    ])
    expect(contractSweepPrimary(states.get('j523'))).toBe('send_next')
    expect(contractSweepFooterSentence({ state: states.get('j523'), email: 'kcallison@tfharper.com', jobName: 'Mission Hills', gcName: null, nextJobNumber: '363' })).toBe('Emails kcallison@tfharper.com · then J363')
    expect(contractSweepFooterSentence({ state: states.get('j363'), email: 'palmer@example.com', jobName: 'Michael Palmer', gcName: null, nextJobNumber: null })).toBe('Emails palmer@example.com · this customer also has J843 here')
    // PR 5: the sentence follows the chosen way.
    expect(contractSweepFooterSentence({ state: states.get('j523'), email: 'kcallison@tfharper.com', jobName: 'Mission Hills', gcName: null, nextJobNumber: '363', way: 'pdf_email' })).toBe('Emails the PDF to kcallison@tfharper.com · then J363')
    expect(contractSweepFooterSentence({ state: states.get('j523'), email: 'kcallison@tfharper.com', jobName: 'Mission Hills', gcName: null, nextJobNumber: '363', way: 'download' })).toBe('Nothing is emailed — the page is yours to hand over, and the job leaves this list · then J363')
    expect(contractSweepPrimary(states.get('j683'))).toBe('blocked')
    expect(contractSweepFooterSentence({ state: states.get('j683'), email: 'may@x.com', jobName: 'Job', gcName: null, nextJobNumber: '778' })).toBe("the scope is one line — “Work we'll do: Job” · sends as time and materials · then J778")
    expect(contractSweepPrimary(states.get('j778'))).toBe('blocked')
    expect(contractSweepFooterSentence({ state: states.get('j778'), email: '', jobName: 'X', gcName: null, nextJobNumber: null })).toMatch(/^No signer email/)
    expect(contractSweepPrimary(states.get('j804'))).toBe('file_theirs')
    expect(contractSweepFooterSentence({ state: states.get('j804'), email: 'e@summit.com', jobName: 'Auto Zone', gcName: 'Summit GC', nextJobNumber: null })).toBe("GC job · Summit GC's subcontract is the agreement")
  })
})
