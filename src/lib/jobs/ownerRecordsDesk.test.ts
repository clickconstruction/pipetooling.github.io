import { describe, expect, it } from 'vitest'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { ownerRecordsFromDesk } from './ownerRecordsDesk'

const fields = (claim: string) => ({ notice: { claimAmount: claim, noticeDate: '2026-09-14' }, gcEmail: '' })
const item = (id: string, job_id: string, status: string, claim: string, at: string, over: Record<string, unknown> = {}) => ({ id, job_id, kind: 'notice_53_056', status, fields: fields(claim), voided_at: null, sent_at: status === 'sent' ? at : null, updated_at: at, created_at: at, ...over })
const job = (id: string, name: string, address: string, addressId: string | null, customer_id: string, revenue: number, paid: number) => ({ id, hcp_number: id.slice(1), click_number: null, job_name: name, job_address: address, customer_id, customer_name: 'Umar Khan', gc_customer_id: 'gc1', customer_address_id: addressId, revenue, payments_made: paid, master_user_id: null, last_work_date: null })

const data = {
  items: [
    item('i1', 'j273', 'sent', '17585.00', '2026-09-15T15:00:00Z'),
    // An older sent notice on the same job: the newest claim is the one read.
    item('i0', 'j273', 'sent', '9000.00', '2026-08-15T15:00:00Z'),
    item('i2', 'j858', 'approved', '7902.00', '2026-10-05T15:00:00Z'),
    // A missed window is on the desk but is not a notice: no claim.
    item('i3', 'j881', 'missed', '1050.00', '2026-09-20T15:00:00Z'),
    item('i4', 'j999', 'sent', '100.00', '2026-09-15T15:00:00Z', { voided_at: '2026-09-16T00:00:00Z' }),
    item('i5', 'j867', 'sent', '1710.00', '2026-09-15T15:00:00Z'),
    { ...item('i6', 'j273', 'approved', '1.00', '2026-10-05T15:00:00Z'), kind: 'affidavit' },
  ],
  jobsById: {
    j273: job('j273', 'Dudley (Lennox)', '9703 Lenox Hl\nSan Antonio, TX 78240', 'addr-lenox', 'c1', 20000, 2415),
    j858: job('j858', 'Service Visit', '9703 Lenox Hl, San Antonio, TX', 'addr-lenox', 'c1', 7902, 0),
    j881: job('j881', 'Dudley Mason', '9703 Lenox Hl San Antonio, TX', null, 'c1', 1050, 0),
    j867: job('j867', 'Service Visit', '628 Terrell Rd, San Antonio, TX', 'addr-terrell', 'c2', 1710, 0),
  },
  gcsById: { gc1: { id: 'gc1', name: 'RMC- Dudley Mason', address: '', email: '', policy: 'ask', policyNote: '' } },
  ownerByJob: { j273: { owner_mode: 'person', owner_name: 'KHAN UMAR & BANGASH SHAZMEENA', company_name: null, mailing_address: '3203 Spider Lily' }, j867: { owner_mode: 'building_owner', owner_name: 'R. Syed', company_name: 'Terrell Holdings LLC', mailing_address: null } },
} as unknown as LienDeskData

describe('ownerRecordsFromDesk', () => {
  const desk = ownerRecordsFromDesk(data)

  it('reads the newest notice claim per job; a missed window and a voided notice have none', () => {
    expect(desk.claimsByJob).toEqual({ j273: 17585, j858: 7902, j881: null, j867: 1710 })
  })

  it('folds the desk’s jobs by owner and property, named by the owner of record when there is one', () => {
    expect(desk.properties.every((p) => p.sharesAddress === false)).toBe(true)
    expect(desk.properties.map((p) => [p.owner, p.address, p.gcName, p.jobs, p.open, p.seedJobId])).toEqual([
      ['KHAN UMAR & BANGASH SHAZMEENA', '9703 Lenox Hl, San Antonio, TX 78240', 'RMC- Dudley Mason', 3, 26537, 'j273'],
      ['Terrell Holdings LLC', '628 Terrell Rd, San Antonio, TX', 'RMC- Dudley Mason', 1, 1710, 'j867'],
    ])
  })

  it('hands the window the job behind a row', () => {
    expect(desk.seedFor('j273')).toEqual({ jobId: 'j273', customerId: 'c1', addressId: 'addr-lenox', gcId: 'gc1' })
    expect(desk.seedFor('nope')).toBeNull()
  })

  it('with no desk data there is nothing to pick', () => {
    const empty = ownerRecordsFromDesk(null)
    expect(empty.properties).toEqual([])
    expect(empty.seedFor('j273')).toBeNull()
  })
})
