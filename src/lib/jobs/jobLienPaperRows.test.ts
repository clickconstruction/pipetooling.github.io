import { describe, expect, it } from 'vitest'
import { jobLienPaperRows, type JobLienPaper } from './jobLienPaperRows'

const dayOf = (iso: string) => iso.slice(0, 10)

const filing = (p: Record<string, unknown>) =>
  ({ id: 'f', job_id: 'j', kind: 'notice_53_056', amount: 0, months_covered: [], recording_number: '', document_url: '', filed_at: null, served_at: null, serve_due: null, voided_at: null, created_at: '2026-09-01T00:00:00Z', ...p }) as unknown as JobLienPaper['filings'][number]
const letter = (p: Record<string, unknown>) =>
  ({ id: 'l', job_id: 'j', amount: 0, sent_at: null, sent_method: '', deadline_date: null, voided_at: null, created_at: '2026-09-02T00:00:00Z', ...p }) as unknown as JobLienPaper['letters'][number]
const release = (p: Record<string, unknown>) =>
  ({ id: 'r', job_id: 'j', form_type: 'conditional_progress', status: 'issued', amount: 0, voided_at: null, created_at: '2026-09-03T00:00:00Z', ...p }) as unknown as JobLienPaper['releases'][number]

describe('jobLienPaperRows', () => {
  it('names each kind of paper, its day, and the Lien window tab that holds it', () => {
    const rows = jobLienPaperRows(
      {
        filings: [
          filing({ id: 'f1', kind: 'notice_53_056', amount: 4200, served_at: '2026-09-14T15:00:00Z', document_url: 'drive.google.com/file/d/abc' }),
          filing({ id: 'f2', kind: 'affidavit', amount: 4200, filed_at: '2026-10-20', recording_number: ' 2026-118822 ', created_at: '2026-10-20T00:00:00Z' }),
          filing({ id: 'f3', kind: 'release_of_record', amount: 4200, filed_at: '2026-11-02', created_at: '2026-11-02T00:00:00Z' }),
          filing({ id: 'f4', kind: 'retainage_53_057', amount: 900, created_at: '2026-09-20T00:00:00Z' }),
        ],
        letters: [letter({ id: 'l1', amount: 4200, sent_at: '2026-09-30T16:00:00Z', sent_method: 'certified_mail', deadline_date: '2026-10-14', created_at: '2026-09-30T00:00:00Z' })],
        releases: [release({ id: 'r1', amount: 17460, form_type: 'unconditional_progress', status: 'signed', created_at: '2026-09-05T00:00:00Z' })],
      },
      dayOf,
    )
    expect(rows.map((r) => [r.kind, r.title, r.detail, r.amount])).toEqual([
      ['filing', '§ 53.056 notice', 'Served 09/14/2026', 4200],
      ['release', 'Release of lien', expect.stringMatching(/Unconditional/i), 17460],
      ['filing', '§ 53.057 retainage notice', 'Recorded, not served yet', 900],
      ['demand', 'Demand letter', 'Sent 09/30/2026 by certified mail · reply by 10/14/2026', 4200],
      ['filing', 'Lien affidavit', 'Filed 10/20/2026 · recording no. 2026-118822', 4200],
      // A release of record carries no amount of its own.
      ['filing', 'Release of record', 'Filed 11/02/2026', null],
    ])
    const [notice, , retainage, demand, affidavit, ofRecord] = rows
    expect(notice).toMatchObject({ tab: 'notice', documentUrl: 'https://drive.google.com/file/d/abc' })
    expect(retainage).toMatchObject({ tab: 'notice', documentUrl: '' })
    expect(demand).toMatchObject({ tab: 'demand' })
    expect(affidavit).toMatchObject({ tab: 'affidavit' })
    expect(ofRecord).toMatchObject({ tab: 'release_record' })
  })

  it('leaves out voided paper and a release still in draft', () => {
    const rows = jobLienPaperRows(
      {
        filings: [filing({ voided_at: '2026-09-02T00:00:00Z' })],
        letters: [letter({ voided_at: '2026-09-02T00:00:00Z' }), letter({ id: 'l2' })],
        releases: [release({ status: 'draft' }), release({ id: 'r2', voided_at: '2026-09-04T00:00:00Z' })],
      },
      dayOf,
    )
    expect(rows.map((r) => r.id)).toEqual(['l2'])
    expect(rows[0]).toMatchObject({ detail: 'Not sent yet', amount: null })
  })

  it('is empty for a job with no lien paper', () => {
    expect(jobLienPaperRows({ filings: [], letters: [], releases: [] }, dayOf)).toEqual([])
  })
})
