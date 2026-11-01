import { describe, expect, it } from 'vitest'
import { LEGAL_PAPER_NAMES, legalHowSentence, legalLines, legalSendsFromCourtesy, standingLegalLine } from './legalRoute'

/** The courtesy notice as a person's thread line (punch list #231, PR 3): read off the sent notice's record, one line per press that reached them. */

const record = (at: string, to: Array<{ who: 'owner' | 'original_contractor'; channel: 'email' | 'text'; ok: boolean }>) => ({ at, by: 'Grace', lienDay: '2026-12-15', claim: 4850, to: to.map((t) => ({ ...t, address: 'x', id: t.ok ? 'id' : null, reason: '' })) })

const items = [
  { job_id: 'job-741', kind: 'notice_53_056', status: 'sent', voided_at: null, fields: { courtesy: [
    record('2026-10-23T15:00:00.000Z', [{ who: 'original_contractor', channel: 'email', ok: true }, { who: 'original_contractor', channel: 'text', ok: true }, { who: 'owner', channel: 'email', ok: false }]),
    record('2026-10-31T15:00:00.000Z', [{ who: 'original_contractor', channel: 'email', ok: true }, { who: 'owner', channel: 'email', ok: true }]),
  ] } },
  { job_id: 'job-741', kind: 'notice_53_056', status: 'drafted', voided_at: null, fields: { courtesy: [record('2026-11-01T15:00:00.000Z', [{ who: 'owner', channel: 'email', ok: true }])] } },
  { job_id: 'job-742', kind: 'notice_53_056', status: 'sent', voided_at: '2026-11-01T00:00:00.000Z', fields: { courtesy: [record('2026-11-01T15:00:00.000Z', [{ who: 'owner', channel: 'email', ok: true }])] } },
] as never

describe('legalSendsFromCourtesy', () => {
  it('one send per press that reached the recipient, with the channels that went, from sent and unvoided items only', () => {
    const gc = legalSendsFromCourtesy(items, { recipient: 'original_contractor' })
    expect(gc.map((s) => [s.jobId, s.paper, s.methods, s.at])).toEqual([
      ['job-741', 'courtesy', ['email', 'text'], '2026-10-23T15:00:00.000Z'],
      ['job-741', 'courtesy', ['email'], '2026-10-31T15:00:00.000Z'],
    ])
    const owner = legalSendsFromCourtesy(items, { recipient: 'owner' })
    expect(owner.map((s) => s.at)).toEqual(['2026-10-31T15:00:00.000Z'])
    expect(legalSendsFromCourtesy(items).map((s) => s.id)).toHaveLength(2)
    expect(new Set(legalSendsFromCourtesy(items).map((s) => s.id)).size).toBe(2)
  })

  it('reads as a grey line from the office that keeps the reply box routed, named and sentenced like the other papers', () => {
    const lines = legalLines(legalSendsFromCourtesy(items, { recipient: 'original_contractor' }), 'dana')
    expect(lines[0]).toMatchObject({ who: 'the office', subject: 'Courtesy notice', body: 'Sent by email and text from the Lien desk.', legal: true, paper: 'courtesy', channel: 'event', direction: 'out' })
    expect(LEGAL_PAPER_NAMES.courtesy).toBe('Courtesy notice')
    expect(legalHowSentence(['text'])).toBe('Sent by text from the Lien desk.')
    expect(standingLegalLine(lines)?.paper).toBe('courtesy')
  })
})
