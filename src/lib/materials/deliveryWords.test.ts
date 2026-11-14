import { describe, expect, it } from 'vitest'
import { deliveryAgainWords, deliveryOutcomeWords, notReadHead } from './deliveryWords'

describe('the Deliveries panel’s words', () => {
  it('says one sentence once the press is answered, and nothing of its own on a refusal', () => {
    expect(deliveryOutcomeWords('landed', 12, 'INV-48812')).toEqual({ line: '12 lines from INV-48812 landed in Unsorted as a delivery.', tone: 'success' })
    expect(deliveryOutcomeWords('landed', 1, 'invoice')).toEqual({ line: '1 line from invoice landed in Unsorted as a delivery.', tone: 'success' })
    expect(deliveryOutcomeWords('queued', 12, 'INV-48812')).toEqual({ line: '12 lines from INV-48812 are kept on this device. They send by themselves when the signal is back.', tone: 'info' })
    expect(deliveryOutcomeWords('queued', 1, 'INV-48812')!.line).toBe('1 line from INV-48812 is kept on this device. It sends by itself when the signal is back.')
    // The store says a refusal with the office's reason. A second sentence here would say less.
    expect(deliveryOutcomeWords('refused', 12, 'INV-48812')).toBeNull()
    expect(deliveryOutcomeWords('failed', 12, 'INV-48812')).toBeNull()
  })
  it('names the act on the window that asks before an invoice lands twice', () => {
    const w = deliveryAgainWords('INV-48812', 6, 6)
    expect(w.note).toBe('INV-48812 already landed 6 lines on this job.')
    expect(w.message).toBe('INV-48812 already landed 6 lines on this job. Adding these 6 lines again adds to what the job is said to hold. A count would then read the extra as walked away.')
    expect(w.confirmLabel).toBe('Add 6 lines again')
    expect(deliveryAgainWords('INV-9', 1, 1)).toMatchObject({ note: 'INV-9 already landed 1 line on this job.', confirmLabel: 'Add 1 line again' })
  })
  it('heads the lines that did not read', () => {
    expect(notReadHead(1)).toBe('1 line was not read. Add it as a line, or leave it out.')
    expect(notReadHead(3)).toBe('3 lines were not read. Add each as a line, or leave it out.')
  })
})
