import { describe, expect, it } from 'vitest'
import { buildLaborJobNamesByNumber } from './subLaborLedgerNames'

describe('buildLaborJobNamesByNumber', () => {
  it('keys HCP-numbered jobs by their hcp_number', () => {
    const map = buildLaborJobNamesByNumber([
      { hcp_number: '880', click_number: '', job_name: 'Reliant Health- HVAC' },
    ])
    expect(map['880']).toBe('Reliant Health- HVAC')
  })

  it('keys click-only jobs by their click_number (the 977 | Springtown bug)', () => {
    const map = buildLaborJobNamesByNumber([
      { hcp_number: '', click_number: '977', job_name: 'Springtown' },
    ])
    expect(map['977']).toBe('Springtown')
  })

  it('keys a job carrying both numbers under both', () => {
    const map = buildLaborJobNamesByNumber([
      { hcp_number: '500', click_number: '501', job_name: 'Both Numbers' },
    ])
    expect(map['500']).toBe('Both Numbers')
    expect(map['501']).toBe('Both Numbers')
  })

  it('trims and lowercases keys, trims names, skips empty names', () => {
    const map = buildLaborJobNamesByNumber([
      { hcp_number: ' HCP-9 ', click_number: null, job_name: '  Spaced  ' },
      { hcp_number: '10', click_number: '', job_name: '   ' },
      { hcp_number: '11', click_number: '', job_name: null },
    ])
    expect(map['hcp-9']).toBe('Spaced')
    expect(map['10']).toBeUndefined()
    expect(map['11']).toBeUndefined()
  })

  it('first resolution of a duplicate number wins', () => {
    const map = buildLaborJobNamesByNumber([
      { hcp_number: '42', click_number: '', job_name: 'First' },
      { hcp_number: '42', click_number: '', job_name: 'Second' },
      { hcp_number: '', click_number: '42', job_name: 'Third' },
    ])
    expect(map['42']).toBe('First')
  })
})
