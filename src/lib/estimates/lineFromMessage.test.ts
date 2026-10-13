import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { plainWordsFailures } from '../plainWords'
import {
  lineDescription,
  lineDraftFromMessage,
  becameChip,
  draftedWords,
  hasOptionsWords,
  onEstimateChip,
  pricedWords,
  whoMayDraft,
  whoMaySend,
  type LineContact,
  type LineEstimate,
  type LineJob,
  type LineMessage,
} from './lineFromMessage'
import { defaultDraftFirstLine } from './estimateDraftLines'

// Dana Whitfield, a residential customer, texts while the crew is on her Helotes job to ask for a new hose bib: card 8
// of the customer Messages integrations mockups (v0.2), its chip renamed by the lead. Made-up people and jobs, never a real row.
const DANA: LineContact = { id: 'dana', kind: 'customer', name: 'Dana Whitfield', customerId: 'c-dana' }

const HELOTES: LineJob = { id: 'j-helotes', name: 'Helotes', status: 'working', customerId: 'c-dana' }
const JOBS: LineJob[] = [
  HELOTES,
  { id: 'j-oak', name: 'Oakridge sewer line', status: 'billed', customerId: 'c-dana' },
  { id: 'j-heater', name: 'Water heater', status: 'paid', customerId: 'c-dana' },
  { id: 'j-ready', name: 'Kitchen repipe', status: 'ready_to_bill', customerId: 'c-dana' },
  { id: 'j-other', name: 'Alamo Heights remodel', status: 'working', customerId: 'c-other' },
]

const WATER_HEATER_LINE = { line_item: 'Water heater swap', description: '50 gallon gas', quantity: 1, unit_price_cents: 185000, amount_cents: 185000 }

const ESTIMATES: LineEstimate[] = [
  { id: 'e-1031', jobId: 'j-helotes', docKind: 'estimate', status: 'customer_accepted', number: 1031, lines: [WATER_HEATER_LINE] },
  { id: 'e-1044', jobId: 'j-helotes', docKind: 'estimate', status: 'draft', number: 1044, lines: [WATER_HEATER_LINE] },
  { id: 'e-1050', jobId: 'j-helotes', docKind: 'change_order', status: 'draft', number: 1050, lines: [] },
  { id: 'e-1046', jobId: 'j-other', docKind: 'estimate', status: 'draft', number: 1046, lines: [] },
]

/** Mon Oct 12 2026, 4:05 PM Central. */
const HOSE_BIB: LineMessage = {
  id: 'msg-hose-bib',
  contactId: 'dana',
  jobId: 'j-helotes',
  channel: 'text',
  direction: 'in',
  at: '2026-10-12T21:05:00Z',
  body: 'While you are here can you also replace the hose bib out front? The old one drips.',
}

const draftOf = (estimates: readonly LineEstimate[], message: LineMessage = HOSE_BIB, jobs: readonly LineJob[] = JOBS) => {
  const r = lineDraftFromMessage(message, DANA, jobs, estimates)
  if (!r.ok) throw new Error(r.words)
  return r.draft
}

describe('a line started from Dana’s hose bib text', () => {
  it('joins the open estimate on the job the text is tied to, signed by Dana, the text kept as its source', () => {
    expect(lineDraftFromMessage(HOSE_BIB, DANA, JOBS, ESTIMATES)).toEqual({
      ok: true,
      draft: {
        jobId: 'j-helotes',
        jobName: 'Helotes',
        signer: { contactId: 'dana', customerId: 'c-dana', name: 'Dana Whitfield' },
        sourceMessageId: 'msg-hose-bib',
        estimateId: 'e-1044',
        estimateNumber: 1044,
        line: { line_item: '', description: 'While you are here can you also replace the hose bib out front?', quantity: 1, unit_price_cents: 0, amount_cents: 0 },
        replacesLast: false,
        number: 2,
      },
    })
  })

  it('starts a new estimate when the job has no draft, never a sent or accepted one, never a change order', () => {
    const notOpen = ESTIMATES.filter((e) => e.id !== 'e-1044')
    expect(draftOf(notOpen)).toMatchObject({ estimateId: null, estimateNumber: null, number: 1, replacesLast: false })
    const sent = ESTIMATES.map((e) => (e.id === 'e-1044' ? { ...e, status: 'sent' } : e))
    expect(draftOf(sent).estimateId).toBeNull()
  })

  it('reuses the newest draft when the job has two', () => {
    const two = [...ESTIMATES, { id: 'e-1048', jobId: 'j-helotes', docKind: 'estimate', status: 'draft', number: 1048, lines: [] }]
    expect(draftOf(two)).toMatchObject({ estimateId: 'e-1048', number: 1 })
  })

  it('takes the place of a placeholder last line', () => {
    const stub = ESTIMATES.map((e) => (e.id === 'e-1044' ? { ...e, lines: [WATER_HEATER_LINE, defaultDraftFirstLine()] } : e))
    expect(draftOf(stub)).toMatchObject({ estimateId: 'e-1044', replacesLast: true, number: 2 })
  })

  it('takes a job that is ready to bill', () => {
    expect(draftOf(ESTIMATES, { ...HOSE_BIB, jobId: 'j-ready' })).toMatchObject({ jobId: 'j-ready', estimateId: null, number: 1 })
  })
})

