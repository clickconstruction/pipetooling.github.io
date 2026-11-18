import { describe, expect, it } from 'vitest'
import { LIEN_RECEIPT_WORDS, lienCopyProofChanged, lienReceiptFileName, lienReceiptIsPdf, lienReceiptNotKeptWords, lienReceiptProblem, lienReceiptTakeOffAsk, lienSendsWithProof } from './lienReceiptFile'
import { keepLienCopyProof, type LienReceiptKeepIo } from './lienReceiptKeepIo'

const MB = 1024 * 1024

describe('a receipt as a file', () => {
  it('takes a photo or a PDF, a PDF by its name when the scanner gives no type', () => {
    expect(lienReceiptProblem({ size: 10, type: 'image/jpeg', name: 'IMG_1.jpg' })).toBeNull()
    expect(lienReceiptProblem({ size: 10, type: 'application/pdf', name: 'r.pdf' })).toBeNull()
    expect(lienReceiptIsPdf({ type: '', name: 'SCAN0007.PDF' })).toBe(true)
    expect(lienReceiptProblem({ size: 10, type: '', name: 'SCAN0007.PDF' })).toBeNull()
  })

  it('refuses a file that is not one, an empty one and a PDF over the folder’s limit, each in a sentence', () => {
    expect(lienReceiptProblem({ size: 10, type: 'text/csv', name: 'numbers.csv' })).toBe(LIEN_RECEIPT_WORDS.notReceipt)
    expect(lienReceiptProblem({ size: 0, type: 'application/pdf', name: 'r.pdf' })).toBe(LIEN_RECEIPT_WORDS.empty)
    expect(lienReceiptProblem({ size: 12 * MB, type: 'application/pdf', name: 'r.pdf' })).toBe('That file is 12 MB. The most a file can be is 10 MB. Scan this receipt alone, or at a lower quality.')
    // A photo is shrunk first, so its size is not judged here.
    expect(lienReceiptProblem({ size: 12 * MB, type: 'image/heic', name: 'IMG_2.heic' })).toBeNull()
  })

  it('names the file as a receipt photo is named, with the right extension', () => {
    const base = { of: 'owner' as const, jobNumber: '77', ymd: '2026-11-17' }
    expect(lienReceiptFileName({ ...base, file: { type: 'application/pdf', name: 'scan.pdf' }, shrunk: false })).toBe('Lien affidavit, Job 77, mail receipt, owner, 2026-11-17.pdf')
    expect(lienReceiptFileName({ ...base, file: { type: 'image/heic', name: 'IMG_2.heic' }, shrunk: true })).toBe('Lien affidavit, Job 77, mail receipt, owner, 2026-11-17.jpg')
    expect(lienReceiptFileName({ ...base, of: 'original_contractor', paper: 'notice', file: { type: 'image/png', name: 'shot.png' }, shrunk: false })).toBe('Lien notice, Job 77, mail receipt, original contractor, 2026-11-17.png')
  })
})

describe('one copy’s proof merged into the filing’s sends', () => {
  it('gives a copy with no row one by certified mail once it has a number or a receipt', () => {
    expect(lienSendsWithProof([], 'owner', { receiptUrl: 'https://d/r1' })).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: 'https://d/r1' }])
    expect(lienSendsWithProof(null, 'original_contractor', { tracking: ' 9507 01 ' })).toEqual([{ recipient: 'original_contractor', method: 'certified_mail', tracking: '9507 01' }])
    expect(lienSendsWithProof([], 'owner', { tracking: '', receiptUrl: '' })).toEqual([])
  })

  it('changes that copy alone and keeps its method, its day and the other copy', () => {
    const sends = [
      { recipient: 'owner', method: 'certified_mail', tracking: '9507 01', sent_on: '2026-11-17' },
      { recipient: 'original_contractor', method: 'traceable_courier', tracking: 'X1', sent_on: '2026-11-17', receipt_url: 'https://d/gc' },
    ]
    const out = lienSendsWithProof(sends, 'owner', { receiptUrl: 'https://d/owner' })
    expect(out[0]).toEqual({ recipient: 'owner', method: 'certified_mail', tracking: '9507 01', sent_on: '2026-11-17', receipt_url: 'https://d/owner' })
    expect(out[1]).toEqual(sends[1])
    // A key left out is left as the filing holds it.
    expect(lienSendsWithProof(out, 'owner', { tracking: '9507 02' })[0]).toMatchObject({ tracking: '9507 02', receipt_url: 'https://d/owner' })
  })

  it('takes a receipt off: a mailed copy keeps its row, an unserved copy left with nothing loses it', () => {
    const mailed = [{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-11-17', receipt_url: 'https://d/r' }]
    expect(lienSendsWithProof(mailed, 'owner', { receiptUrl: '' })).toEqual([{ recipient: 'owner', method: 'certified_mail', tracking: '', sent_on: '2026-11-17' }])
    const unserved = [{ recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: 'https://d/r' }]
    expect(lienSendsWithProof(unserved, 'owner', { receiptUrl: '' })).toEqual([])
  })

  it('says whether a write is owed', () => {
    const sends = [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 01', receipt_url: 'https://d/r' }]
    expect(lienCopyProofChanged(sends, 'owner', { tracking: '9507 01 ', receiptUrl: 'https://d/r' })).toBe(false)
    expect(lienCopyProofChanged(sends, 'owner', { tracking: '9507 02', receiptUrl: 'https://d/r' })).toBe(true)
    expect(lienCopyProofChanged(sends, 'original_contractor', { tracking: '', receiptUrl: '' })).toBe(false)
    expect(lienCopyProofChanged(sends, 'original_contractor', { tracking: '', receiptUrl: 'https://d/gc' })).toBe(true)
  })

  it('words a write that did not reach the filing, with what still saves it', () => {
    expect(lienReceiptNotKeptWords('The network dropped.')).toBe('Not kept yet: The network dropped. Record saves it with the day.')
    expect(lienReceiptNotKeptWords('')).toBe('Not kept yet. Record saves it with the day.')
  })
})

describe('keepLienCopyProof', () => {
  it('reads the filing fresh and writes its sends with the one copy changed', async () => {
    const stored: { sends: unknown } = { sends: [{ recipient: 'original_contractor', method: 'certified_mail', tracking: 'GC 1' }] }
    const io: LienReceiptKeepIo = {
      read: async () => stored.sends,
      write: async (_id, sends) => {
        stored.sends = sends
      },
    }
    const out = await keepLienCopyProof({ filingId: 'f-1', recipient: 'owner', proof: { tracking: '9507 01', receiptUrl: 'https://d/r' } }, io)
    expect(out).toEqual([
      { recipient: 'original_contractor', method: 'certified_mail', tracking: 'GC 1' },
      { recipient: 'owner', method: 'certified_mail', tracking: '9507 01', receipt_url: 'https://d/r' },
    ])
    expect(stored.sends).toEqual(out)
  })
})

describe('lienReceiptTakeOffAsk (v2.7743)', () => {
  it('says where a Drive file goes, and asks alone for any other link', () => {
    expect(lienReceiptTakeOffAsk('https://drive.google.com/file/d/made-up-file-01/view')).toBe('Take this receipt off? The file goes to Drive’s trash. Drive keeps it there 30 days.')
    expect(LIEN_RECEIPT_WORDS.takeOffAsk).toBe(lienReceiptTakeOffAsk('https://drive.google.com/open?id=made-up-file-01'))
    expect(lienReceiptTakeOffAsk('https://example.com/receipt.pdf')).toBe('Take this receipt off?')
    expect(lienReceiptTakeOffAsk('')).toBe('Take this receipt off?')
  })
})
