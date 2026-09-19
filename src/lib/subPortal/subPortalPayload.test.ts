import { describe, expect, it } from 'vitest'
import { parseSubPortalPayload } from './subPortalPayload'

describe('parseSubPortalPayload (v2.2789 fields)', () => {
  it('reads sheet work order extras and the signed agreement, defaulting when absent', () => {
    const payload = parseSubPortalPayload({
      subName: 'Danny',
      totals: { earned: 1, paid: 0, open: 1 },
      sheets: [
        { id: 's1', items: [], agreement: { signedOn: '2026-08-20', signerName: 'Danny', amount: 3400, lines: [{ label: 'Top out' }], exclusions: ['x'], references: [{ kind: 'setting', name: 'Pay' }], acknowledgements: ['A'] } },
        { id: 's2', items: [] },
      ],
      offers: [
        { id: 'o1', title: 'J977', lines: [], total: 10, anchor: 'sheet', exclusions: ['Sales tax'], references: [{ name: 'GC', versionDate: '2026-06-19' }], acknowledgements: ['A', 7, ''], bond: 'furnished', specialProvisions: ' Owner supplies fixtures. ' },
        { id: 'o2', title: 'Rough-in', lines: [], total: 5 },
      ],
    })
    expect(payload).not.toBeNull()
    const [s1, s2] = payload!.sheets
    expect(s1!.agreement?.signerName).toBe('Danny')
    expect(s1!.agreement?.lines).toEqual([{ label: 'Top out', amount: null }])
    expect(s1!.agreement?.references).toEqual([{ kind: 'setting', name: 'Pay', versionDate: null }])
    expect(s2!.agreement).toBeNull()
    const [o1, o2] = payload!.offers
    expect(o1!.anchor).toBe('sheet')
    expect(o1!.references).toEqual([{ kind: 'book', name: 'GC', versionDate: '2026-06-19' }])
    expect(o1!.acknowledgements).toEqual(['A'])
    expect(o1!.bond).toBe('furnished')
    expect(o1!.specialProvisions).toBe('Owner supplies fixtures.')
    expect(o2!.anchor).toBe('step')
    expect(o2!.exclusions).toEqual([])
    expect(o2!.bond).toBe('none')
  })
})

describe('parseSubPortalPayload (v2.3605 payment traces)', () => {
  it('reads the trace rows, drops malformed ones, and defaults to none for an older function', () => {
    const base = { subName: 'Danny', totals: { earned: 1, paid: 0, open: 1 }, sheets: [], offers: [] }
    const p = parseSubPortalPayload({
      ...base,
      paymentTraces: [
        { date: '2026-08-20', jobNumber: '880', amount: 400, kind: 'moved', toJobNumber: '922' },
        { date: '2026-08-22', jobNumber: null, amount: 50, kind: 'removed' },
        { date: '', amount: 1, kind: 'moved' },
        { date: '2026-08-22', amount: 1, kind: 'vanished' },
      ],
    })
    expect(p!.paymentTraces).toEqual([
      { date: '2026-08-20', jobNumber: '880', amount: 400, kind: 'moved', toJobNumber: '922' },
      { date: '2026-08-22', jobNumber: null, amount: 50, kind: 'removed', toJobNumber: null },
    ])
    expect(parseSubPortalPayload(base)!.paymentTraces).toEqual([])
  })
})
