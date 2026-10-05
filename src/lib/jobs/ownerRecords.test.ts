import { describe, expect, it } from 'vitest'
import {
  EMPTY_OWNER_RECORDS,
  buildOwnerPacket,
  ownerPacketNumbers,
  ownerRecordsFootWords,
  ownerRecordsMissing,
  ownerRecordsProperties,
  ownerRecordsPropertyMatches,
  ownerRecordsSteps,
  parseOwnerRecords,
  type OwnerPacketJobInput,
  type OwnerRecordsFile,
} from './ownerRecords'

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const day = (ymd: string) => ymd

const job = (over: Partial<OwnerPacketJobInput> = {}): OwnerPacketJobInput => ({ id: 'j273', number: '273', name: 'Dudley (Lennox)', address: '9703 Lenox Hl, San Antonio, TX', gcName: 'RMC- Dudley Mason', total: 20000, bills: [], payments: [], ...over })
const bill = (id: string, amount: number, status = 'billed', billedAt: string | null = '2026-08-03T15:00:00Z', order = 0) => ({ id, amount, status, billedAt, order })
const pay = (id: string, billId: string | null, amount: number, paidOn: string | null, recordedAt: string | null = null, type: string | null = 'Check', reference: string | null = null) => ({ id, billId, amount, paidOn, recordedAt, type, reference })

describe('buildOwnerPacket', () => {
  it('puts each payment under the bill it names, oldest first, and counts what is still owed from the job total', () => {
    const p = buildOwnerPacket([
      job({
        bills: [bill('b2', 8000, 'billed', '2026-09-01T15:00:00Z', 1), bill('b1', 12000, 'paid', '2026-08-03T15:00:00Z', 0), bill('draft', 500, 'ready_to_bill', null, 2)],
        payments: [pay('p2', 'b1', 7000, '2026-08-28', '2026-08-28T20:05:00Z'), pay('p1', 'b1', 5000, '2026-08-14', '2026-08-15T14:00:00Z', 'Check', '1042'), pay('p3', null, 415, '2026-09-10')],
      }),
    ])
    const j = p.jobs[0]!
    expect(j.bills.map((b) => [b.label, b.amount, b.billedOn, b.paid, b.open])).toEqual([
      ['Bill 1', 12000, '2026-08-03', 12000, 0],
      ['Bill 2', 8000, '2026-09-01', 0, 8000],
    ])
    expect(j.bills[0]!.payments.map((x) => x.id)).toEqual(['p1', 'p2'])
    expect(j.bills[0]!.payments[0]).toEqual({ id: 'p1', amount: 5000, paidOn: '2026-08-14', recordedAt: '2026-08-15T14:00:00Z', type: 'Check', reference: '1042' })
    // A draft is not a bill yet; a payment that names no bill is listed on the job.
    expect(j.loosePayments.map((x) => x.id)).toEqual(['p3'])
    expect([j.total, j.billed, j.paid, j.owed]).toEqual([20000, 20000, 12415, 7585])
    expect([p.total, p.billed, p.paid, p.owed, p.payments]).toEqual([20000, 20000, 12415, 7585, 3])
  })

  it('reads the biggest balance first, and a job with no bill still shows its total as owed', () => {
    const p = buildOwnerPacket([job({ id: 'a', number: '1009', total: 350 }), job({ id: 'b', number: '858', total: 7902 }), job({ id: 'c', number: '866', total: 3500, bills: [bill('x', 1000)] })])
    expect(p.jobs.map((j) => j.number)).toEqual(['858', '866', '1009'])
    // Older work can be paid with no bill kept: what is owed is the total less what was paid, never the total less the bills.
    expect([p.jobs[1]!.total, p.jobs[1]!.billed, p.jobs[1]!.owed]).toEqual([3500, 1000, 3500])
    expect(p.owed).toBe(11752)
  })

  it('never shows a job overpaid as a negative balance', () => {
    expect(buildOwnerPacket([job({ total: 100, payments: [pay('p', null, 250, '2026-09-01')] })]).jobs[0]!.owed).toBe(0)
  })
})

describe('ownerPacketNumbers', () => {
  const packet = buildOwnerPacket([job({ id: 'j273', number: '273', total: 17585 }), job({ id: 'j858', number: '858', total: 7902 }), job({ id: 'j881', number: '881', total: 1050 })])

  it('agrees when every job has a notice that claims what the statement shows', () => {
    expect(ownerPacketNumbers(packet, { j273: 17585, j858: 7902, j881: 1050 }, money)).toEqual({ agree: true, lines: ['$26,537 matches the 3 notices.'] })
  })

  it('says a job with money owed and no notice, and a claim that differs, one line each', () => {
    const n = ownerPacketNumbers(packet, { j273: 17585, j858: 7000, j881: null }, money)
    expect(n.agree).toBe(false)
    expect(n.lines).toEqual(['$17,585 matches the notice.', 'Job 858: the notice claims $7,000. The statement shows $7,902.', '$1,050 on job 881 has no notice.'])
  })

  it('says so when nothing here has a notice', () => {
    expect(ownerPacketNumbers(buildOwnerPacket([job({ total: 0 })]), {}, money)).toEqual({ agree: false, lines: ['No job here has a notice yet.'] })
  })
})

