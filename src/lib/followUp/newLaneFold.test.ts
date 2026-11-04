import { describe, expect, it } from 'vitest'
import type { Invitation } from '../emailIn/invitation'
import { foldedLead } from './newLaneFold'
import type { BidCustomerChoice } from './newLane'

const ridgeway: BidCustomerChoice = { customerId: 'cu-1', customer: 'Ridgeway Builders', label: 'Start a bid on Ridgeway Builders', words: 'Same company address.', guess: null }
const invitation = (project: string | null) => ({ project }) as unknown as Invitation

describe('a folded sort card leads with the press it already picked (v2.6476)', () => {
  it('Bid it?: the first customer it found, once the bid has a name', () => {
    expect(foldedLead({ sort: 'bid', invitation: invitation('Westlake Chapel School') }, { bidChoices: [ridgeway] })).toEqual({
      kind: 'bid',
      label: 'Start a bid on Ridgeway Builders',
      choice: ridgeway,
      projectName: 'Westlake Chapel School',
    })
    expect(foldedLead({ sort: 'bid', invitation: invitation('  ') }, { bidChoices: [ridgeway] })).toBeNull()
    expect(foldedLead({ sort: 'bid', invitation: invitation('Westlake') }, { bidChoices: [] })).toBeNull()
    expect(foldedLead({ sort: 'bid', invitation: invitation('Westlake') }, { bidChoices: null })).toBeNull()
  })

  it('Which job?: keeps the line on its default, or moves it to the job picked', () => {
    expect(foldedLead({ sort: 'job', invitation: null }, { pickedJob: { id: 'j1', number: '#42', name: 'Stone Oak', isDefault: true } })).toEqual({ kind: 'job', label: 'Keep it on #42', jobId: 'j1' })
    expect(foldedLead({ sort: 'job', invitation: null }, { pickedJob: { id: 'j2', number: '#7', name: 'Alamo', isDefault: false } })?.label).toBe('Move it to #7')
    expect(foldedLead({ sort: 'job', invitation: null }, { pickedJob: null })).toBeNull()
  })

  it('Who is this? asks with the search; Who has it? leads with nothing', () => {
    expect(foldedLead({ sort: 'who', invitation: null }, {})).toEqual({ kind: 'who', label: 'Who is this?' })
    expect(foldedLead({ sort: 'has', invitation: null }, {})).toBeNull()
  })
})
