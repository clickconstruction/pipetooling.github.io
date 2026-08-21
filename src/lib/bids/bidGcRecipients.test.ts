import { describe, expect, it } from 'vitest'

import { expandLensBidByRecipients, looksLikeCombinedGcName, type BidGcRecipient } from './bidGcRecipients'

const structura: BidGcRecipient = { customerId: 'gc-structura', name: 'Structura', phone: '512-555-0100' }
const joeris: BidGcRecipient = { customerId: 'gc-joeris', name: 'Joeris', phone: null }

const entry = { builderKey: 'gc-knight', builderName: 'Knight Contracting', id: 'bid-1' }

describe('expandLensBidByRecipients', () => {
  it('no recipients → just the primary entry', () => {
    const out = expandLensBidByRecipients(entry, undefined)
    expect(out).toHaveLength(1)
    expect(out[0]!.viaRecipient).toBeNull()
    expect(out[0]!.builderKey).toBe('gc-knight')
  })

  it('emits one copy per recipient with the recipient as the builder', () => {
    const out = expandLensBidByRecipients(entry, [structura, joeris])
    expect(out).toHaveLength(3)
    expect(out[1]).toMatchObject({ builderKey: 'gc-structura', builderName: 'Structura', id: 'bid-1' })
    expect(out[1]!.viaRecipient).toEqual(structura)
    expect(out[2]).toMatchObject({ builderKey: 'gc-joeris', builderName: 'Joeris' })
  })

  it('skips a recipient that matches the primary builder key', () => {
    const out = expandLensBidByRecipients(entry, [{ customerId: 'gc-knight', name: 'Knight', phone: null }, joeris])
    expect(out).toHaveLength(2)
    expect(out.map((e) => e.builderKey)).toEqual(['gc-knight', 'gc-joeris'])
  })

  it('copies keep every other field of the source entry', () => {
    const rich = { ...entry, value: 5, category: null }
    const out = expandLensBidByRecipients(rich, [structura])
    expect(out[1]).toMatchObject({ value: 5, category: null })
  })
})

describe('looksLikeCombinedGcName', () => {
  it('flags the known combined-name shapes', () => {
    expect(looksLikeCombinedGcName("Multiple GC's")).toBe(true)
    expect(looksLikeCombinedGcName('Multiple GCs')).toBe(true)
    expect(looksLikeCombinedGcName('Banyan Construction / 20 Twenty Construction / Fairbanks')).toBe(true)
  })

  it('leaves real company names alone', () => {
    expect(looksLikeCombinedGcName('H & I Construction')).toBe(false)
    expect(looksLikeCombinedGcName('RMC- Dudley Mason')).toBe(false)
    expect(looksLikeCombinedGcName('H&I Construction')).toBe(false)
    expect(looksLikeCombinedGcName('')).toBe(false)
    expect(looksLikeCombinedGcName(null)).toBe(false)
  })
})
