/**
 * The firm's print of a referral packet (punch list #85, item 1): built from the
 * sample matter through the real parser and kernel, so the test reads what the
 * firm would hold — and proves the office's own lines never reach it.
 */
import { describe, expect, it } from 'vitest'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'
import { buildFirmPacketPrintHtml } from './legalFirmPacketPrint'
import { firmFeeEntries } from './legalMoney'
import { firmJobRecordWords, legalFirmStageWords } from './legalFirmWords'
import { buildLegalPacketPrintHtml } from './legalPacketPrint'
import { formatLegalMoney } from './legalPacket'
import type { LegalEntryRow } from './legalMatters'

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

function entry(partial: Partial<LegalEntryRow> & Pick<LegalEntryRow, 'kind' | 'body'>): LegalEntryRow {
  return { id: partial.id ?? partial.body, matter_id: 'm', amount: null, occurred_on: '2026-10-01', meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-10-01T12:00:00Z', ...partial }
}

describe('buildFirmPacketPrintHtml — the sample matter', () => {
  const { payload, m, packet } = sample()
  const html = buildFirmPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name, firm: { name: payload.firm.name, handling: payload.firm.handling_name }, matter: { stage: m.stage, noteToFirm: m.noteToFirm, releasedAt: m.releasedAt, entries: m.entries }, particulars: payload.particulars })

  it('is addressed to the firm and says the matter, the stage and the demand', () => {
    expect(html).toContain('Referral packet')
    expect(html).toContain(`prepared 2026-10-05 for ${payload.firm.name.replace("&", "&amp;")}`)
    expect(html).toContain(payload.firm.handling_name)
    expect(html).toContain('Sample Contracting')
    expect(html).toContain('Balance owed')
    expect(html).toContain('Fees and costs to date')
    expect(html).toContain('Demand as of 2026-10-05')
    // $14,400 balance + the firm's $450 fee
    expect(html).toContain('$14,850.00')
  })

  it('carries none of the office packet’s own lines', () => {
    for (const officeOnly of ['Before release', 'not worth it', 'marginal', 'worth it', 'nothing held back', 'held back by the office', 'a firm has not been assigned', 'Theory']) {
      expect(html, officeOnly).not.toContain(officeOnly)
    }
    // …which the office packet does print for the same matter.
    const office = buildLegalPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name })
    expect(office).toContain('Before release')
    expect(office).toContain('a firm has not been assigned')
  })

  it('prints the firm’s own fee with a total, and the office note', () => {
    expect(html).toContain('Demand letter drafted and sent')
    expect(html).toContain('$450.00')
    expect(html).toContain('From the office:')
    expect(html).toContain(m.noteToFirm.slice(0, 30))
  })

  it('runs a balance down the statement and signs a payment before the dollar', () => {
    expect(html).toContain('$18,400.00')
    expect(html).toContain('−$4,000.00')
    expect(html).not.toContain('$-4,000.00')
    expect(html).toContain('Balance owed')
  })

  it('letters the exhibits with where each one sits', () => {
    expect(html).toContain('A · Statement of account')
    expect(html).toContain('B · Agreements')
    expect(html).toContain('C · Record of contact')
    expect(html).toContain('D · Field evidence')
  })

  it('ends with the company’s particulars for filing', () => {
    expect(html).toContain('Legal entity')
    expect(html).toContain('Custodian of records')
    expect(html).toContain('Registered agent')
    expect(html).toContain("business records as of 2026-10-05")
  })

  it('says how many entries the office held back, and nothing when none are (#85 item 29)', () => {
    const opts = { preparedOn: payload.preparedOn, companyName: company.name, firm: { name: payload.firm.name, handling: payload.firm.handling_name }, particulars: payload.particulars }
    const held = buildFirmPacketPrintHtml(packet, { ...opts, matter: { stage: m.stage, noteToFirm: m.noteToFirm, releasedAt: m.releasedAt, entries: m.entries, heldCount: 2 } })
    expect(held).toContain('2 entries held back by the office.')
    expect(html).not.toMatch(/held back by the office|nothing held back/)
  })
})

describe('firmFeeEntries', () => {
  it('keeps the firm’s fees and costs and drops the office’s contingency row', () => {
    const rows = [
      entry({ kind: 'fee', body: 'Demand letter', amount: 450 }),
      entry({ kind: 'cost', body: 'Filing', amount: 350 }),
      entry({ kind: 'cost', body: 'Contingency 33% of $4,000.00', amount: 1320, via_portal: false }),
      entry({ kind: 'cost', body: 'Tagged', amount: 10, via_portal: false, meta: { contingency: true } }),
      entry({ kind: 'payment_received', body: 'Check 1001', amount: 4000 }),
    ]
    expect(firmFeeEntries(rows).map((e) => e.body)).toEqual(['Demand letter', 'Filing'])
  })
})

describe('firmJobRecordWords and legalFirmStageWords', () => {
  it('words a job the same on paper as on the screen: one kernel, no parse of the desk’s strings', () => {
    const { payload, m, packet } = sample()
    const html = buildFirmPacketPrintHtml(packet, { preparedOn: payload.preparedOn, companyName: company.name, firm: { name: payload.firm.name, handling: payload.firm.handling_name }, matter: { stage: m.stage, noteToFirm: m.noteToFirm, releasedAt: m.releasedAt, entries: m.entries }, particulars: payload.particulars })
    const job = packet.account.jobs[0]
    if (!job) throw new Error('sample has no job')
    expect(html).toContain(firmJobRecordWords(job).replace(/&/g, '&amp;'))
    expect(html).not.toMatch(/crew on site|sworn account/)
  })
  it('names the stage in the firm’s words', () => {
    expect(legalFirmStageWords('referred')).toBe('referred')
    expect(legalFirmStageWords('suit')).toBe('suit filed')
    expect(legalFirmStageWords('pulled')).toBe('referral withdrawn')
  })
})

describe('formatLegalMoney', () => {
  it('puts the sign before the dollar', () => {
    expect(formatLegalMoney(-4000)).toBe('−$4,000.00')
    expect(formatLegalMoney(0)).toBe('$0.00')
    expect(formatLegalMoney(-0.001)).toBe('$0.00')
    expect(formatLegalMoney(1234.5)).toBe('$1,234.50')
  })
})
