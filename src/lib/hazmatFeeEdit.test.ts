import { describe, expect, it } from 'vitest'
import { hazmatFeeMutationBlocker, hazmatFeeRemovalCapability } from './hazmatFeeEdit'

const openInvoice = { status: 'ready_to_bill', stripe_invoice_id: null, sent_to_customer_at: null, external_send_channel: null }

describe('hazmatFeeMutationBlocker', () => {
  it('allows unlinked and linked-to-open incidents', () => {
    expect(hazmatFeeMutationBlocker({ voided_at: null }, null)).toBeNull()
    expect(hazmatFeeMutationBlocker({ voided_at: null }, openInvoice)).toBeNull()
    expect(hazmatFeeMutationBlocker({ voided_at: null }, { ...openInvoice, status: 'draft' })).toBeNull()
  })
  it('blocks voided incidents', () => {
    expect(hazmatFeeMutationBlocker({ voided_at: '2026-07-28T00:00:00Z' }, null)).toMatch(/voided/)
  })
  it('blocks once the linked bill is sent/billed in any way', () => {
    expect(hazmatFeeMutationBlocker({ voided_at: null }, { ...openInvoice, status: 'billed' })).toMatch(/sent bill/)
    expect(hazmatFeeMutationBlocker({ voided_at: null }, { ...openInvoice, stripe_invoice_id: 'in_123' })).toMatch(/sent bill/)
    expect(hazmatFeeMutationBlocker({ voided_at: null }, { ...openInvoice, sent_to_customer_at: '2026-07-28' })).toMatch(/sent bill/)
    expect(hazmatFeeMutationBlocker({ voided_at: null }, { ...openInvoice, external_send_channel: 'stripe' })).toMatch(/sent bill/)
  })
})

describe('hazmatFeeRemovalCapability', () => {
  it('devs, masters, and controllers delete; assistants void; others nothing', () => {
    expect(hazmatFeeRemovalCapability('dev')).toBe('delete')
    expect(hazmatFeeRemovalCapability('master_technician')).toBe('delete')
    expect(hazmatFeeRemovalCapability('controller')).toBe('delete')
    expect(hazmatFeeRemovalCapability('assistant')).toBe('void')
    expect(hazmatFeeRemovalCapability('subcontractor')).toBeNull()
    expect(hazmatFeeRemovalCapability('helpers')).toBeNull()
    expect(hazmatFeeRemovalCapability(null)).toBeNull()
  })
})
