import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { RunNotice } from './lienDeskRun'
import { LIEN_RUN_STOPPED_WORDS, lienRunNoticesStopped, lienRunReadyNotices } from './lienRunPacket'

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

/**
 * Punch list #362, a fault in step 6 met on the live desk on 2026-11-25: the card read *No paper is right yet* beside
 * a right notice. The checklist counts a notice as right from the Board's chip; the packet leaves out what the run
 * window holds. This is the list that says which, and why.
 */
describe('lienRunNoticesStopped', () => {
  const viaDocsmit = (r: RunNotice['recipients'][number]) => ({ ...r, via: 'docsmit' as const, pieceId: `p-${r.key}`, pieceStatus: 'sent' as const })
  const notices = [
    notice(),
    notice({ itemId: 'it2', jobId: 'j2', label: '1002 · ZZ Unsigned Shop', signature: null }),
    notice({ itemId: 'it3', jobId: 'j3', label: '1003 · ZZ Held Shop', ownerUnconfirmed: true }),
    notice({ itemId: 'it4', jobId: 'j4', label: '1004 · ZZ Printed Shop', printedAt: '2026-09-12T15:00:00Z' }),
    notice({ itemId: 'it5', jobId: 'j5', label: '1005 · ZZ Docsmit Shop', recipients: notice().recipients.map(viaDocsmit) }),
    notice({ itemId: 'it6', jobId: 'j6', label: '1006 · ZZ Email Shop', recipients: notice().recipients.map((r) => ({ ...r, method: 'email' as const, email: 'office@example.test' })) }),
  ]

  it('names every notice the packet leaves out that has not printed, each with the run window’s own reason', () => {
    const stopped = lienRunNoticesStopped(notices)
    // The ready one prints and the printed one is past this: neither is named.
    expect(stopped.map((s) => [s.itemId, s.kind, s.why])).toEqual([
      ['it2', 'held', LIEN_RUN_STOPPED_WORDS.signature],
      ['it3', 'held', 'Owner of record: from the roll, unconfirmed — press Confirm on the desk first.'],
      ['it5', 'paperless', LIEN_RUN_STOPPED_WORDS.docsmit],
      ['it6', 'paperless', LIEN_RUN_STOPPED_WORDS.paperless],
    ])
    expect(stopped[0]).toMatchObject({ jobId: 'j2', label: '1002 · ZZ Unsigned Shop' })
  })

  it('never names a notice the press counts, and with the printed one they are the whole run', () => {
    const printing = lienRunReadyNotices(notices).map((n) => n.itemId)
    const stopped = lienRunNoticesStopped(notices).map((s) => s.itemId)
    expect(printing).toEqual(['it1'])
    expect(stopped.filter((id) => printing.includes(id))).toEqual([])
    expect([...printing, ...stopped, 'it4'].sort()).toEqual(notices.map((n) => n.itemId).sort())
  })

  it('names nothing when every notice prints, and keeps to plain words', () => {
    expect(lienRunNoticesStopped([notice()])).toEqual([])
    expect(lienRunNoticesStopped([])).toEqual([])
    for (const w of Object.values(LIEN_RUN_STOPPED_WORDS)) expect(plainWordsFailures(w)).toEqual([])
  })
})
