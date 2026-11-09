import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { billEmailChannel, billEmailSentWords, billShareDoorsOffered, noEmailOnContactWords } from './billShareDoors'

const SAM: Contact = {
  id: 'c-sam',
  kind: 'customer',
  name: 'Sam Sample',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-sam' },
  channels: [
    { id: 'ch-home', kind: 'phone', value: '(512) 555-0100', optedOutAt: null },
    { id: 'ch-work', kind: 'email', value: 'sam@work.example', optedOutAt: null },
    { id: 'ch-email', kind: 'email', value: 'Sam@Example.com', optedOutAt: null },
  ],
  jobIds: [],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}

describe('billShareDoors', () => {
  it('offers the doors only with the job and its customer', () => {
    expect(billShareDoorsOffered({ jobId: 'j1', customerId: 'cust-sam' })).toBe(true)
    expect(billShareDoorsOffered({ jobId: 'j1', customerId: null })).toBe(false)
    expect(billShareDoorsOffered({ customerId: 'cust-sam' })).toBe(false)
    expect(billShareDoorsOffered({ jobId: ' ', customerId: 'cust-sam' })).toBe(false)
  })

  it('emails the job’s customer email when it is on the contact, compared in lower case', () => {
    expect(billEmailChannel(SAM, ' sam@example.com ')?.id).toBe('ch-email')
  })

  it('falls back to the first email on the contact, and to none', () => {
    expect(billEmailChannel(SAM, 'other@example.com')?.id).toBe('ch-work')
    expect(billEmailChannel(SAM, null)?.id).toBe('ch-work')
    expect(billEmailChannel({ channels: SAM.channels.filter((ch) => ch.kind === 'phone') }, 'sam@example.com')).toBeNull()
  })

  it('the words name the person and the address', () => {
    expect(noEmailOnContactWords('Sam')).toBe('Sam’s contact has no email yet, so the office cannot email the bill. Add one on the Job tab.')
    expect(billEmailSentWords('sam@example.com')).toBe('The bill went to sam@example.com from the office. It is in their thread and in the job’s activity.')
  })
})
