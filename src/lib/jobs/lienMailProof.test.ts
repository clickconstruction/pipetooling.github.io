import { describe, expect, it, vi } from 'vitest'
import { lienMailProof } from './lienMailProof'
import { addRecordedMailedCopy, type AddRecordedCopyIo } from './lienMailProofIo'

const copy = (n: number) => ({ url: `https://drive.example/file/${n}`, driveFileId: `d${n}`, name: `Lien notice as mailed · 1042 · 2026-11-17${n > 1 ? ` · ${n}` : ''}.pdf`, at: '2026-11-17T15:00:00Z', by: 'u1' })
const send = (recipient: string, over: Record<string, unknown> = {}) => ({ recipient, method: 'certified_mail', tracking: recipient === 'owner' ? '9507 01' : '9507 02', sent_on: '2026-11-17', ...over })

describe('what went out on a recorded notice', () => {
  it('lists every mailed file with its own link, then each envelope, and counts the proof on file', () => {
    const p = lienMailProof({ kind: 'notice_53_056', sends: [send('owner', { receipt_url: 'https://drive.example/r-owner' }), send('original_contractor')], documentUrl: copy(1).url, documentNote: 'What was mailed: a, b', mailedCopies: [copy(1), copy(2)] })!
    expect(p.paper).toBe('notice')
    expect(p.filesLabel).toBe('In the envelope')
    // The saved copy is the first mailed file, so it is listed once.
    expect(p.files.map((f) => [f.name, f.url])).toEqual([
      ['Lien notice as mailed · 1042 · 2026-11-17.pdf', 'https://drive.example/file/1'],
      ['Lien notice as mailed · 1042 · 2026-11-17 · 2.pdf', 'https://drive.example/file/2'],
    ])
    expect(p.envelopes.map((e) => [e.who, e.line, e.receiptUrl, e.wantsReceipt])).toEqual([
      ['Owner of record', 'Certified mail 9507 01', 'https://drive.example/r-owner', true],
      ['Original contractor', 'Certified mail 9507 02', '', true],
    ])
    expect([p.have, p.of, p.complete]).toEqual([2, 3, false])
    expect(p.chip).toBe('Mail proof: 2 of 3 on file')
    expect(p.next).toBe('Add the original contractor’s receipt.')
  })

  it('is complete once the file and every posted copy’s receipt are on file', () => {
    const p = lienMailProof({ kind: 'retainage_53_057', sends: [send('owner', { receipt_url: 'https://drive.example/r1' })], mailedCopies: [copy(1)] })!
    expect(p.paper).toBe('retainage')
    expect([p.have, p.of, p.complete, p.chip, p.next]).toEqual([2, 2, true, 'Mail proof complete', null])
  })

  it('asks for the mailed copy first, and shows a link the office typed', () => {
    const none = lienMailProof({ kind: 'notice_53_056', sends: [send('owner')] })!
    expect(none.files).toEqual([])
    expect(none.next).toBe('Add what was mailed.')
    const typed = lienMailProof({ kind: 'notice_53_056', sends: [send('owner')], documentUrl: 'drive.google.com/file/d/abc/view', documentNote: 'the packet as printed' })!
    expect(typed.files).toEqual([{ key: 'https://drive.google.com/file/d/abc/view', name: 'Saved copy · Drive — the packet as printed', url: 'https://drive.google.com/file/d/abc/view' }])
    // A typed link beside mailed files is listed after them, with no note said twice.
    const both = lienMailProof({ kind: 'notice_53_056', sends: [send('owner')], documentUrl: 'https://drive.google.com/file/d/abc/view', documentNote: 'the packet · What was mailed: x', mailedCopies: [copy(1)] })!
    expect(both.files.map((f) => f.name)).toEqual(['Lien notice as mailed · 1042 · 2026-11-17.pdf', 'Saved copy · Drive'])
  })

  it('owes no receipt for a copy that went by email, by hand, or through a mail provider', () => {
    const p = lienMailProof({ kind: 'notice_53_056', sends: [send('owner', { method: 'email', tracking: 'msg_1' }), send('original_contractor', { via: 'docsmit', piece_id: 'p1', tracking: '' })], mailedCopies: [copy(1)] })!
    expect(p.envelopes.map((e) => [e.line, e.wantsReceipt])).toEqual([
      ['Email msg_1', false],
      ['Certified mail', false],
    ])
    expect([p.have, p.of, p.complete]).toEqual([1, 1, true])
  })
})

