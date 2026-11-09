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
  it('prints the claim as one table under the account — the rows that fill in, the typed lines, the total (v2.6681, punch list #171)', () => {
    const { payload, packet } = sample()
    const plain = buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(plain).toContain('<h3>The claim</h3>')
    expect(plain).toContain('Open bills <span class="muted">fills in</span>')
    expect(plain).not.toContain('Materials left on site')
    const typed = { ...packet, worth: { ...packet.worth, claimLines: [{ id: 'l1', kind: 'materials' as const, title: 'Materials left on site', amount: 5310, basis: 'contract ¶ 9', documentId: 'd1', documentTitle: 'Materials on site — count.pdf', settlementOnly: false }], claimTyped: 5310, claim: packet.worth.claim + 5310 } }
    const html = buildLegalPacketPrintHtml(typed, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(html).toContain('<td>Materials left on site</td><td>contract ¶ 9</td><td>Materials on site — count.pdf</td><td class="num">$5,310.00</td>')
    expect(html).toContain('<b>The claim</b>')
  })
  it('prints without the paths as before', () => {
    const { payload, packet } = sample()
    const html = buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(html).not.toContain('What each path nets')
    expect(html).toContain("What's left for us?")
  })
})

describe('a settlement-only line (v2.6697, punch list #171)', () => {
  it('is left off the printed table, with one sentence in its place', () => {
    const { payload, packet } = sample()
    const lines = [
      { id: 'l1', kind: 'materials' as const, title: 'Materials left on site', amount: 5310, basis: 'contract ¶ 9', documentId: null, documentTitle: '', settlementOnly: false },
      { id: 'l2', kind: 'fees' as const, title: 'Fee waiver', amount: 400, basis: '', documentId: null, documentTitle: '', settlementOnly: true },
    ]
    const html = buildLegalPacketPrintHtml({ ...packet, worth: { ...packet.worth, claimLines: lines, claimTyped: 5310, claimSettlementOnly: 400, claim: packet.worth.claim + 5310, claimSettlement: packet.worth.claim + 5710 } }, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(html).toContain('<td>Materials left on site</td>')
    expect(html).not.toContain('Fee waiver')
    expect(html).toContain('One line, $400.00, is marked settlement only and left off this table.')
  })
})
