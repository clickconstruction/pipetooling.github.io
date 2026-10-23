import { describe, expect, it } from 'vitest'
import { CONTRACT_CHOICES, contractChoiceAvailable, contractDecisionReady, contractFillInRows, contractKnows, contractTrailWords, contractWrites, emptyContractDecision, type ContractJobSource, type ContractRowSource } from './fillInContracts'

const NOW = new Date('2026-10-23T16:00:00Z')
const job = (p: Partial<ContractJobSource> = {}): ContractJobSource => ({ id: 'j-1', bid_id: null, status: 'working', revenue: 7450, hcp_number: '1038', click_number: null, job_name: 'Dana Whitfield', customer_name: 'Dana Whitfield', job_address: '9 Maple St', ...p })
const contract = (p: Partial<ContractRowSource> = {}): ContractRowSource => ({
  id: 'c-1',
  job_id: 'j-1',
  status: 'sent',
  revision: 1,
  recipient_email: 'dana@example.com',
  recipient_name: 'Dana Whitfield',
  recipient_phone: '(210) 555-0100',
  sent_at: '2026-09-24T15:00:00Z',
  last_sent_at: '2026-09-24T15:00:00Z',
  view_count: 2,
  signed_at: null,
  signer_printed_name: null,
  signer_mode: null,
  voided_at: null,
  signed_document_url: null,
  signer_consented_at: null,
  co_signer_name: null,
  co_signed_at: null,
  co_signer_printed_name: null,
  co_signer_mode: null,
  ...p,
})

describe('fillInContracts · the rows (punch list #146)', () => {
  it('one row per stale sent agreement by its last send, longest out first, the Contract window as the door', () => {
    const rows = contractFillInRows({
      jobs: [job(), job({ id: 'j-2', hcp_number: '1051', job_name: 'Cedar Loop clinic', customer_name: null, revenue: 22000 }), job({ id: 'j-3', job_name: 'fresh' })],
      contracts: [contract(), contract({ id: 'c-2', job_id: 'j-2', sent_at: '2026-10-10T15:00:00Z', last_sent_at: '2026-10-10T15:00:00Z', view_count: 0, recipient_phone: null }), contract({ id: 'c-3', job_id: 'j-3', sent_at: '2026-10-20T15:00:00Z', last_sent_at: '2026-10-20T15:00:00Z' })],
      estimates: [],
      now: NOW,
      floorCents: 0,
    })
    expect(rows.map((r) => r.key)).toEqual(['contract:c-1', 'contract:c-2'])
    expect(rows[0]!.title).toBe('#1038 Dana Whitfield · sent Sep 24 · $7,450 · 29 days unsigned')
    expect(rows[0]!.doorHref).toBe('/jobs?tab=stages&edit=j-1&editFocus=contract')
    expect(rows[1]!.knows).toEqual(['Sent to dana@example.com with the signing link.', 'Never opened.', 'No mobile on file.'])
  })

  it('says what the app knows', () => {
    expect(contractKnows({ customerName: 'Dana Whitfield', recipientEmail: 'dana@example.com', recipientPhone: '(210) 555-0100', viewCount: 1, framesWaiting: 'Sam Owner signed · waiting on Alex Owner' })).toEqual([
      'The customer is Dana Whitfield.',
      'Sent to dana@example.com with the signing link.',
      'Opened once, never signed.',
      'A mobile is on file: (210) 555-0100.',
      'Sam Owner signed · waiting on Alex Owner.',
    ])
  })

  it('offers only the doors the row can take, and paper needs a signer and a day', () => {
    const [row] = contractFillInRows({ jobs: [job()], contracts: [contract({ recipient_phone: null })], estimates: [], now: NOW, floorCents: 0 })
    expect(CONTRACT_CHOICES.map((c) => c.key)).toEqual(['resend', 'text', 'paper'])
    expect(contractChoiceAvailable(row!, 'resend')).toBe(true)
    expect(contractChoiceAvailable(row!, 'text')).toBe(false)
    const d = emptyContractDecision(row!, '2026-10-23')
    expect(d.signerName).toBe('Dana Whitfield')
    expect(contractDecisionReady(row!, d)).toBe(false)
    expect(contractDecisionReady(row!, { ...d, choice: 'text' })).toBe(false)
    expect(contractDecisionReady(row!, { ...d, choice: 'resend' })).toBe(true)
    expect(contractDecisionReady(row!, { ...d, choice: 'paper', signerName: '' })).toBe(false)
    expect(contractDecisionReady(row!, { ...d, choice: 'paper' })).toBe(true)
  })

  it('the writes are the window’s doors, and the trail says what each leaves behind', () => {
    const [row] = contractFillInRows({ jobs: [job()], contracts: [contract()], estimates: [], now: NOW, floorCents: 0 })
    const d = emptyContractDecision(row!, '2026-10-23')
    const resend = contractWrites(row!, { ...d, choice: 'resend', message: ' a line ' })!
    expect(resend).toEqual({ choice: 'resend', contractId: 'c-1', recipientEmail: 'dana@example.com', recipientName: 'Dana Whitfield', message: 'a line' })
    expect(contractTrailWords(resend, row!)).toBe('the signing link went to dana@example.com again · still unsigned, so it stays on the Dashboard')
    const text = contractWrites(row!, { ...d, choice: 'text' })!
    expect(text.choice).toBe('text')
    if (text.choice === 'text') {
      expect(text.phone).toBe('2105550100')
      expect(text.body('https://x/s/1')).toBe('Here is your service agreement for 9 Maple St — review and sign here: https://x/s/1')
    }
    const paper = contractWrites(row!, { ...d, choice: 'paper', signedOn: '2026-10-09', link: ' https://drive/x ' })!
    expect(paper).toEqual({ choice: 'paper', contractId: 'c-1', jobId: 'j-1', signerName: 'Dana Whitfield', signedOn: '2026-10-09', link: 'https://drive/x', file: null })
    expect(contractTrailWords(paper, row!)).toBe('signed on paper Oct 9 by Dana Whitfield · on file as signed')
    expect(contractWrites(row!, d)).toBeNull()
  })
})
