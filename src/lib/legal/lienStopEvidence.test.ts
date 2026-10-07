import { describe, expect, it } from 'vitest'
import { envelopeRecordCard, lienStopCounselView, lienSuitChecklist } from './lienStopEvidence'
import type { LegalEnvelope } from './legalLienPaper'
import type { LegalJobLine, LegalPacket } from './legalPacket'
import { buildLienTimeline } from '../jobs/lienTimeline'

const timeline = buildLienTimeline({
  todayYmd: '2026-10-07',
  isSub: true,
  propertyKind: 'non_residential',
  lastMonth: '2026-08',
  lastMonthFromCreation: false,
  months: [
    { key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-22' },
    { key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'sent', at: '2026-09-22' },
  ],
  noticeState: 'sent',
  retainage: null,
  affidavit: { deadline: '2026-12-15', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [] },
  originalContractCompletedOn: null,
  releasedAt: null,
  paid: false,
})

const envelope: LegalEnvelope = {
  key: 'pk-1', letter: 'A', kind: 'notice_53_056', kindLabel: '§ 53.056 notice', wentOutYmd: '2026-09-22', byHand: false,
  sends: [
    { recipient: 'owner', recipientLabel: 'owner of record', method: 'certified_mail', methodLabel: 'certified mail, return receipt', tracking: '9407 1118', sentOn: '2026-09-22' },
    { recipient: 'original_contractor', recipientLabel: 'original contractor', method: 'certified_mail', methodLabel: 'certified mail, return receipt', tracking: '9407 1119', sentOn: '2026-09-22' },
  ],
  claim: 27_199, shares: [{ jobId: 'j891', jobLabel: '891', amount: 27_199 }],
  months: [{ key: '2026-07', label: 'July 2026', asInformation: false }, { key: '2026-08', label: 'August 2026', asInformation: false }],
  filedYmd: null, servedYmd: null, serveDueYmd: null, county: '', recordingNumber: '', documentUrl: '', documentNote: '', filingIds: ['f-1'], letterTwo: null, answers: null,
}

const job = {
  jobId: 'j891', label: '891', name: 'Take 5- Liberty Hill', address: '11730 TX-29, Liberty Hill, TX 78642', balance: 27_199, agingDays: 54, collectionsNote: null, collectionsBy: null, collectionsYmd: null,
  contract: { kind: 'signed', contractId: 'c1', revision: 1, signedAt: '2026-03-03T15:00:00Z', signerName: 'Crystal Burd', sentAt: '2026-03-01T15:00:00Z' },
  swornMissing: [], record: { bill: 'sent', field: 'gps', dispute: false, awaitingApproval: 0 }, primaryInvoiceId: null, primaryInvoiceOpen: 0,
  property: { key: 'p1', address: '11730 TX-29, Liberty Hill, TX 78642', county: 'Williamson', precinct: '2', precinctNote: '', owner: 'JBI LIBERTY HILL LLC', legalDescription: 'Lot 1, Block A', parcelId: '', propertyKind: 'non_residential', homestead: false },
} as unknown as LegalJobLine

const packet = { account: { jobs: [job] }, paper: { envelopes: [envelope] }, todayYmd: '2026-10-07' } as unknown as Pick<LegalPacket, 'account' | 'paper' | 'todayYmd'>

describe('lienStopEvidence', () => {
  it('a mailed notice stop leads with the envelope as it went out, in counsel’s words, and says what the paper does', () => {
    const jul = timeline.steps.find((s) => s.key === 'notice:2026-07')!
    const v = lienStopCounselView({ step: jul, steps: timeline.steps, packet, jobId: 'j891', voice: 'firm' })
    expect(v.title).toBe('The July 2026 and August 2026 notice, as mailed')
    expect(v.line).toBe('Mailed September 22, 2026; its day was October 15, 2026. Both months went on one notice.')
    expect(v.cards).toHaveLength(1)
    const c = v.cards[0]!
    expect(c.title).toBe('§ 53.056 notice · Exhibit A')
    expect(c.sub).toBe('this job’s share $27,199.00')
    expect(c.rows).toEqual([
      ['Went out', 'September 22, 2026 · certified mail, return receipt'],
      ['To', 'owner of record · original contractor'],
      ['Covers', 'July 2026, August 2026'],
      ['Property', '11730 TX-29, Liberty Hill, TX 78642 · Williamson County · commercial'],
      ['Document', 'held by the office'],
    ])
    expect(c.href).toBeNull()
    expect(v.does).toContain('§ 53.081')
    expect(v.rule).toContain('§ 53.056')
    expect(v.move).toBe('OURS · DONE')
    expect(v.follows).toBe('§ 53.056 · Aug · Sep 22 · sent Sep 22')
    expect(v.checklist).toBeNull()
    expect(v.venue).toBeNull()
    expect(v.text).toContain('Went out: September 22, 2026')
  })

  it('on the portal the sends and the document are withheld: the card says the office holds them; the desk shows the link', () => {
    const bare = { ...envelope, sends: [], documentUrl: '' }
    expect(envelopeRecordCard(bare, job, 'j891', 'firm').rows[0]).toEqual(['Went out', 'September 22, 2026 · method on the office’s record'])
    expect(envelopeRecordCard(bare, job, 'j891', 'firm').rows[1]).toEqual(['To', 'the owner of record · the original contractor'])
    const desk = envelopeRecordCard({ ...envelope, documentUrl: 'https://x.test/a.pdf' }, job, 'j891', 'office')
    expect(desk.href).toBe('https://x.test/a.pdf')
    expect(desk.rows[desk.rows.length - 1]).toEqual(['Document', 'the stored document'])
  })

  it('the suit stop lists what the filing needs, on file and not, lettered in order, with the venue', () => {
    const suit = timeline.steps.find((s) => s.kind === 'suit')!
    const v = lienStopCounselView({ step: suit, steps: timeline.steps, packet, jobId: 'j891', voice: 'firm' })
    expect(v.title).toBe('Suit to foreclose the lien')
    expect(v.checklist!.map((r) => [r.letter, r.title, r.status])).toEqual([
      ['A', '§ 53.056 notice', 'on_file'],
      ['B', 'Affidavit of lien', 'not_on_file'],
      ['C', 'Proof of service of the affidavit', 'not_on_file'],
      ['D', 'The agreement', 'on_file'],
      ['E', 'Sworn account', 'on_file'],
      ['F', 'Property record', 'on_file'],
    ])
    expect(v.checklist![0]!.detail).toBe('July 2026, August 2026 · mailed September 22, 2026, certified mail, return receipt')
    expect(v.checklist![1]!.detail).toContain('not filed yet · the office’s day is Dec 15')
    expect(v.checklist![5]!.detail).toBe('owner of record JBI LIBERTY HILL LLC · legal description on file · Williamson County')
    expect(v.checklistNote).toBe('2 of 6 are not on file yet. The list is the one the packet prints as exhibits.')
    expect(v.venue).toBe('A lien foreclosure goes to district court in Williamson County — a justice court cannot foreclose a lien on land (Gov’t Code § 27.031(b)). The money claim alone: Williamson County · Justice Court, Precinct 2.'.replace('Gov’t', "Gov't"))
    expect(v.move).toBe('COUNSEL')
    expect(v.does).toBeNull()
    expect(v.cards).toEqual([])
  })

  it('a job with nothing mailed and no record reads not on file down the list', () => {
    const empty = { account: { jobs: [{ ...job, contract: { kind: 'none' }, swornMissing: ['a bill sent to the customer'], property: { ...job.property, owner: '', legalDescription: '' } }] }, paper: { envelopes: [] } } as unknown as Pick<LegalPacket, 'account' | 'paper'>
    const open = buildLienTimeline({ todayYmd: '2026-10-07', isSub: true, propertyKind: '', lastMonth: '2026-08', lastMonthFromCreation: false, months: [{ key: '2026-08', deadline: '2026-11-16', fromCreation: false, outcome: 'open', at: '' }], noticeState: 'to_draft', retainage: null, affidavit: null, originalContractCompletedOn: null, releasedAt: null, paid: false })
    const rows = lienSuitChecklist(empty, 'j891', open.steps)
    expect(rows.map((r) => r.status)).toEqual(['not_on_file', 'not_on_file', 'not_on_file', 'not_on_file', 'not_on_file', 'not_on_file'])
    expect(rows[0]!.detail).toBe('none mailed yet · Aug is on the office’s path')
    expect(rows[5]!.detail).toBe('missing the owner of record, the legal description')
  })

  it('an original contractor owes no notice: the row reads not needed; an affidavit window that closed reads so', () => {
    const gone = buildLienTimeline({ todayYmd: '2026-10-07', isSub: false, propertyKind: '', lastMonth: '2026-04', lastMonthFromCreation: true, months: [], noticeState: 'needs_owner', retainage: null, affidavit: { deadline: '2026-08-17', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: [] }, originalContractCompletedOn: null, releasedAt: null, paid: false })
    const rows = lienSuitChecklist({ account: { jobs: [job] }, paper: { envelopes: [] } } as unknown as Pick<LegalPacket, 'account' | 'paper'>, 'j891', gone.steps)
    expect(rows[0]).toMatchObject({ letter: 'A', title: '§ 53.056 notice', status: 'not_needed', statusWords: 'not needed', detail: 'not required · contracted with the owner' })
    expect(rows[1]).toMatchObject({ letter: 'B', status: 'not_on_file', statusWords: 'window closed' })
    expect(rows[1]!.detail).toBe('the window closed Aug 17 with nothing filed · the lien is gone, the money is still owed')
  })
})
