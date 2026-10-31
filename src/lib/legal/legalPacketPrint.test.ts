/**
 * The office's print of an account packet: built from the sample matter through the real parser and kernel, so
 * the test reads what the desk would print. v2.6177 (punch list #218 PR 4): the cover sheet carries what each path nets.
 */
import { describe, expect, it } from 'vitest'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'
import { buildLegalPacketPrintHtml } from './legalPacketPrint'
import { settlementPathsOfMatter } from './settlementPaths'

const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }

function sample(todayYmd = '2026-10-05') {
  const payload = parseLegalPortalPayload(sampleLegalPortalResponse(company as Parameters<typeof sampleLegalPortalResponse>[0], todayYmd))
  if (!payload) throw new Error('sample did not parse')
  const m = payload.matters[0]
  if (!m) throw new Error('sample has no matter')
  const packet = buildMatterPacket(m, payload.preparedOn, portalFeeModel(payload))
  if (!packet) throw new Error('sample built no packet')
  return { payload, m, packet }
}

describe('buildLegalPacketPrintHtml — the cover sheet', () => {
  it('carries what each path nets beside the three questions when the desk passes the paths (v2.6177)', () => {
    const { payload, m, packet } = sample()
    const paths = settlementPathsOfMatter(packet.worth, m.stage, m.entries)
    const html = buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name, paths })
    expect(html).toContain('What each path nets')
    expect(html).toContain(paths.line ? 'settling beats a full win' : 'Collections and trial')
    expect(html).toContain('A full win at trial nets')
  })
  it('prints without the paths as before', () => {
    const { payload, packet } = sample()
    const html = buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(html).not.toContain('What each path nets')
    expect(html).toContain("What's left for us?")
  })
})
