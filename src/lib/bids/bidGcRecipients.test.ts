import { describe, expect, it } from 'vitest'

import { expandLensBidByRecipients, looksLikeCombinedGcName, type BidGcRecipient } from './bidGcRecipients'

const sheffield: BidGcRecipient = { customerId: 'gc-sheffield', name: 'Sheffield', phone: '512-555-0100' }
const joeris: BidGcRecipient = { customerId: 'gc-joeris', name: 'Joeris', phone: null }

const entry = { builderKey: 'gc-kestrin', builderName: 'Kestrin Contracting', id: 'bid-1' }

describe('expandLensBidByRecipients', () => {
  it('no recipients → just the primary entry', () => {
    const out = expandLensBidByRecipients(entry, undefined)
    expect(out).toHaveLength(1)
    expect(out[0]!.viaRecipient).toBeNull()
    expect(out[0]!.builderKey).toBe('gc-kestrin')
  })

  it('emits one copy per recipient with the recipient as the builder', () => {
    const out = expandLensBidByRecipients(entry, [sheffield, joeris])
    expect(out).toHaveLength(3)
    expect(out[1]).toMatchObject({ builderKey: 'gc-sheffield', builderName: 'Sheffield', id: 'bid-1' })
    expect(out[1]!.viaRecipient).toEqual(sheffield)
    expect(out[2]).toMatchObject({ builderKey: 'gc-joeris', builderName: 'Joeris' })
  })

  it('skips a recipient that matches the primary builder key', () => {
    const out = expandLensBidByRecipients(entry, [{ customerId: 'gc-kestrin', name: 'Kestrin', phone: null }, joeris])
    expect(out).toHaveLength(2)
    expect(out.map((e) => e.builderKey)).toEqual(['gc-kestrin', 'gc-joeris'])
  })

  it('copies keep every other field of the source entry', () => {
    const rich = { ...entry, value: 5, category: null }
    const out = expandLensBidByRecipients(rich, [sheffield])
    expect(out[1]).toMatchObject({ value: 5, category: null })
  })
})

describe('looksLikeCombinedGcName', () => {
  it('flags the known combined-name shapes', () => {
    expect(looksLikeCombinedGcName("Multiple GC's")).toBe(true)
    expect(looksLikeCombinedGcName('Multiple GCs')).toBe(true)
    expect(looksLikeCombinedGcName('Baxter Construction / 20 Twenty Construction / Fielding')).toBe(true)
  })

  it('leaves real company names alone', () => {
    expect(looksLikeCombinedGcName('B & D Construction')).toBe(false)
    expect(looksLikeCombinedGcName('RLC- Dunmere Mallin')).toBe(false)
    expect(looksLikeCombinedGcName('H&I Calloway')).toBe(false)
    expect(looksLikeCombinedGcName('')).toBe(false)
    expect(looksLikeCombinedGcName(null)).toBe(false)
  })
})
