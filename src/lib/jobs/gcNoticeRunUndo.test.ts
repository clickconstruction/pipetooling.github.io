import { describe, expect, it } from 'vitest'
import { gcRunPolicyWords, gcRunReceiptHasUndo, gcRunUndoMessage, gcRunUndoPlan, gcRunUndoStripWords, type GcRunReceipt } from './gcNoticeRunUndo'
import { ownerShareTurnedOn } from './ownerBillShare'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `item-${i + 1}`)
const receipt = (over: Partial<GcRunReceipt> = {}): GcRunReceipt => ({ gcId: 'gc1', gcName: 'RMC- Dudley Mason', itemIds: ids(11), rule: null, terms: null, owners: null, legal: null, ...over })
const termsBefore = { payment_terms: null, payment_terms_note: null, payment_terms_set_by: null, payment_terms_set_at: null }

describe('gcRunUndoPlan', () => {
  it('a click that only approved: the notices go back, nothing stays', () => {
    expect(gcRunUndoPlan(receipt())).toEqual({ goesBack: ['11 notices go back to drafts. Nothing is mailed or recorded.'], stays: [] })
    expect(gcRunUndoPlan(receipt({ itemIds: ids(1) })).goesBack).toEqual(['1 notice goes back to a draft. Nothing is mailed or recorded.'])
  })

  it('every tick: the rule, the terms and the owners go back; the Legal desk matter stays', () => {
    const plan = gcRunUndoPlan(
      receipt({
        rule: { from: 'ask' },
        terms: { before: termsBefore, fromLabel: 'Standard' },
        owners: { turnedOn: { jobIds: ['j1'], invoiceIds: ['i1', 'i2'], on: true } },
        legal: { jobs: 22 },
      }),
    )
    expect(plan.goesBack).toEqual([
      '11 notices go back to drafts. Nothing is mailed or recorded.',
      'The standing rule goes back to Ask each time.',
      'Payment terms go back to Standard.',
      'The bills this run showed to owners are hidden from them again.',
    ])
    expect(plan.stays).toEqual(['The Legal desk matter. Close it on the Legal desk if you do not want it.'])
  })

  it('a share that turned nothing on is not listed', () => {
    expect(gcRunUndoPlan(receipt({ owners: { turnedOn: { jobIds: [], invoiceIds: [], on: true } } })).goesBack).toHaveLength(1)
  })

  it('names the rule it goes back to', () => {
    expect(gcRunPolicyWords('ask')).toBe('Ask each time')
    expect(gcRunPolicyWords('hold')).toBe('Hold')
    expect(gcRunPolicyWords('send')).toBe('Send without asking')
  })
})

describe('the words on screen', () => {
  it('the confirm window lists what goes back, then what stays', () => {
    expect(gcRunUndoMessage(receipt({ rule: { from: 'ask' }, legal: { jobs: 22 } }))).toBe(
      'This goes back:\n• 11 notices go back to drafts. Nothing is mailed or recorded.\n• The standing rule goes back to Ask each time.\n\nThis stays:\n• The Legal desk matter. Close it on the Legal desk if you do not want it.',
    )
    expect(gcRunUndoMessage(receipt())).toBe('This goes back:\n• 11 notices go back to drafts. Nothing is mailed or recorded.')
  })

  it('the strip says what was just done', () => {
    expect(gcRunUndoStripWords(receipt())).toBe('You just approved these 11 notices for RMC- Dudley Mason. Pressed it by mistake?')
    expect(gcRunUndoStripWords(receipt({ itemIds: ids(1) }))).toBe('You just approved this notice for RMC- Dudley Mason. Pressed it by mistake?')
  })

  it('no receipt, or one with no notices, offers nothing', () => {
    expect(gcRunReceiptHasUndo(null)).toBe(false)
    expect(gcRunReceiptHasUndo(receipt({ itemIds: [] }))).toBe(false)
    expect(gcRunReceiptHasUndo(receipt())).toBe(true)
  })
})

describe('ownerShareTurnedOn', () => {
  // A GC job billed to the GC, with the owner as the other party: the share applies.
  const job = (id: string, on: boolean) => ({ id, customer_id: 'owner1', gc_customer_id: 'gc1', bill_to_party: 'gc', customer_address_id: 'addr1', show_bills_to_other_party: on })
  const bill = (id: string, job_id: string, shown: string | null) => ({ id, job_id, status: 'billed', bill_to_party: 'gc', bill_to_email: null, shown_to_party: shown })

  it('lists only the jobs whose memory was off and the bills not yet shown', () => {
    const turned = ownerShareTurnedOn(
      [job('j1', false), job('j2', true)] as never,
      [bill('i1', 'j1', null), bill('i2', 'j2', 'customer'), bill('i3', 'j2', null)] as never,
    )
    expect(turned.on).toBe(true)
    expect(turned.jobIds).toEqual(['j1'])
    expect(turned.invoiceIds.sort()).toEqual(['i1', 'i3'])
  })
})
