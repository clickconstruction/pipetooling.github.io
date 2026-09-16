import { describe, expect, it } from 'vitest'
import { summarizeCardChargeAllocations, type CardChargeExclusions } from './cardChargeAllocationFilter'
import { netCardChargesByJobId } from './netCardChargesByJob'

const exclusions: CardChargeExclusions = {
  bucketByTxId: new Map([['tx-internal', 'internal_transfer']]),
  invoiceLinkedTxIds: new Set(['tx-linked']),
}

describe('netCardChargesByJobId', () => {
  it('drops internal transfers and counts an invoice-linked charge once — the Job Summary rule', () => {
    const rows = [
      { job_id: 'J963', mercury_transaction_id: 'tx-plain', amount: -710 },
      { job_id: 'J963', mercury_transaction_id: 'tx-internal', amount: -500 },
      { job_id: 'J963', mercury_transaction_id: 'tx-linked', amount: -255 },
      { job_id: 'J2', mercury_transaction_id: 'tx-other', amount: -30 },
    ]
    const net = netCardChargesByJobId(summarizeCardChargeAllocations(rows, exclusions))
    expect(net.get('J963')).toBe(710)
    expect(net.get('J2')).toBe(30)
  })

  it('a job whose parts all went back reads a net credit, not zero (v2.3519)', () => {
    const rows = [
      { job_id: 'J1', mercury_transaction_id: 'tx-buy', amount: -80 },
      { job_id: 'J1', mercury_transaction_id: 'tx-refund', amount: 100 },
    ]
    expect(netCardChargesByJobId(summarizeCardChargeAllocations(rows, exclusions)).get('J1')).toBe(-20)
  })

  it('a job with no card rows has no entry', () => {
    expect(netCardChargesByJobId({ chargesByJobId: new Map(), invoiceLinkedByJobId: new Map() }).size).toBe(0)
  })
})
