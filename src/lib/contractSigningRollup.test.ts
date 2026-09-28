import { describe, expect, it } from 'vitest'
import { contractSigningIconTitle, rollupContractSigningStatusByPersonName, type PersonContractSigningRollupRow } from './contractSigningRollup'

function row(overrides: Partial<PersonContractSigningRollupRow>): PersonContractSigningRollupRow {
  return { person_name: 'Alex Rivera', contract_lineage_id: 'l1', lineage_version: 1, status: 'signed', ...overrides }
}

describe('rollupContractSigningStatusByPersonName', () => {
  it('is green when every contract is signed, red when none is, yellow between', () => {
    const rows = [
      row({ person_name: 'All', contract_lineage_id: 'a' }),
      row({ person_name: 'All', contract_lineage_id: 'b' }),
      row({ person_name: 'None', contract_lineage_id: 'a', status: 'sent' }),
      row({ person_name: 'Some', contract_lineage_id: 'a' }),
      row({ person_name: 'Some', contract_lineage_id: 'b', status: 'draft' }),
    ]
    expect(rollupContractSigningStatusByPersonName(rows)).toEqual({ All: 'green', None: 'red', Some: 'yellow' })
  })

  it('reads only the newest version of a contract, whatever order the rows come in', () => {
    const resent = [row({ lineage_version: 2, status: 'sent' }), row({ lineage_version: 1, status: 'signed' })]
    expect(rollupContractSigningStatusByPersonName(resent)).toEqual({ 'Alex Rivera': 'red' })
    const resigned = [row({ lineage_version: 1, status: 'sent' }), row({ lineage_version: 2, status: 'signed' })]
    expect(rollupContractSigningStatusByPersonName(resigned)).toEqual({ 'Alex Rivera': 'green' })
  })

  it('leaves out a person with no contract rows', () => {
    expect(rollupContractSigningStatusByPersonName([])).toEqual({})
  })
})

describe('contractSigningIconTitle', () => {
  it('names each light', () => {
    expect(contractSigningIconTitle('green')).toBe('All contracts signed')
    expect(contractSigningIconTitle('yellow')).toBe('Some contracts signed')
    expect(contractSigningIconTitle('red')).toBe('No contracts signed')
  })
})
