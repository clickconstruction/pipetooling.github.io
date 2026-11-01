import { describe, expect, it } from 'vitest'
import { attachEnvelopeAnswers, buildLegalEnvelopes, envelopeAnswersWords, type LegalDeskItemLike } from './legalLienPaper'
import type { JobLienFilingRow } from '../jobs/lienDeadlines'

/** The courtesy notice under a notice on the Legal desk's Paper tab and the firm's page (punch list #231, PR 3). */

const filing = (over: Partial<JobLienFilingRow> & { id: string; job_id: string }): JobLienFilingRow =>
  ({ kind: 'notice_53_056', amount: 4850, months_covered: ['2026-08'], packet_id: null, printed_claim: null, created_at: '2026-10-14T15:00:00Z', filed_at: null, served_at: null, serve_due: null, voided_at: null, by_hand: false, county: '', recording_number: '', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-10-14' }], fields: {}, document_url: '', document_note: '', invoice_ids: [], created_by: null, ...over }) as JobLienFilingRow

const item = (over: Partial<LegalDeskItemLike> & { id: string; job_id: string }): LegalDeskItemLike => ({ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-14T15:00:00Z', sent_filing_id: null, fields: {}, created_at: '2026-10-10T10:00:00Z', voided_at: null, ...over })

const courtesy = (at: string, by: string) => ({ at, by, lienDay: '2026-12-15', claim: 4850, to: [{ who: 'original_contractor', channel: 'email', address: 'd@r.example', ok: true, id: 'e1', reason: '' }, { who: 'original_contractor', channel: 'text', address: '555', ok: true, id: 't1', reason: '' }] })

describe('the courtesy notice under a notice', () => {
  const envelopes = buildLegalEnvelopes([filing({ id: 'f-741', job_id: 'job-741' })], { labelOf: (id) => id, propertyKind: 'non_residential' })
  const opts = { todayYmd: '2026-11-02', gcName: 'Ridgeway Builders' }

  it('reads none yet, then the newest send in words with the count before it', () => {
    const [none] = attachEnvelopeAnswers(envelopes, { items: [item({ id: 'it', job_id: 'job-741', sent_filing_id: 'f-741' })], openBalanceOf: () => 4850, todayYmd: '2026-11-02' })
    expect(none!.answers!.courtesy).toBeUndefined()
    expect(envelopeAnswersWords(none!.answers!, opts).courtesy).toBe('none yet')
    const [one] = attachEnvelopeAnswers(envelopes, { items: [item({ id: 'it', job_id: 'job-741', sent_filing_id: 'f-741', fields: { courtesy: [courtesy('2026-10-23T15:00:00Z', 'Grace')] } })], openBalanceOf: () => 4850, todayYmd: '2026-11-02' })
    expect(envelopeAnswersWords(one!.answers!, opts).courtesy).toBe('sent Oct 23 by Grace · email to the GC, text to the GC · named Dec 15')
    const [two] = attachEnvelopeAnswers(envelopes, { items: [item({ id: 'it', job_id: 'job-741', sent_filing_id: 'f-741', fields: { courtesy: [courtesy('2026-10-31T15:00:00Z', 'Taunya'), courtesy('2026-10-23T15:00:00Z', 'Grace')] } })], openBalanceOf: () => 4850, todayYmd: '2026-11-02' })
    expect(two!.answers!.courtesy!.map((c) => c.by)).toEqual(['Grace', 'Taunya'])
    expect(envelopeAnswersWords(two!.answers!, opts).courtesy).toBe('2 sent · newest sent Oct 31 by Taunya · email to the GC, text to the GC · named Dec 15')
  })
})