describe('what went out on a filed affidavit', () => {
  it('shows the clerk’s stamped scan and both copies before they are mailed', () => {
    const p = lienMailProof({ kind: 'affidavit', sends: [], documentUrl: 'https://drive.google.com/file/d/scan/view', documentNote: 'the clerk’s stamped affidavit, scanned', servedAt: null, hasContractor: true })!
    expect(p.filesLabel).toBe('Stamped by the clerk')
    expect(p.files[0]!.name).toBe('Saved copy · Drive — the clerk’s stamped affidavit, scanned')
    expect(p.envelopes.map((e) => [e.recipient, e.line, e.mailed])).toEqual([
      ['owner', 'Not mailed yet', false],
      ['original_contractor', 'Not mailed yet', false],
    ])
    expect(p.chip).toBe('Mail proof: 1 of 3 on file')
    expect(p.next).toBe('Mail the copies. Then add each receipt.')
  })

  it('has one copy on a job contracted with the owner, and asks for the scan when there is none', () => {
    const p = lienMailProof({ kind: 'affidavit', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 03', sent_on: '2026-11-18' }], servedAt: '2026-11-18', hasContractor: false })!
    expect(p.envelopes.map((e) => [e.recipient, e.line, e.mailed])).toEqual([['owner', 'Certified mail 9507 03', true]])
    expect(p.next).toBe('Add the stamped scan.')
    const served = lienMailProof({ kind: 'affidavit', sends: [], documentUrl: 'https://drive.google.com/file/d/scan/view', servedAt: '2026-11-18', hasContractor: false })!
    expect(served.envelopes[0]!.line).toBe('Mailed, no number yet')
    // The number comes before the receipt, the order the card's press asks in.
    expect(served.next).toBe('Enter the owner’s mail number.')
  })

  it('does not read a file on every copy as mailed: the day is what says so (v2.7883)', () => {
    // The live desk of 2026-11-18: the stamped scan, a file on both envelopes, no number and no day on record.
    const kept = [
      { recipient: 'owner', method: 'certified_mail', tracking: '', receipt_url: 'https://drive.example/r-owner' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '', receipt_url: 'https://drive.example/r-oc' },
    ]
    const p = lienMailProof({ kind: 'affidavit', sends: kept, documentUrl: 'https://drive.google.com/file/d/scan/view', servedAt: null, hasContractor: true })!
    expect(p.envelopes.map((e) => [e.line, e.mailed, e.wantsNumber, e.receiptUrl !== ''])).toEqual([
      ['Not mailed yet', false, false, true],
      ['Not mailed yet', false, false, true],
    ])
    // Every file is in, so the chip names what is missing in place of a full count. It read Mail proof complete.
    expect([p.have, p.of, p.complete, p.chip, p.next]).toEqual([3, 3, false, 'Mailed day not recorded', 'Record the day the copies were mailed.'])
    // The day on record: the copies are mailed, and each still owes its number, as the copies window keeps them.
    const mailed = lienMailProof({ kind: 'affidavit', sends: kept, documentUrl: 'https://drive.google.com/file/d/scan/view', servedAt: '2026-11-18', hasContractor: true })!
    expect(mailed.envelopes.map((e) => [e.line, e.mailed, e.wantsNumber])).toEqual([
      ['Mailed, no number yet', true, true],
      ['Mailed, no number yet', true, true],
    ])
    expect([mailed.complete, mailed.chip, mailed.next]).toEqual([false, 'Mail number missing', 'Enter the owner’s mail number.'])
    // The day, each number and each receipt: nothing is left, and only now is it complete.
    const whole = lienMailProof({ kind: 'affidavit', sends: kept.map((s, i) => ({ ...s, tracking: `9507 0${i + 1}` })), documentUrl: 'https://drive.google.com/file/d/scan/view', servedAt: '2026-11-18', hasContractor: true })!
    expect([whole.complete, whole.chip, whole.next]).toEqual([true, 'Mail proof complete', null])
    // A number typed ahead of the day shows on the line, and the copy is still not mailed.
    const early = lienMailProof({ kind: 'affidavit', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 03' }], documentUrl: 'https://drive.google.com/file/d/scan/view', servedAt: null, hasContractor: false })!
    expect([early.envelopes[0]!.line, early.envelopes[0]!.mailed, early.chip, early.next]).toEqual(['Not mailed yet · certified mail 9507 03', false, 'Mail proof: 1 of 2 on file', 'Record the day the copies were mailed.'])
  })

  it('holds a notice open while a certified copy has no number, though every receipt is in', () => {
    const p = lienMailProof({ kind: 'notice_53_056', sends: [send('owner', { tracking: '', receipt_url: 'https://drive.example/r1' })], mailedCopies: [copy(1)] })!
    expect([p.have, p.of, p.complete, p.chip, p.next]).toEqual([2, 2, false, 'Mail number missing', 'Enter the owner’s mail number.'])
  })

  it('reads nothing for a release of record', () => {
    expect(lienMailProof({ kind: 'release_of_record', sends: [] })).toBeNull()
  })
})

describe('addRecordedMailedCopy', () => {
  const file = new File([new Uint8Array([1])], 'scan.pdf', { type: 'application/pdf' })
  const base = { filingId: 'f1', jobId: 'j1', jobNumber: '1042', file, todayYmd: '2026-11-18', userId: 'u1', paper: 'notice' as const }

  it('adds the file to the notice’s own list, and leaves a saved copy the filing already has', async () => {
    const io: AddRecordedCopyIo = { addToItem: vi.fn(async () => [copy(1), copy(2)]) as never, put: vi.fn(), setDocument: vi.fn() }
    const out = await addRecordedMailedCopy({ ...base, itemId: 'i1', hasDocument: true }, io)
    expect(out).toEqual({ name: copy(2).name, url: copy(2).url })
    expect(io.addToItem).toHaveBeenCalledWith({ itemId: 'i1', jobId: 'j1', jobNumber: '1042', file, todayYmd: '2026-11-18', userId: 'u1', paper: 'notice' })
    expect(io.setDocument).not.toHaveBeenCalled()
    expect(io.put).not.toHaveBeenCalled()
  })

  it('on a paper with no desk item puts the file in the folder and makes it the saved copy', async () => {
    const io: AddRecordedCopyIo = { addToItem: vi.fn() as never, put: vi.fn(async () => ({ driveFileId: 'd9', url: 'https://drive.example/file/9' })), setDocument: vi.fn(async () => undefined) }
    const out = await addRecordedMailedCopy({ ...base, itemId: null, hasDocument: false }, io)
    expect(out).toEqual({ name: 'Lien notice as mailed · 1042 · 2026-11-18.pdf', url: 'https://drive.example/file/9' })
    expect((vi.mocked(io.put).mock.calls[0]![1] as File).name).toBe('Lien notice as mailed · 1042 · 2026-11-18.pdf')
    expect(io.setDocument).toHaveBeenCalledWith('f1', 'https://drive.example/file/9', 'What was mailed: Lien notice as mailed · 1042 · 2026-11-18.pdf')
    expect(io.addToItem).not.toHaveBeenCalled()
  })
})
