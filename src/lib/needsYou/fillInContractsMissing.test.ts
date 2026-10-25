import { describe, expect, it } from 'vitest'
import {
  contractMissingDecisionReady,
  contractMissingFillInRows,
  contractMissingKnows,
  contractMissingTrailWords,
  contractMissingWrites,
  emptyContractMissingDecision,
  type ContractMissingFillInRow,
} from './fillInContractsMissing'

const NOW = new Date('2026-10-25T15:00:00Z')

function job(id: string, extra: Partial<Parameters<typeof contractMissingFillInRows>[0]['jobs'][number]> = {}) {
  return { id, bid_id: null, status: 'working', revenue: 10_000, hcp_number: id, click_number: null, job_name: `Job ${id}`, customer_name: 'Hunter Homes', job_address: '12 Oak St', customer_email: 'ap@hunter.example', ...extra }
}

describe('fillInContractsMissing · the rows behind "N live jobs have no contract on file" (punch list #176)', () => {
  it('one row per live job the nudge counts as missing, the most money first, with the door into the sweep', () => {
    const rows = contractMissingFillInRows({
      jobs: [job('1007', { revenue: 249_716 }), job('1044', { revenue: 14_100 }), job('995', { revenue: 215, contract_not_needed_at: '2026-10-01T00:00:00Z' })],
      contracts: [],
      estimates: [],
      now: NOW,
      floorCents: 0,
    })
    expect(rows.map((r) => r.jobId)).toEqual(['1007', '1044'])
    expect(rows[0]).toMatchObject({
      kind: 'contract-missing',
      key: 'contract-missing:1007',
      title: '#1007 Job 1007 · Hunter Homes · $249,716 · no contract on file',
      doorHref: '/jobs?tab=stages&contractSweep=1',
      doorLabel: 'Send it from the sweep',
      customerEmail: 'ap@hunter.example',
    })
    expect(rows[0]!.knows).toEqual([
      'The customer is Hunter Homes.',
      'Working · $249,716 of work on no signed agreement.',
      'An email is on file: ap@hunter.example. The sweep can send the agreement there.',
    ])
  })

  it('what the app knows when there is no email, and no stage', () => {
    expect(contractMissingKnows({ customerName: null, status: null, revenue: 500, customerEmail: null })).toEqual([
      '$500 of work on no signed agreement.',
      'No email on file, so the sweep cannot send it yet.',
    ])
  })

  it('paper needs a signer and a day; No contract needed needs a few words; the writes and the trail follow', () => {
    const row = { jobId: 'j1', customerName: 'Hunter Homes' } as ContractMissingFillInRow
    const empty = emptyContractMissingDecision(row, '2026-10-25')
    expect(empty).toMatchObject({ choice: null, signerName: 'Hunter Homes', signedOn: '2026-10-25', reason: '' })
    expect(contractMissingDecisionReady(empty)).toBe(false)
    expect(contractMissingDecisionReady({ ...empty, choice: 'paper', signerName: '' })).toBe(false)
    expect(contractMissingDecisionReady({ ...empty, choice: 'paper' })).toBe(true)
    expect(contractMissingDecisionReady({ ...empty, choice: 'not-needed', reason: 'PO' })).toBe(false)
    expect(contractMissingDecisionReady({ ...empty, choice: 'not-needed', reason: 'A PO stands in for it' })).toBe(true)
    const paper = contractMissingWrites(row, { ...empty, choice: 'paper', link: ' https://drive.example/x ' })!
    expect(paper).toEqual({ choice: 'paper', jobId: 'j1', signerName: 'Hunter Homes', signedOn: '2026-10-25', link: 'https://drive.example/x', file: null })
    expect(contractMissingTrailWords(paper)).toBe('signed on paper by Hunter Homes · on file as signed')
    const notNeeded = contractMissingWrites(row, { ...empty, choice: 'not-needed', reason: ' A PO stands in for it ' })!
    expect(notNeeded).toEqual({ choice: 'not-needed', jobId: 'j1', reason: 'A PO stands in for it' })
    expect(contractMissingTrailWords(notNeeded)).toBe('no contract needed · A PO stands in for it')
    expect(contractMissingWrites(row, empty)).toBeNull()
  })
})
