import { describe, expect, it } from 'vitest'
import { buildPaperworkLines, summarizePaperwork, type PaperworkDocInput } from './paperworkRollup'

function doc(p: Partial<PaperworkDocInput> & { id: string; document_name: string }): PaperworkDocInput {
  return { status: 'unsent', signed_at: null, sent_at: null, expires_at: null, dashboard_prompt_after_clock_in: false, contract_lineage_id: null, lineage_version: 1, ...p }
}

describe('buildPaperworkLines', () => {
  it('keeps the newest lineage version and orders expired, unsent, expiring, sent, signed', () => {
    const lines = buildPaperworkLines(
      [
        doc({ id: 'a1', document_name: 'Handbook', status: 'sent', sent_at: '2026-08-01T00:00:00Z', contract_lineage_id: 'L1', lineage_version: 1 }),
        doc({ id: 'a2', document_name: 'Handbook', status: 'signed', signed_at: '2026-08-05T00:00:00Z', contract_lineage_id: 'L1', lineage_version: 2 }),
        doc({ id: 'b', document_name: 'High-Trust', status: 'unsent', dashboard_prompt_after_clock_in: true }),
        doc({ id: 'c', document_name: 'COI', status: 'signed', signed_at: '2025-09-01T00:00:00Z', expires_at: '2026-09-10' }),
        doc({ id: 'd', document_name: 'W-9', status: 'signed', signed_at: '2025-09-01T00:00:00Z', expires_at: '2026-08-01' }),
      ],
      '2026-09-03',
    )
    expect(lines.map((l) => [l.name, l.state])).toEqual([
      ['W-9', 'expired'],
      ['High-Trust', 'unsent'],
      ['COI', 'expiring'],
      ['Handbook', 'signed'],
    ])
    expect(lines.find((l) => l.name === 'Handbook')!.id).toBe('a2')
    expect(lines.find((l) => l.name === 'COI')!.detail).toBe('expires in 7 days')
    expect(lines.find((l) => l.name === 'High-Trust')!.nag).toBe(true)
    expect(summarizePaperwork(lines)).toEqual({ unsent: 1, sent: 0, signed: 1, expiring: 1, expired: 1 })
  })
})
