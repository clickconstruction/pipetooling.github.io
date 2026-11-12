import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parseLienSends, sendsTrackingOwed } from './lienSendTracking'
import {
  EMPTY_SERVICE_COPY,
  LIEN_SERVICE_PROOF_WORDS,
  heldServiceWords,
  lienReceiptPhotoName,
  serviceCopyDraft,
  serviceProofLines,
  serviceProofMissing,
  serviceSavedWords,
  serviceSends,
} from './lienServiceProof'

const RECEIPT = 'https://drive.google.com/file/d/made-up-1/view'

describe('the mail receipts of a filed affidavit’s copies', () => {
  it('a day recorded alone writes no send, so the filing stays as it was', () => {
    expect(serviceSends({ servedOn: '2026-11-18', owner: { ...EMPTY_SERVICE_COPY }, contractor: { ...EMPTY_SERVICE_COPY } })).toEqual([])
    expect(serviceSends({ servedOn: '2026-11-18', owner: { tracking: '   ', receiptUrl: ' ' }, contractor: null })).toEqual([])
  })

  it('a copy with a number or a photo gets a row, the owner first, on the day served', () => {
    const sends = serviceSends({ servedOn: '2026-11-18', owner: { tracking: ' 0000 0000 0001 ', receiptUrl: '' }, contractor: { tracking: '', receiptUrl: RECEIPT } })
    expect(sends).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: '0000 0000 0001', sent_on: '2026-11-18' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '', sent_on: '2026-11-18', receipt_url: RECEIPT },
    ])
  })

  it('a job contracted with the owner mails one copy, whatever the second draft holds', () => {
    const sends = serviceSends({ servedOn: '2026-11-18', owner: { tracking: '0000000002', receiptUrl: RECEIPT }, contractor: null })
    expect(sends.map((s) => s.recipient)).toEqual(['owner'])
  })

  it('the receipt link survives the sends parser, and the form opens on what the filing holds', () => {
    const saved = serviceSends({ servedOn: '2026-11-18', owner: { tracking: '0000000002', receiptUrl: RECEIPT }, contractor: { tracking: '0000000003', receiptUrl: '' } })
    expect(parseLienSends(saved)[0]?.receipt_url).toBe(RECEIPT)
    expect(serviceCopyDraft(saved, 'owner')).toEqual({ tracking: '0000000002', receiptUrl: RECEIPT })
    expect(serviceCopyDraft(saved, 'original_contractor')).toEqual({ tracking: '0000000003', receiptUrl: '' })
    expect(serviceCopyDraft([], 'owner')).toEqual(EMPTY_SERVICE_COPY)
    expect(serviceCopyDraft(null, 'owner')).toEqual(EMPTY_SERVICE_COPY)
  })

  it('the Filings list names each copy that has proof, and counts the copies that have none', () => {
    const saved = serviceSends({ servedOn: '2026-11-18', owner: { tracking: '0000000002', receiptUrl: RECEIPT }, contractor: null })
    expect(serviceProofLines(saved)).toEqual([{ recipient: 'owner', who: 'Owner of record', tracking: '0000000002', receiptUrl: RECEIPT }])
    expect(serviceProofLines([])).toEqual([])
    expect(serviceProofMissing(saved, false)).toBe(0)
    expect(serviceProofMissing(saved, true)).toBe(1)
    expect(serviceProofMissing([], true)).toBe(2)
  })

  it('a photo with no number reads as owed to the notice helper, which is why the watch asks it of notices only', () => {
    // `lienDeadlines` and the Filings list call `sendsTrackingOwed` on a § 53.056 or § 53.057 notice and never on an affidavit, so a receipt photo alone nags nobody.
    const saved = serviceSends({ servedOn: '2026-11-18', owner: { tracking: '', receiptUrl: RECEIPT }, contractor: null })
    expect(sendsTrackingOwed(saved)).toHaveLength(1)
    expect(serviceProofLines(saved)).toHaveLength(1)
  })

  it('the photo takes a name that says what it is, whose, and when', () => {
    expect(lienReceiptPhotoName('owner', '650', '2026-11-18')).toBe('Lien affidavit, Job 650, mail receipt, owner, 2026-11-18.jpg')
    expect(lienReceiptPhotoName('original_contractor', '650', '2026-11-18', 'HEIC')).toBe('Lien affidavit, Job 650, mail receipt, original contractor, 2026-11-18.heic')
    expect(lienReceiptPhotoName('clerk', '', '', '')).toBe('Lien affidavit, the clerk’s stamped page.jpg')
  })

  it('the toast says whether the receipts are in', () => {
    const one = serviceSends({ servedOn: '2026-11-18', owner: { tracking: '0000000002', receiptUrl: '' }, contractor: null })
    expect(serviceSavedWords(one, false)).toContain('with its mail receipts')
    expect(serviceSavedWords(one, true)).toContain('Add the mail receipts when you have them.')
    expect(serviceSavedWords([], false)).toContain('Add the mail receipts when you have them.')
  })

  it('every word a first-timer reads is plain', () => {
    const w = LIEN_SERVICE_PROOF_WORDS
    for (const s of [w.hint, w.where, w.photo, w.clerkPhoto, w.number, w.ownerCopy, w.contractorCopy, w.saved, w.again, heldServiceWords('November 21, 2026'), heldServiceWords(''), serviceSavedWords([], true), serviceSavedWords([], false)]) {
      expect(plainWordsFailures(s), s).toEqual([])
    }
    expect(heldServiceWords('November 21, 2026')).toContain('by November 21, 2026')
  })
})