describe('the four checks', () => {
  const numbers = { agree: true, lines: ['$26,537 matches the 3 notices.'] }
  const full: OwnerRecordsFile = {
    request: { on: '2026-10-05', how: 'email', from: 'Umar Khan', link: 'https://drive.example/req' },
    contractChecked: { by: 'Malachi', at: '2026-10-05T16:00:00Z' },
    acknowledgment: { signedOn: '2026-10-06', link: '' },
    sent: null,
  }

  it('an empty file has three things to do and the numbers read', () => {
    const steps = ownerRecordsSteps(EMPTY_OWNER_RECORDS, numbers, day)
    expect(steps.map((s) => [s.n, s.title, s.state])).toEqual([
      [1, 'Their request, in writing', 'todo'],
      [2, 'Our contract with the GC', 'todo'],
      [3, 'The numbers agree', 'done'],
      [4, 'Their acknowledgment', 'todo'],
    ])
    expect(ownerRecordsMissing(EMPTY_OWNER_RECORDS)).toEqual(['their request in writing', 'the contract check', 'their signed acknowledgment'])
    expect(ownerRecordsFootWords(EMPTY_OWNER_RECORDS, day)).toBe('Before it can be recorded as sent: their request in writing, the contract check, their signed acknowledgment.')
  })

  it('a full file says each check in words, and the packet can go', () => {
    expect(ownerRecordsSteps(full, numbers, day).map((s) => s.words)).toEqual([
      'Email from Umar Khan, 2026-10-05. Link on file.',
      'Checked 2026-10-05 by Malachi. No clause stops this.',
      '$26,537 matches the 3 notices.',
      'Signed 2026-10-06. No copy linked.',
    ])
    expect(ownerRecordsMissing(full)).toEqual([])
    expect(ownerRecordsFootWords(full, day)).toBe('All three are on file. The packet can go.')
  })

  it('the acknowledgment alone is not enough, and numbers that disagree warn without blocking', () => {
    expect(ownerRecordsMissing({ ...EMPTY_OWNER_RECORDS, acknowledgment: full.acknowledgment })).toEqual(['their request in writing', 'the contract check'])
    expect(ownerRecordsSteps(full, { agree: false, lines: ['$1,050 on job 881 has no notice.'] }, day)[2]!.state).toBe('warn')
    expect(ownerRecordsMissing(full)).toEqual([])
  })

  it('once sent, the foot says when, by whom and how', () => {
    expect(ownerRecordsFootWords({ ...full, sent: { at: '2026-10-07T15:00:00Z', by: 'Taunya', how: 'mail', total: 26537, jobIds: ['j273'] } }, day)).toBe('Sent 2026-10-07 by Taunya. Mailed.')
  })
})

describe('parseOwnerRecords', () => {
  it('reads a stored file and drops a part that does not parse', () => {
    expect(parseOwnerRecords({ request: { on: '2026-10-05', how: 'text', from: 'A', link: '' }, contractChecked: { by: 'M', at: '2026-10-05T16:00:00Z' }, acknowledgment: { signedOn: 'soon' }, sent: { at: '2026-10-07T15:00:00Z', by: 'T', how: 'pigeon', total: 12, jobIds: ['a', 4] } })).toEqual({
      request: { on: '2026-10-05', how: 'text', from: 'A', link: '' },
      contractChecked: { by: 'M', at: '2026-10-05T16:00:00Z' },
      acknowledgment: null,
      sent: { at: '2026-10-07T15:00:00Z', by: 'T', how: 'handed', total: 12, jobIds: ['a'] },
    })
    expect(parseOwnerRecords({})).toBeNull()
    expect(parseOwnerRecords(null)).toBeNull()
    expect(parseOwnerRecords('x')).toBeNull()
  })
})

describe('the picker', () => {
  const row = (jobId: string, owner: string, address: string, customerId: string, open: number, gcName = 'RMC- Dudley Mason') => ({ jobId, owner, address, addressId: null, gcName, open, customerId })
  const same = (a: { address: string }, b: { address: string }) => a.address === b.address

  it('folds the jobs of one owner at one property into a row, and keeps another owner at that address apart', () => {
    const rows = ownerRecordsProperties([row('a', 'Umar Khan', '9703 Lenox Hl', 'c1', 17585), row('b', 'Umar Khan', '9703 Lenox Hl', 'c1', 7902), row('c', 'A Tenant', '9703 Lenox Hl', 'c2', 100), row('d', 'Rizvi', '628 Terrell Rd', 'c3', 1710)], same)
    expect(rows.map((r) => [r.owner, r.address, r.jobs, r.open, r.seedJobId, r.sharesAddress])).toEqual([
      ['A Tenant', '9703 Lenox Hl', 1, 100, 'c', true],
      ['Rizvi', '628 Terrell Rd', 1, 1710, 'd', false],
      ['Umar Khan', '9703 Lenox Hl', 2, 25487, 'a', true],
    ])
    expect(ownerRecordsProperties([row('x', '  ', '1 A St', 'c9', 5)], same)[0]!.owner).toBe('Owner not on file')
  })

  it('finds a row by owner, address or GC', () => {
    const r = ownerRecordsProperties([row('a', 'Umar Khan', '9703 Lenox Hl', 'c1', 1)], same)[0]!
    expect(ownerRecordsPropertyMatches(r, 'lenox khan')).toBe(true)
    expect(ownerRecordsPropertyMatches(r, 'dudley')).toBe(true)
    expect(ownerRecordsPropertyMatches(r, 'terrell')).toBe(false)
    expect(ownerRecordsPropertyMatches(r, '  ')).toBe(true)
  })
})
