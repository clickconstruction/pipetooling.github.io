import { describe, expect, it } from 'vitest'
import { contractRowChip, contractRowChipForJob, contractRowIsGcJob, type ContractRowChipInput, type ContractRowJob } from './contractRowChip'
import type { JobContractCoverage } from './jobContractCoverage'

const TODAY = '2026-10-01' // a Thursday

function input(over: Partial<ContractRowChipInput> = {}): ContractRowChipInput {
  return {
    coverage: { kind: 'none' },
    status: 'working',
    revenue: 350,
    gcCustomerId: null,
    customerId: 'cust-1',
    gcName: null,
    nextBookedYmd: null,
    workStarted: false,
    workedThisWeek: false,
    todayYmd: TODAY,
    ...over,
  }
}

function shown(over: Partial<ContractRowChipInput> = {}) {
  const chip = contractRowChip(input(over))
  if (!chip.show) throw new Error('expected a chip')
  return chip
}

const signed: JobContractCoverage = {
  kind: 'signed',
  source: 'estimate',
  signedAt: '2026-09-20T15:00:00Z',
  signerName: 'Sharon Kane',
  contractId: null,
  estimateNumber: 150,
  estimateId: 'est-150',
}

describe('contractRowChip', () => {
  it('draws no chip on a Paid in Full row, whatever is on file', () => {
    expect(contractRowChip(input({ status: 'paid' }))).toEqual({ show: false })
    expect(contractRowChip(input({ status: 'paid', coverage: signed }))).toEqual({ show: false })
  })

  it('asks for the contract by the first booked day when the crew has not started (Cano Camera)', () => {
    const chip = shown({ nextBookedYmd: '2026-10-03' })
    expect(chip.label).toBe('Contract by Sat Oct 3 · 2d')
    expect(chip.tone).toBe('ask')
    expect(chip.opens).toBe('contract')
    expect(chip.title).toContain('booked for Sat Oct 3')
  })

  it('says today when the first booked day is today', () => {
    expect(shown({ status: 'waiting', nextBookedYmd: TODAY }).label).toBe('Contract by Thu Oct 1 · today')
  })

  it('reads crew on site once the crew has started and is booked or working this week (Megan Connell)', () => {
    expect(shown({ nextBookedYmd: TODAY, workStarted: true, workedThisWeek: true }).label).toBe('No contract · crew on site')
    expect(shown({ workStarted: true, workedThisWeek: true }).tone).toBe('ask')
    expect(shown({ nextBookedYmd: '2026-10-05', workStarted: true }).label).toBe('No contract · crew on site')
  })

  it('stays the grey No contract with no date on the calendar', () => {
    const quiet = shown({ workStarted: true })
    expect(quiet.label).toBe('No contract')
    expect(quiet.tone).toBe('none')
    expect(shown({ status: 'waiting' }).tone).toBe('none')
  })

  it('stays grey when the job has no price, even with a crew booked', () => {
    for (const revenue of [null, 0, '0', '']) {
      const chip = shown({ revenue, nextBookedYmd: '2026-10-03' })
      expect(chip.label).toBe('No contract')
      expect(chip.tone).toBe('none')
      expect(chip.title).toContain('Price the job first')
    }
  })

  it('treats a saved draft as a gap: the ask follows the schedule and the words say draft', () => {
    const chip = shown({ coverage: { kind: 'draft', contractId: 'c1' }, nextBookedYmd: '2026-10-03' })
    expect(chip.label).toBe('Contract by Sat Oct 3 · 2d')
    expect(chip.title).toContain('draft is saved but not sent')
    expect(shown({ coverage: { kind: 'draft', contractId: 'c1' } }).label).toBe('Contract draft')
  })

  it('reads No subcontract on file on a GC job and opens the GC paper sheet, in every unpaid stage', () => {
    for (const status of ['waiting', 'working', 'ready_to_bill', 'billed']) {
      const chip = shown({ status, gcCustomerId: 'gc-dudley', gcName: 'RMC- Dudley Mason', nextBookedYmd: '2026-10-03' })
      expect(chip.label).toBe('No subcontract on file')
      expect(chip.tone).toBe('none')
      expect(chip.opens).toBe('gc-paper')
      expect(chip.title).toContain('RMC- Dudley Mason')
    }
  })

  it('keeps the words a GC job already has once something is on file or a draft of ours is started', () => {
    const sent: JobContractCoverage = { kind: 'sent', contractId: 'c9', revision: 1, sentAt: '2026-09-23T15:00:00Z', viewCount: 0, recipientEmail: 'pm@tfharper.test' }
    const chip = shown({ coverage: sent, gcCustomerId: 'gc-tf', gcName: 'TF Harper' })
    expect(chip.label.startsWith('Contract sent')).toBe(true)
    expect(chip.tone).toBe('sent')
    expect(chip.opens).toBe('contract')
    expect(shown({ coverage: { kind: 'draft', contractId: 'd' }, gcCustomerId: 'gc-tf' }).opens).toBe('contract')
  })

  it('keeps signed and Not needed as they read today', () => {
    expect(shown({ coverage: signed }).label).toBe('✍ Signed · estimate #150')
    expect(shown({ coverage: signed }).tone).toBe('signed')
    const nn = shown({ coverage: { kind: 'not_needed', at: '2026-09-20T15:00:00Z', reason: 'Service call' } })
    expect(nn.label).toBe('No contract · not needed')
    expect(nn.tone).toBe('not_needed')
  })

  it('keeps the grey No contract on a direct Billed row (job 1009 shape without its GC)', () => {
    const chip = shown({ status: 'billed', nextBookedYmd: null, workStarted: true })
    expect(chip.label).toBe('No contract')
    expect(chip.tone).toBe('none')
    expect(chip.opens).toBe('contract')
  })

  it('gives the phone row short words on an ask only', () => {
    expect(shown({ nextBookedYmd: '2026-10-03' }).phoneLabel).toBe('contract by Sat Oct 3')
    expect(shown({ workStarted: true, workedThisWeek: true }).phoneLabel).toBe('no contract · crew on site')
    expect(shown({}).phoneLabel).toBeUndefined()
    expect(shown({ gcCustomerId: 'gc', nextBookedYmd: '2026-10-03' }).phoneLabel).toBeUndefined()
  })

  it('a job whose GC is its own customer is not a GC job', () => {
    expect(contractRowIsGcJob({ gcCustomerId: 'a', customerId: 'a' })).toBe(false)
    expect(contractRowIsGcJob({ gcCustomerId: 'a', customerId: null })).toBe(true)
    expect(contractRowIsGcJob({ gcCustomerId: null, customerId: 'a' })).toBe(false)
  })
})

