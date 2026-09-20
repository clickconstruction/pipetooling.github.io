/**
 * The firm portal's sample matter (v2.3639): the fixture `legal-portal` answers the sample token
 * with must survive the real parser and the desk's own packet kernel — a sample that renders an
 * empty packet, or none, teaches the firm nothing.
 */
import { describe, expect, it } from 'vitest'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', phone: '(512) 555-0100', email: 'office@example.com' }

describe('sampleLegalPortalResponse — one referred matter', () => {
  for (const today of ['2026-09-20', '2027-02-03']) {
    it(`parses and builds a packet worth reading on ${today}`, () => {
      const parsed = parseLegalPortalPayload(sampleLegalPortalResponse(company as never, today))
      expect(parsed).not.toBeNull()
      expect(parsed!.matters).toHaveLength(1)
      const m = parsed!.matters[0]!
      expect(m.payer.name).toBe('Sample Contracting')
      const packet = buildMatterPacket(m, today, portalFeeModel(parsed!))
      expect(packet).not.toBeNull()
      expect(packet!.account.payer.name).toBe('Sample Contracting')
      // A signed agreement is on file, so the theory is the contract — the strongest the kernel names.
      expect(packet!.theory.key).toBe('contract')
      // $18,400 billed, $4,000 paid.
      expect(packet!.account.totals).toMatchObject({ billed: 18_400, paid: 4_000, balance: 14_400 })
      expect(packet!.account.emails).toContain('pat@samplecontracting.example.com')
      expect(packet!.worth.verdict).not.toBe('not worth it')
      // The promise Pat made is two months past — broken, on any day the sample is opened.
      expect(packet!.theirWord.timeline.find((e) => e.key === 'promise:sample-legal-promise')?.text).toContain('broken')
      expect(packet!.theirWord.timeline.filter((e) => e.key.startsWith('contact:'))).toHaveLength(3)
    })
  }
})
