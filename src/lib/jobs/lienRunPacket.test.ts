import { describe, expect, it } from 'vitest'
import type { RunNotice } from './lienDeskRun'
import type { CombinedRunNotice } from './lienNoticeCombine'
import { lienRunInvoiceDocsShown, lienRunPayPages, lienRunReadyPacket, lienRunStackOf } from './lienRunPacket'
import { lienNoticePrintFields, lienPrintSnapshotPapers } from './lienPrintSworn'
import type { NoticeInvoiceDoc } from './noticeInvoiceEnclosure'

const FIELDS = { noticeDate: '2026-09-14', projectDescription: 'ZZ Sample Shop, 12 Sample Rd', claimantName: 'ZZ Plumbing', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'ZZ Builder', contractedWithIfDifferent: '', claimAmount: '500.00', contactPerson: 'Rosa', claimantAddress: '1 Sample St, Sample, TX 78000' }

function notice(partial: Partial<RunNotice> = {}): RunNotice {
  return {
    itemId: 'it1',
    jobId: 'j1',
    kind: 'notice_53_056',
    label: '1001 · ZZ Sample Shop',
    jobNumber: '1001',
    months: ['2026-07'],
    amount: 500,
    fields: FIELDS,
    extras: { refItems: ['Job #1001'] },
    coverLetter: null,
    coverNote: '',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: 'ZZ Holdings LLC', address: '4 Example Way, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Builder', address: '29 Example Cir, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' },
    ],
    ...partial,
  } as RunNotice
}

const NONE = { invoiceDocsByJob: {}, payByJob: {} }

describe('lienRunStackOf', () => {
  it('a ready notice prints now, a printed one is in the mail, and every other part is stopped', () => {
    expect(lienRunStackOf('ready')).toBe('ready')
    expect(lienRunStackOf('owe')).toBe('printed')
    expect(lienRunStackOf('record')).toBe('printed')
    expect(lienRunStackOf('held')).toBe('rest')
    expect(lienRunStackOf('wait')).toBe('rest')
    expect(lienRunStackOf(undefined)).toBe('rest')
  })
})

describe('lienRunReadyPacket', () => {
  it('prints the ready notices, files one packet on their jobs and stamps the ones whose every copy printed', () => {
    const packet = lienRunReadyPacket({ notices: [notice(), notice({ itemId: 'it2', jobId: 'j2', label: '1002 · ZZ Second Shop', jobNumber: '1002' })], todayYmd: '2026-09-14', issuer: null, enclosures: NONE })
    expect(packet!.notices.map((n) => n.itemId)).toEqual(['it1', 'it2'])
    expect(packet!.filing).toMatchObject({ kind: 'lien_notice_packet', title: '§ 53.056 notice packet · 2 notices', jobIds: ['j1', 'j2'] })
    // Step 7: the filed copy keeps what each notice said as it printed, in the packet's order.
    const papers = lienPrintSnapshotPapers(packet!.filing.sourceSnapshot)
    expect(papers.map((p) => [p.kind, p.jobIds, p.itemIds])).toEqual([['notice', ['j1'], ['it1']], ['notice', ['j2'], ['it2']]])
    expect(papers[0]!.fields).toEqual(lienNoticePrintFields(packet!.notices[0]!.fields))
    expect(packet!.stampIds).toEqual(['it1', 'it2'])
    expect(packet!.copyKeys).toEqual(expect.arrayContaining(['it1:owner', 'it1:original_contractor', 'it2:owner', 'it2:original_contractor']))
    expect(packet!.html).toContain('<!doctype html>')
    expect(packet!.held).toEqual([])
  })

  it('one ready notice is a packet of one, by its own title', () => {
    expect(lienRunReadyPacket({ notices: [notice()], todayYmd: '2026-09-14', issuer: null, enclosures: NONE })!.filing.title).toBe('§ 53.056 notice packet')
  })

  it('a notice that waits on a signature, is held, or already printed is not in the packet, and a stopped one is named with its reason', () => {
    const notices = [
      notice(),
      notice({ itemId: 'it2', jobId: 'j2', label: '1002 · ZZ Unsigned Shop', signature: null }),
      notice({ itemId: 'it3', jobId: 'j3', label: '1003 · ZZ Held Shop', ownerUnconfirmed: true }),
      notice({ itemId: 'it4', jobId: 'j4', label: '1004 · ZZ Printed Shop', printedAt: '2026-09-12T15:00:00Z' }),
    ]
    const packet = lienRunReadyPacket({ notices, todayYmd: '2026-09-14', issuer: null, enclosures: NONE })
    expect(packet!.notices.map((n) => n.itemId)).toEqual(['it1'])
    expect(packet!.stampIds).toEqual(['it1'])
    expect(packet!.held.length).toBeGreaterThan(0)
    expect(packet!.held.every((h) => h.why.trim() !== '')).toBe(true)
  })

  it('answers null when no notice is ready, so a caller prints nothing', () => {
    expect(lienRunReadyPacket({ notices: [], todayYmd: '2026-09-14', issuer: null, enclosures: NONE })).toBeNull()
    expect(lienRunReadyPacket({ notices: [notice({ signature: null })], todayYmd: '2026-09-14', issuer: null, enclosures: NONE })).toBeNull()
    expect(lienRunReadyPacket({ notices: [notice({ amount: 0 })], todayYmd: '2026-09-14', issuer: null, enclosures: NONE })).toBeNull()
  })
})

describe('the enclosures by the notice that prints them', () => {
  const doc = (id: string) => ({ invoiceId: id, title: `Invoice ${id}`, description: '', openAmount: 100, stripeInvoiceId: null }) as unknown as NoticeInvoiceDoc

  it('a plain notice keeps its own job’s bills, and a combined one carries every part’s under the lead job', () => {
    const plain = notice() as CombinedRunNotice
    expect(lienRunInvoiceDocsShown([plain], { j1: [doc('a')] })).toEqual({ j1: [doc('a')] })
    const combined = { ...notice(), parts: [{ itemId: 'it1', jobId: 'j1' }, { itemId: 'it2', jobId: 'j2' }] } as unknown as CombinedRunNotice
    expect(lienRunInvoiceDocsShown([combined], { j1: [doc('a')], j2: [doc('b')] }).j1).toEqual([doc('a'), doc('b')])
  })

  it('a job with no pay rows prints no pay page', () => {
    expect(lienRunPayPages([notice() as CombinedRunNotice], {}, '')).toEqual({})
    expect(lienRunPayPages([notice() as CombinedRunNotice], { j1: { rows: [], assets: {} } }, '')).toEqual({})
  })
})
