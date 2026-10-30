import { describe, expect, it } from 'vitest'
import { billAnswerWords, billOffer, fileNote, fileOpenHref, filedWords, hasBillOffer, lineFilesFromRows, paperOffer, sizeWords, withLineFiles, type MessageAttachmentRow } from './lineFiles'

const row = (over: Partial<MessageAttachmentRow>): MessageAttachmentRow => ({
  id: 'f1',
  message_id: 'm1',
  sort_order: 0,
  kind: 'file',
  name: 'Hillside-Boerne-sitework-rev1.pdf',
  mime: 'application/pdf',
  size_bytes: 1_250_000,
  bucket_path: 'g-1/1-Hillside-Boerne-sitework-rev1.pdf',
  left_in_gmail: null,
  url: null,
  host: null,
  paper: null,
  paper_answer: null,
  paper_answered_by: null,
  paper_answered_at: null,
  ...over,
})

const hillside = { kind: 'trade', company: 'Hillside Excavation', name: 'Greg Paulk' }

describe('lineFilesFromRows', () => {
  it("reads each line's files in order: our copy, a file left in Gmail, a link", () => {
    const files = lineFilesFromRows([
      row({ id: 'f3', sort_order: 2, kind: 'link', name: 'WeTransfer link', mime: null, size_bytes: null, bucket_path: null, url: 'https://we.tl/t-AbC123', host: 'wetransfer' }),
      row({ id: 'f1' }),
      row({ id: 'f2', sort_order: 1, name: 'site.jpg', mime: 'image/jpeg', bucket_path: null, left_in_gmail: 'too_big' }),
      row({ id: 'f4', message_id: 'm2', name: 'x.zip', mime: 'application/zip', bucket_path: null, left_in_gmail: 'not_copied' }),
      // A text's picture the quo-webhook could not copy (cut 10): Quo's own history still holds it.
      row({ id: 'f5', message_id: 'm4', name: 'IMG_2201.jpg', mime: 'image/jpeg', bucket_path: null, left_in_gmail: 'quo_not_copied' }),
    ])
    expect(files.get('m1')!.map((f) => [f.id, f.kept, f.icon, f.url])).toEqual([
      ['f1', 'copy', 'pdf', null],
      ['f2', 'tooBig', 'image', null],
      ['f3', 'link', 'link', 'https://we.tl/t-AbC123'],
    ])
    expect(files.get('m2')!.map((f) => [f.kept, f.icon])).toEqual([['notCopied', 'file']])
    expect(files.get('m4')!.map((f) => [f.kept, f.icon])).toEqual([['quoNotCopied', 'image']])
    const lines = withLineFiles([{ id: 'm1' }, { id: 'm3' }], files)
    expect(lines[0]!.files!.map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
    expect(lines[1]).toEqual({ id: 'm3' })
  })
})

describe('the words beside a file', () => {
  it('writes a size as a Mac does', () => {
    expect(sizeWords(512)).toBe('512 bytes')
    expect(sizeWords(380_000)).toBe('380 KB')
    expect(sizeWords(1_250_000)).toBe('1.3 MB')
    expect(sizeWords(3_000_000)).toBe('3 MB')
    expect(sizeWords(31_000_000)).toBe('31 MB')
    expect(sizeWords(null)).toBe('')
  })

  it('says where each file is', () => {
    expect(fileNote({ kept: 'copy' })).toBe('our copy kept on arrival')
    expect(fileNote({ kept: 'link' })).toBe('a link, not a file')
    expect(fileNote({ kept: 'tooBig' })).toBe('too big to keep, it stays in Gmail')
    expect(fileNote({ kept: 'notCopied' })).toBe('not copied, it stays in Gmail')
    expect(fileNote({ kept: 'quoNotCopied' })).toBe('not copied, Quo still has it')
  })

  it('opens our copy through the lasting link, a link at its address, and nothing left in Gmail', () => {
    expect(fileOpenHref({ id: 'f1', kept: 'copy', url: null })).toBe('/files/messages/f1')
    expect(fileOpenHref({ id: 'f3', kept: 'link', url: 'https://we.tl/t-AbC123' })).toBe('https://we.tl/t-AbC123')
    expect(fileOpenHref({ id: 'f3', kept: 'link', url: 'javascript:alert(1)' })).toBeNull()
    expect(fileOpenHref({ id: 'f2', kept: 'tooBig', url: null })).toBeNull()
    expect(fileOpenHref({ id: 'f4', kept: 'notCopied', url: null })).toBeNull()
    expect(fileOpenHref({ id: 'f5', kept: 'quoNotCopied', url: null })).toBeNull()
  })
})

describe('paperOffer and filedWords', () => {
  const coi = lineFilesFromRows([row({ name: 'Hillside COI 2027.pdf', paper: 'coi' })]).get('m1')![0]!

  it("offers a trade partner's certificate, and goes to their W-9 for a W-9", () => {
    expect(paperOffer(coi, hillside, true)).toEqual({ paper: 'coi', words: 'This reads like Hillside Excavation’s certificate of insurance.', press: 'File this as their certificate' })
    const w9 = { ...coi, paper: 'w9' as const }
    expect(paperOffer(w9, hillside, true)).toMatchObject({ words: 'This reads like Hillside Excavation’s W-9.', press: 'Go to their W-9 paper' })
    expect(paperOffer(coi, { ...hillside, company: '' }, true)!.words).toBe('This reads like Greg Paulk’s certificate of insurance.')
  })

  it('goes to the paper, not filing it, for a reader who may not file a certificate', () => {
    expect(paperOffer(coi, hillside, false)!.press).toBe('Go to their insurance paper')
    expect(paperOffer({ ...coi, paper: 'w9' }, hillside, false)!.press).toBe('Go to their W-9 paper')
  })

  it('offers nothing once answered, without our copy, or to anyone but a trade partner', () => {
    expect(paperOffer({ ...coi, paperAnswer: 'not_it' }, hillside, true)).toBeNull()
    expect(paperOffer({ ...coi, kept: 'tooBig' }, hillside, true)).toBeNull()
    expect(paperOffer(coi, { ...hillside, kind: 'customer' }, true)).toBeNull()
    expect(paperOffer({ ...coi, paper: null }, hillside, true)).toBeNull()
  })

  it('says who filed it and when, in Chicago', () => {
    const filed = { ...coi, paperAnswer: 'filed' as const, paperAnsweredBy: 'u-rosa', paperAnsweredAt: '2026-10-13T03:00:00.000Z' }
    expect(filedWords(filed, { 'u-rosa': 'Rosa' })).toBe('Filed as their certificate · Rosa, Oct 12')
    expect(filedWords({ ...filed, paperAnsweredBy: null, paperAnsweredAt: null }, {})).toBe('Filed as their certificate')
    expect(filedWords(coi, {})).toBeNull()
  })
})

describe('billOffer and billAnswerWords (punch list #179)', () => {
  const ridgeway = { kind: 'supply_house', company: 'Ridgeway Supply', name: 'Counter' }
  const pdf = lineFilesFromRows([{ id: 'f-bill', message_id: 'm-1', sort_order: 0, kind: 'file', name: 'S1183420.pdf', mime: 'application/pdf', size_bytes: 184_000, bucket_path: 'g-9/S1183420.pdf', left_in_gmail: null, url: null, host: null, paper: null, paper_answer: null, paper_answered_by: null, paper_answered_at: null }]).get('m-1')![0]!
  it('offers a PDF or a picture with our copy on a supply house’s line, and nothing else', () => {
    expect(billOffer(pdf, ridgeway)).toEqual({ line: 'This reads like a bill from Ridgeway Supply.', record: 'Record this bill', notABill: 'Not a bill', notABillTitle: 'Takes the offer away for everyone. The file stays on the line.' })
    expect(billOffer({ ...pdf, icon: 'image', mime: 'image/jpeg' }, { ...ridgeway, company: '' })!.line).toBe('This reads like a bill from Counter.')
    expect(billOffer(pdf, { kind: 'trade', company: 'Hillside Excavation', name: 'Greg' })).toBeNull()
    expect(billOffer({ ...pdf, kept: 'tooBig' }, ridgeway)).toBeNull()
    expect(billOffer({ ...pdf, icon: 'file', mime: 'application/msword' }, ridgeway)).toBeNull()
    expect(billOffer({ ...pdf, paperAnswer: 'not_it' }, ridgeway)).toBeNull()
    expect(hasBillOffer([pdf], ridgeway)).toBe(true)
    expect(hasBillOffer(undefined, ridgeway)).toBe(false)
  })
  it('says what became of an answered file', () => {
    const names = { 'u-marisol': 'Marisol' }
    expect(billAnswerWords({ ...pdf, paperAnswer: 'filed', paperAnsweredBy: 'u-marisol', paperAnsweredAt: '2026-10-29T20:00:00.000Z' }, ridgeway, names)).toBe('Recorded as a bill · Marisol, Oct 29')
    expect(billAnswerWords({ ...pdf, paperAnswer: 'not_it', paperAnsweredBy: 'u-marisol', paperAnsweredAt: '2026-10-29T20:00:00.000Z' }, ridgeway, names)).toBe('Not a bill · Marisol, Oct 29')
    expect(billAnswerWords({ ...pdf, paperAnswer: 'filed' }, ridgeway, {})).toBe('Recorded as a bill')
    expect(billAnswerWords(pdf, ridgeway, names)).toBeNull()
    expect(billAnswerWords({ ...pdf, paper: 'coi', paperAnswer: 'filed' }, ridgeway, names)).toBeNull()
    expect(billAnswerWords({ ...pdf, paperAnswer: 'filed' }, { kind: 'trade' }, names)).toBeNull()
  })
})