describe('what it refuses, in words', () => {
  const refusal = (message: LineMessage, contact: LineContact = DANA) => {
    const r = lineDraftFromMessage(message, contact, JOBS, ESTIMATES)
    return r.ok ? null : [r.why, r.words]
  }

  it('a message with someone who is not a customer', () => {
    expect(refusal(HOSE_BIB, { id: 'greg', kind: 'trade', name: 'Greg Paulk' })).toEqual([
      'not a customer',
      'A line from a message goes on a customer\'s estimate. This message is with a trade partner.',
    ])
    expect(refusal(HOSE_BIB, { id: 'unk', kind: 'unknown', name: '(210) 555-0188' })?.[1]).toBe(
      'A line from a message goes on a customer\'s estimate. This message is with a number nobody has named yet.',
    )
  })

  it('a message on the person, with no job', () => {
    expect(refusal({ ...HOSE_BIB, jobId: null })).toEqual(['no job', 'Tie the message to a job first. An estimate belongs to one job.'])
  })

  it('a message tied to a job that is not theirs', () => {
    const words = ['not their job', 'This message is tied to a job that is not Dana Whitfield\'s. Tie it to one of their jobs first.']
    expect(refusal({ ...HOSE_BIB, jobId: 'j-other' })).toEqual(words)
    expect(refusal({ ...HOSE_BIB, jobId: 'bid-77' })).toEqual(words)
  })

  it('a job that is billed or paid', () => {
    expect(refusal({ ...HOSE_BIB, jobId: 'j-oak' })).toEqual(['job billed', 'Oakridge sewer line is billed already. Start the work as a new job.'])
    expect(refusal({ ...HOSE_BIB, jobId: 'j-heater' })).toEqual(['job billed', 'Water heater is paid and closed. Start the work as a new job.'])
  })
})

describe('the description', () => {
  it('is the first sentence of the first line', () => {
    expect(lineDescription('Can you add a shutoff? Thanks!\nSent from my phone')).toBe('Can you add a shutoff?')
  })

  it('is cut at a word when it runs past 160 characters', () => {
    const long = `Please ${'replace the hose bib and the valve behind it '.repeat(5)}today`
    const d = lineDescription(long)
    expect(d.endsWith('…')).toBe(true)
    expect(d.length).toBeLessThanOrEqual(161)
    expect(long.startsWith(d.slice(0, -1))).toBe(true)
    expect(long[d.length - 1]).toBe(' ')
  })
})

describe('who may draft and send it', () => {
  const roles: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor']

  it('anyone in the office drafts it', () => {
    expect(roles.filter(whoMayDraft)).toEqual(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])
  })

  it('the money team sends it', () => {
    expect(roles.filter(whoMaySend)).toEqual(['dev', 'master_technician', 'controller'])
    expect(whoMaySend(null)).toBe(false)
  })
})

describe('the chip and the lines after', () => {
  it('says what the message became, $0 until priced', () => {
    expect(becameChip({ number: 2, estimateNumber: 1044, amountCents: 0 })).toBe('became line 2 on estimate 1044, $0 until priced')
    expect(becameChip({ number: 1, estimateNumber: null, amountCents: 0 })).toBe('became line 1 on a new estimate, $0 until priced')
    expect(becameChip({ number: 2, estimateNumber: 1044, amountCents: 18500 })).toBe('became line 2 on estimate 1044, $185')
    expect(becameChip({ number: 1, estimateNumber: 1051, amountCents: 18550 })).toBe('became line 1 on estimate 1051, $185.50')
    expect(becameChip({ number: 3, estimateNumber: 1044, amountCents: 185000 })).toBe('became line 3 on estimate 1044, $1,850')
  })

  it('says the estimate a message is on when the thread reads it back, and why one with options takes no line', () => {
    expect(onEstimateChip(1044)).toBe('a line on estimate 1044')
    expect(hasOptionsWords(1044)).toBe('Estimate 1044 has options. Add the line on the estimate itself.')
  })

  it('tells the office where the draft went', () => {
    expect(draftedWords(draftOf(ESTIMATES))).toBe('Line 2 is drafted on estimate 1044 for Helotes. The money team prices it and sends it.')
    expect(draftedWords(draftOf([]))).toBe('Line 1 is drafted on a new estimate for Helotes. The money team prices it and sends it.')
  })

  it('writes the line back to the customer once it is priced, and none before', () => {
    expect(pricedWords('Dana', { amountCents: 0 }, 'Helotes')).toBeNull()
    expect(pricedWords('Dana', { amountCents: 18500 }, 'Helotes')).toBe(
      'Dana, the work you asked about is $185. It is on your estimate for Helotes. Approve it there and we will do it.',
    )
  })

  it('every sentence a person reads passes plain words', () => {
    const refusals = [
      lineDraftFromMessage(HOSE_BIB, { id: 'greg', kind: 'trade', name: 'Greg Paulk' }, JOBS, ESTIMATES),
      lineDraftFromMessage({ ...HOSE_BIB, jobId: null }, DANA, JOBS, ESTIMATES),
      lineDraftFromMessage({ ...HOSE_BIB, jobId: 'j-other' }, DANA, JOBS, ESTIMATES),
      lineDraftFromMessage({ ...HOSE_BIB, jobId: 'j-oak' }, DANA, JOBS, ESTIMATES),
      lineDraftFromMessage({ ...HOSE_BIB, jobId: 'j-heater' }, DANA, JOBS, ESTIMATES),
    ].flatMap((r) => (r.ok ? [] : [r.words]))
    const texts = [
      ...refusals,
      becameChip({ number: 2, estimateNumber: 1044, amountCents: 0 }),
      becameChip({ number: 1, estimateNumber: null, amountCents: 0 }),
      becameChip({ number: 2, estimateNumber: 1044, amountCents: 18500 }),
      draftedWords(draftOf(ESTIMATES)),
      draftedWords(draftOf([])),
      pricedWords('Dana', { amountCents: 18500 }, 'Helotes')!,
      onEstimateChip(1044),
      hasOptionsWords(1044),
    ]
    expect(refusals).toHaveLength(5)
    expect(texts.flatMap(plainWordsFailures)).toEqual([])
  })
})
