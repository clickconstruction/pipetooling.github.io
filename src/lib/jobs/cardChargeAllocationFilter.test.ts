import { describe, expect, it } from 'vitest'
import {
  EMPTY_CARD_CHARGE_EXCLUSIONS,
  cardChargeAllocationCounts,
  cardChargeAllocationIsInvoiceLinked,
  sumCardChargeAllocationsForJob,
  summarizeCardChargeAllocations,
  type CardChargeExclusions,
} from './cardChargeAllocationFilter'

const plain = { id: 'a1', job_id: 'J1', mercury_transaction_id: 'tx-plain', amount: -100 }
const internal = { id: 'a2', job_id: 'J1', mercury_transaction_id: 'tx-internal', amount: -500 }
const linked = { id: 'a3', job_id: 'J1', mercury_transaction_id: 'tx-linked', amount: -40 }
const fuel = { id: 'a4', job_id: 'J2', mercury_transaction_id: 'tx-fuel', amount: 25 }
const rows = [plain, internal, linked, fuel]

const exclusions: CardChargeExclusions = {
  bucketByTxId: new Map([
    ['tx-internal', 'internal_transfer'],
    ['tx-fuel', 'fuel_gas'],
  ]),
  invoiceLinkedTxIds: new Set(['tx-linked']),
}

describe('cardChargeAllocationFilter', () => {
  it('drops Internal-Transfers-bucketed rows and keeps every other bucket', () => {
    expect(cardChargeAllocationCounts(internal, exclusions)).toBe(false)
    expect(cardChargeAllocationCounts(plain, exclusions)).toBe(true)
    expect(cardChargeAllocationCounts(fuel, exclusions)).toBe(true)
  })

  it('flags invoice-linked rows without removing them from the gross total', () => {
    expect(cardChargeAllocationIsInvoiceLinked(linked, exclusions)).toBe(true)
    expect(cardChargeAllocationIsInvoiceLinked(plain, exclusions)).toBe(false)
    const s = summarizeCardChargeAllocations(rows, exclusions)
    expect(s.chargesByJobId.get('J1')).toBe(140) // 100 plain + 40 linked; the 500 internal transfer is gone
    expect(s.invoiceLinkedByJobId.get('J1')).toBe(40)
    expect(s.chargesByJobId.get('J2')).toBe(25)
    expect(s.invoiceLinkedByJobId.has('J2')).toBe(false)
    expect(s.counted.map((r) => r.id)).toEqual(['a1', 'a3', 'a4'])
  })

  it('the one-job sum equals the bulk map entry for the same rows (the #3b asymmetry)', () => {
    const bulk = summarizeCardChargeAllocations(rows, exclusions)
    const j1 = sumCardChargeAllocationsForJob(
      rows.filter((r) => r.job_id === 'J1'),
      exclusions,
    )
    expect(j1.charges).toBe(bulk.chargesByJobId.get('J1'))
    expect(j1.invoiceLinked).toBe(bulk.invoiceLinkedByJobId.get('J1'))
  })

  it('degrades to "everything counts, nothing linked" with empty exclusions', () => {
    const s = summarizeCardChargeAllocations(rows, EMPTY_CARD_CHARGE_EXCLUSIONS)
    expect(s.chargesByJobId.get('J1')).toBe(640)
    expect(s.invoiceLinkedByJobId.size).toBe(0)
    expect(sumCardChargeAllocationsForJob([], exclusions)).toEqual({ charges: 0, invoiceLinked: 0 })
  })
})