describe('contractRowChipForJob', () => {
  const job: ContractRowJob = { status: 'working', revenue: 37745, gc_customer_id: null, customer_id: 'c', last_work_date: null, pct_complete: null }
  const feeds = { coverage: { kind: 'none' } as JobContractCoverage, upcoming: null, weekSoFar: null, todayYmd: TODAY }

  it('reads the booked day off the upcoming feed', () => {
    const chip = contractRowChipForJob(job, { ...feeds, upcoming: { ymd: '2026-10-03' } })
    expect(chip.show && chip.label).toBe('Contract by Sat Oct 3 · 2d')
  })

  it('counts an approved clock day, a clock-in this week, a past booked day or a % done as started', () => {
    const on = (j: Partial<typeof job>, week: { worked: unknown[]; bookedYmds: string[] } | null) => {
      const chip = contractRowChipForJob({ ...job, ...j }, { ...feeds, upcoming: { ymd: TODAY }, weekSoFar: week })
      return chip.show ? chip.label : null
    }
    expect(on({ last_work_date: '2026-09-30' }, null)).toBe('No contract · crew on site')
    expect(on({}, { worked: [{}], bookedYmds: [] })).toBe('No contract · crew on site')
    expect(on({}, { worked: [], bookedYmds: ['2026-09-29'] })).toBe('No contract · crew on site')
    expect(on({ pct_complete: 30 }, null)).toBe('No contract · crew on site')
    expect(on({}, { worked: [], bookedYmds: [] })).toBe('Contract by Thu Oct 1 · today')
  })

  it('a clock-in this week with nothing booked ahead still reads crew on site', () => {
    const chip = contractRowChipForJob(job, { ...feeds, weekSoFar: { worked: [{}], bookedYmds: [] } })
    expect(chip.show && chip.label).toBe('No contract · crew on site')
  })

  it('names the GC from the job', () => {
    const chip = contractRowChipForJob({ ...job, gc_customer_id: 'gc', gcCustomer: { name: 'Knight Contracting' } } as never, feeds)
    expect(chip.show && chip.title).toContain('Knight Contracting')
  })
})
