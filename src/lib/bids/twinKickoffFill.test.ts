import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CODE_KICKOFF, DESKTOP_KICKOFF, KICKOFF_CONNECTOR_PLACEHOLDER, PRICING_KICKOFF, ROUNDS_KICKOFF } from '../../../supabase/functions/_shared/twinKickoffs'
import { KICKOFF_DEFAULT_SEAT, fillTwinKickoff, twinSeatHandle } from '../../../supabase/functions/_shared/twinKickoffFill'

const URL = 'https://mcp.clicktooling.com/twin'
const count = (hay: string, needle: string): number => hay.split(needle).length - 1

describe('twinSeatHandle', () => {
  it('reads a fleet address as its seat, whatever its case', () => {
    expect(twinSeatHandle('twin-estimator-4@twins.pipetooling.local')).toBe('twin-estimator-4')
    expect(twinSeatHandle(' Twin-Pricer-2@twins.pipetooling.local ')).toBe('twin-pricer-2')
  })

  it('answers nothing for an address that is not a fleet seat', () => {
    expect(twinSeatHandle('someone@example.com')).toBeNull()
    expect(twinSeatHandle('twin-estimator-4@twins.counttooling.local')).toBeNull()
    expect(twinSeatHandle('estimator-4@twins.pipetooling.local')).toBeNull()
    expect(twinSeatHandle('twin-estimator-x@twins.pipetooling.local')).toBeNull()
    expect(twinSeatHandle(null)).toBeNull()
    expect(twinSeatHandle(undefined)).toBeNull()
  })
})

describe('the bundled kickoffs name the seat redeem swaps', () => {
  // The swap finds the first seat's name in bold. A doc reworded to drop it would hand every twin the doc as written,
  // with no error anywhere, so the name is held here.
  it.each([
    ['CODE_KICKOFF', CODE_KICKOFF, 'estimator'],
    ['ROUNDS_KICKOFF', ROUNDS_KICKOFF, 'estimator'],
    ['DESKTOP_KICKOFF', DESKTOP_KICKOFF, 'estimator'],
    ['PRICING_KICKOFF', PRICING_KICKOFF, 'pricer'],
  ] as const)('%s says its first seat once, in bold, and no other seat', (_name, doc, kind) => {
    const written = KICKOFF_DEFAULT_SEAT[kind]
    expect(count(doc, `**${written}**`)).toBe(1)
    expect(count(doc, written)).toBe(1)
    expect(doc.match(/twin-(?:estimator|pricer)-\d+/g)).toEqual([written])
  })
})

describe('fillTwinKickoff', () => {
  it('names the twin the key belongs to in place of the first seat', () => {
    const out = fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: 'twin-estimator-4@twins.pipetooling.local' })
    expect(out).toContain('You are **twin-estimator-4**, ')
    expect(out).not.toContain('twin-estimator-1')
    expect(out.length).toBe(fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: null }).length)
  })

  it('does the same for a round and for the pricing robot', () => {
    const round = fillTwinKickoff(ROUNDS_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: 'twin-estimator-12@twins.pipetooling.local' })
    expect(round).toContain('You are **twin-estimator-12**, ')
    expect(round).not.toContain('twin-estimator-1*')
    const pricer = fillTwinKickoff(PRICING_KICKOFF, { connectorUrl: URL, kind: 'pricer', twinEmail: 'twin-pricer-2@twins.pipetooling.local' })
    expect(pricer).toContain('You are **twin-pricer-2**, ')
    expect(pricer).not.toContain('twin-pricer-1')
  })

  it('fills the connector address, every time it is written', () => {
    for (const doc of [CODE_KICKOFF, ROUNDS_KICKOFF, PRICING_KICKOFF]) {
      expect(doc).toContain(KICKOFF_CONNECTOR_PLACEHOLDER)
      const out = fillTwinKickoff(doc, { connectorUrl: URL, kind: 'estimator', twinEmail: 'twin-estimator-4@twins.pipetooling.local' })
      expect(out).not.toContain(KICKOFF_CONNECTOR_PLACEHOLDER)
      expect(count(out, URL)).toBe(count(doc, KICKOFF_CONNECTOR_PLACEHOLDER))
    }
  })

  it('leaves the first seat its own words', () => {
    const first = fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: 'twin-estimator-1@twins.pipetooling.local' })
    expect(first).toBe(CODE_KICKOFF.split(KICKOFF_CONNECTOR_PLACEHOLDER).join(URL))
  })

  it('keeps the doc as written for an address that is not a fleet seat', () => {
    const asWritten = CODE_KICKOFF.split(KICKOFF_CONNECTOR_PLACEHOLDER).join(URL)
    expect(fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: 'someone@example.com' })).toBe(asWritten)
    expect(fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'estimator', twinEmail: undefined })).toBe(asWritten)
  })

  it('swaps only the seat of its own kind', () => {
    const out = fillTwinKickoff(CODE_KICKOFF, { connectorUrl: URL, kind: 'pricer', twinEmail: 'twin-pricer-2@twins.pipetooling.local' })
    expect(out).toContain('**twin-estimator-1**')
  })
})

describe('twin-setup hands back the kickoff for the key it minted', () => {
  const src = readFileSync(join(process.cwd(), 'supabase/functions/twin-setup/index.ts'), 'utf8')

  it('fills the kickoff with the redeemed twin', () => {
    expect(src).toContain("import { fillTwinKickoff } from '../_shared/twinKickoffFill.ts'")
    expect(src).toContain('return fillTwinKickoff(doc, { connectorUrl, kind, twinEmail })')
    expect(src).toContain('kickoff: kickoffFor(kind, connectorUrl, twin.email, rounds),')
  })

  it('fills the connector address nowhere else', () => {
    expect(src).not.toContain('KICKOFF_CONNECTOR_PLACEHOLDER')
  })
})
