import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  INTO_NEW,
  KEEP_ON_BID_LABEL,
  bidKeptWords,
  bidMailDraft,
  bidMailDraftProblem,
  bidMailFiles,
  bidMailLineWords,
  bidMailLines,
  bidMailState,
  cameByMailMemo,
  fileSizeWords,
  isDriveFolderLink,
  isInlinePicture,
  keepPressWords,
  mailBySet,
  mailKeptWords,
  mailSender,
  nothingToKeepWords,
  putIntoOptions,
  type BidMailFile,
  type BidMailFileRow,
} from './bidMailSet'

/** The words and the rules of **Keep its files on the bid…** (punch list #368, PR 2). Made-up mail and bids. */

const FOLDER = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const row = (over: Partial<BidMailFileRow> & { id: string }): BidMailFileRow => ({ name: `${over.id}.pdf`, mime: 'application/pdf', kind: 'file', bucket_path: `gm/${over.id}.pdf`, left_in_gmail: null, size_bytes: 2_202_009, bid_plan_set_id: null, ...over })
const file = (over: Partial<BidMailFile> & { id: string }): BidMailFile => ({ name: `${over.id}.pdf`, mime: 'application/pdf', size: 1000, copied: true, leftWhy: null, setId: null, ...over })
const mail = { subject: 'Re: Fwd: Addendum 2, revised plumbing specs', who: 'Dana Whitfield to the bids box · from Sam’s mail', at: '2026-11-16T15:04:00.000Z' }

describe('bidMailFiles: the mail’s files as the press reads them', () => {
  it('leaves a link out and reads our copy, the reason a file stayed in Gmail and the set it is in', () => {
    expect(bidMailFiles([row({ id: 'a' }), row({ id: 'big', bucket_path: null, left_in_gmail: 'too_big' }), row({ id: 'kept', bid_plan_set_id: 'set-1' }), row({ id: 'link', kind: 'link' })])).toEqual([
      { id: 'a', name: 'a.pdf', mime: 'application/pdf', size: 2_202_009, copied: true, leftWhy: null, setId: null },
      { id: 'big', name: 'big.pdf', mime: 'application/pdf', size: 2_202_009, copied: false, leftWhy: 'too_big', setId: null },
      { id: 'kept', name: 'kept.pdf', mime: 'application/pdf', size: 2_202_009, copied: true, leftWhy: null, setId: 'set-1' },
    ])
  })
  it('stands on a read that left the size and the mark out', () => {
    expect(bidMailFiles([{ id: 'a', name: 'a.pdf', mime: null, kind: 'file', bucket_path: 'gm/a.pdf', left_in_gmail: null }])).toEqual([{ id: 'a', name: 'a.pdf', mime: null, size: null, copied: true, leftWhy: null, setId: null }])
  })
})

describe('bidMailState: what the mail offers', () => {
  it('nothing for a mail with no file', () => {
    expect(bidMailState([])).toEqual({ kind: 'none' })
  })
  it('the press while a file we hold is in no set, with what is kept and what stayed in Gmail beside it', () => {
    const files = [file({ id: 'a' }), file({ id: 'b', setId: 'set-1' }), file({ id: 'c', copied: false, leftWhy: 'too_big' })]
    expect(bidMailState(files)).toEqual({ kind: 'keep', ready: [files[0]], kept: [files[1]], left: [files[2]] })
  })
  it('kept once every file we hold is in a set, a file that stayed in Gmail not holding the mark back', () => {
    const files = [file({ id: 'a', setId: 'set-1' }), file({ id: 'c', copied: false })]
    expect(bidMailState(files)).toEqual({ kind: 'kept', kept: [files[0]], left: [files[1]] })
  })
  it('says why when we hold a copy of none', () => {
    const files = [file({ id: 'c', copied: false, leftWhy: 'too_big' })]
    expect(bidMailState(files)).toEqual({ kind: 'left', left: files })
    expect(nothingToKeepWords(1)).toBe('This mail’s file stayed in Gmail, so there is no copy here to keep on the bid.')
    expect(nothingToKeepWords(3)).toBe('This mail’s 3 files stayed in Gmail, so there is no copy here to keep on the bid.')
  })
})

describe('a signature’s picture is not a file to keep (v2.7556)', () => {
  it('knows the pictures an email program puts inside the words', () => {
    for (const name of ['image001.png', 'image002.jpg', 'Image003.JPEG', 'image.png', ' image0.gif ']) expect(isInlinePicture({ name }), name).toBe(true)
    for (const name of ['P-201-revised.pdf', 'site-photo.jpg', 'image001.pdf', 'marked image001.png', 'IMG_4411.jpg']) expect(isInlinePicture({ name }), name).toBe(false)
  })
  it('a mail that carries nothing else offers no press', () => {
    expect(bidMailState([file({ id: 'logo', name: 'image001.png' })])).toEqual({ kind: 'none' })
    // With a file that stayed in Gmail beside it, the mail still says why there is nothing to keep.
    const big = file({ id: 'big', copied: false, leftWhy: 'too_big' })
    expect(bidMailState([file({ id: 'logo', name: 'image001.png' }), big])).toEqual({ kind: 'left', left: [big] })
    // Once its real files are kept, the logo does not bring the press back.
    const kept = file({ id: 'a', setId: 'set-1' })
    expect(bidMailState([kept, file({ id: 'logo', name: 'image001.png' })])).toEqual({ kind: 'kept', kept: [kept], left: [] })
  })
  it('beside a real file it is listed and starts unticked', () => {
    const files = [file({ id: 'a' }), file({ id: 'logo', name: 'image001.png' })]
    const state = bidMailState(files)
    expect(state.kind).toBe('keep')
    if (state.kind !== 'keep') throw new Error('not a keep')
    expect(state.ready.map((f) => f.id)).toEqual(['a', 'logo'])
    expect(bidMailDraft(mail, state.ready, []).picked).toEqual(['a'])
  })
  it('the list under Plan sets leaves out a mail that carries only one', () => {
    expect(bidMailLines([{ id: 'm1', at: '2026-11-16T15:04:00.000Z', subject: 'Thanks', who_text: 'x', message_attachments: [{ kind: 'file', name: 'image001.png' }] }, { id: 'm2', at: '2026-11-16T15:04:00.000Z', subject: 'Specs', who_text: 'x', message_attachments: [{ kind: 'file', name: 'image001.png' }, { kind: 'file', name: 'specs.pdf' }] }]).map((m) => `${m.id}:${m.files}`)).toEqual(['m2:1'])
  })
})

describe('Gmail’s picture of a Drive link is not a file to keep (v2.7954)', () => {
  // A made-up key: a long run of letters, digits, dashes and underscores, then the size the picture was drawn at.
  const key = 'Zx9MadeUpKeyForATest_0123456789-abcdefghijKLMNOP'
  const preview = `${key}=w1200-h630-p.png`
  it('knows the name: a long key, the size, and a picture’s extension', () => {
    for (const name of [preview, `${key}=w1200-h630.png`, `${key}=w640-h480-p-k-no.jpg`, `${key}=W1200-H630-P.PNG`, ` ${key}=w1200-h630-rw.webp `]) expect(isInlinePicture({ name }), name).toBe(true)
  })
  it('a photo, a screenshot and a paper are still files', () => {
    const names = [
      'IMG_1893.jpeg',
      'Screenshot 2026-05-16 at 10.48.14 AM.png',
      'image001.pdf',
      // The size with no key before it, a short word before it, or a name a person typed with a space.
      '=w1200-h630-p.png',
      'plan=w1200-h630.png',
      `site plan ${key}=w1200-h630.png`,
      // Not a picture, and not at the end of the name.
      `${key}=w1200-h630-p.pdf`,
      `${key}=w1200-h630-p.png.pdf`,
      `${key}=w1200-h630-p`,
      // The key and no size, or only one side of it.
      `${key}.png`,
      `${key}=w1200.png`,
      `${key}=s220.png`,
    ]
    for (const name of names) expect(isInlinePicture({ name }), name).toBe(false)
  })
  it('a mail that carries nothing else offers no press', () => {
    expect(bidMailState([file({ id: 'preview', name: preview })])).toEqual({ kind: 'none' })
    expect(bidMailState([file({ id: 'preview', name: preview }), file({ id: 'logo', name: 'image001.png' })])).toEqual({ kind: 'none' })
  })
  it('beside a real file it is listed and starts unticked', () => {
    const state = bidMailState([file({ id: 'a' }), file({ id: 'preview', name: preview })])
    if (state.kind !== 'keep') throw new Error('not a keep')
    expect(state.ready.map((f) => f.id)).toEqual(['a', 'preview'])
    expect(bidMailDraft(mail, state.ready, []).picked).toEqual(['a'])
  })
  it('the list under Plan sets leaves out a mail that carries only one beside its link', () => {
    const at = '2026-11-16T15:04:00.000Z'
    const rows = [
      { id: 'm1', at, subject: 'Folder', who_text: 'x', message_attachments: [{ kind: 'file', name: preview }, { kind: 'link', name: 'Google Drive' }] },
      { id: 'm2', at, subject: 'Specs', who_text: 'x', message_attachments: [{ kind: 'file', name: preview }, { kind: 'file', name: 'specs.pdf' }] },
    ]
    expect(bidMailLines(rows).map((m) => `${m.id}:${m.files}`)).toEqual(['m2:1'])
  })
})

describe('the form, filled from the mail', () => {
  it('names the set from the subject, dates it the mail’s own day, and says who it came from', () => {
    const ready = [file({ id: 'a' }), file({ id: 'b' })]
    expect(bidMailDraft(mail, ready, [])).toEqual({ into: INTO_NEW, name: 'Addendum 2, revised plumbing specs', planDate: '2026-11-16', memo: 'Came by mail from Dana Whitfield, Nov 16.', picked: ['a', 'b'] })
  })
  it('a mail with no subject and no sender still gets a name and a memo', () => {
    const d = bidMailDraft({ subject: '', who: '', at: mail.at }, [file({ id: 'a' })], [])
    expect(d.name).toBe('Mail of Nov 16')
    expect(d.memo).toBe('Came by mail, Nov 16.')
  })
  it('a later mail of the same conversation goes into the set the first one made', () => {
    const sets = [
      { id: 'set-1', name: 'addendum 2, revised plumbing specs', link: FOLDER },
      { id: 'set-2', name: 'Issued set', link: FOLDER },
    ]
    expect(bidMailDraft(mail, [file({ id: 'a' })], sets).into).toBe('set-1')
    // A set of that name the app cannot file into is not picked: the files start as a new set.
    expect(bidMailDraft(mail, [file({ id: 'a' })], [{ id: 'set-1', name: 'Addendum 2, revised plumbing specs', link: 'https://example.com/plans.pdf' }]).into).toBe(INTO_NEW)
  })
  it('reads the sender from the line’s who words', () => {
    expect(mailSender('Dana Whitfield to the bids box')).toBe('Dana Whitfield')
    expect(mailSender('Sam to Dana Whitfield · from Sam’s mail')).toBe('Sam')
    expect(mailSender('Dana Whitfield')).toBe('Dana Whitfield')
    expect(mailSender(null)).toBe('')
    expect(cameByMailMemo('Dana Whitfield to the bids box', mail.at)).toBe('Came by mail from Dana Whitfield, Nov 16.')
  })
  it('reads the name off a From that carries the address, as the company boxes write it (v2.7556)', () => {
    expect(mailSender('Dana Whitfield <dana@ridgeway.example> to bids@')).toBe('Dana Whitfield')
    expect(mailSender('"Whitfield, Dana" <dana@ridgeway.example> to bids@, cc Sam')).toBe('Whitfield, Dana')
    expect(mailSender('<dana@ridgeway.example> to bids@')).toBe('dana@ridgeway.example')
    expect(mailSender('dana@ridgeway.example to bids@')).toBe('dana@ridgeway.example')
    expect(cameByMailMemo('Dana Whitfield <dana@ridgeway.example> to bids@', mail.at)).toBe('Came by mail from Dana Whitfield, Nov 16.')
    expect(bidMailLineWords({ who: 'Dana Whitfield <dana@ridgeway.example> to bids@', at: mail.at, files: 1 })).toBe('Dana Whitfield · Nov 16 · 1 file')
  })
  it('offers a new set first, then only the sets whose link is a Drive folder', () => {
    expect(isDriveFolderLink(FOLDER)).toBe(true)
    expect(isDriveFolderLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view')).toBe(false)
    expect(isDriveFolderLink(null)).toBe(false)
    expect(
      putIntoOptions([
        { id: 'set-1', name: 'Issued set', link: FOLDER, plan_date: '2026-10-30' },
        { id: 'set-2', name: 'GC’s marked copy', link: 'https://example.com/a.pdf', plan_date: null },
        { id: 'set-3', name: 'Addendum 1', link: FOLDER, plan_date: null },
      ]),
    ).toEqual([
      { value: INTO_NEW, label: 'A new set' },
      { value: 'set-1', label: 'Issued set · Oct 30, 2026' },
      { value: 'set-3', label: 'Addendum 1' },
    ])
  })
  it('holds the press until a file is ticked and a new set has a name', () => {
    const d = bidMailDraft(mail, [file({ id: 'a' })], [])
    expect(bidMailDraftProblem(d)).toBeNull()
    expect(bidMailDraftProblem({ ...d, picked: [] })).toBe('Tick a file to keep.')
    expect(bidMailDraftProblem({ ...d, name: '  ' })).toBe('Give the set a name.')
    expect(bidMailDraftProblem({ ...d, planDate: 'Nov 16' })).toBe('Pick the date from the calendar.')
    // A set already on the bid needs no name from the form.
    expect(bidMailDraftProblem({ ...d, into: 'set-1', name: '' })).toBeNull()
  })
})

describe('the button says what it will do, with its count', () => {
  it('a new set, a set already there, a file held, and nothing ticked', () => {
    expect(keepPressWords(2, 0, 'B482', null)).toEqual({ button: 'Keep 2 files as a set on B482', foot: null, dead: false })
    expect(keepPressWords(1, 0, 'B482', 'Addendum 1')).toEqual({ button: 'Add 1 file to Addendum 1', foot: null, dead: false })
    expect(keepPressWords(2, 1, 'B482', null)).toEqual({ button: 'Keep 2 files as a set on B482', foot: '1 file stays in Gmail. We hold no copy of it.', dead: false })
    expect(keepPressWords(1, 2, 'B482', null).foot).toBe('2 files stay in Gmail. We hold no copy of them.')
    expect(keepPressWords(0, 0, 'B482', null)).toEqual({ button: 'Keep files', foot: 'Tick a file to keep.', dead: true })
    expect(keepPressWords(0, 0, 'B482', 'Addendum 1').button).toBe('Add files')
    expect(KEEP_ON_BID_LABEL).toBe('Keep its files on the bid…')
  })
})

describe('what it says after', () => {
  it('green when everything landed', () => {
    expect(bidKeptWords({ setName: 'Addendum 2', joined: false, landed: 2, failed: [], left: [] }, 'B482')).toEqual({ words: 'Kept on B482 as Addendum 2. The mail’s 2 files are in the set’s folder.', tone: 'success' })
    expect(bidKeptWords({ setName: 'Addendum 1', joined: true, landed: 1, failed: [], left: [] }, 'B482')).toEqual({ words: 'Added to Addendum 1 on B482. The mail’s file is in the set’s folder.', tone: 'success' })
  })
  it('names the file that stayed in Gmail and the file that did not land, with its reason', () => {
    const said = bidKeptWords({ setName: 'Addendum 2', joined: false, landed: 1, failed: [{ name: 'P-201.pdf', why: 'Drive did not answer' }], left: [{ name: 'Full-set.pdf', leftWhy: 'too_big' }, { name: 'old.pdf', leftWhy: 'not_copied' }] }, 'B482')
    expect(said.tone).toBe('warning')
    expect(said.words).toBe('Kept on B482 as Addendum 2. The mail’s file is in the set’s folder. Full-set.pdf stays in Gmail, too big for us to keep. old.pdf stays in Gmail, never copied here. One file did not land: P-201.pdf: Drive did not answer.')
    expect(bidKeptWords({ setName: 'Addendum 2', joined: false, landed: 0, failed: [{ name: 'a.pdf', why: 'x' }, { name: 'b.pdf', why: 'y.' }], left: [] }, 'B482').words).toBe('Kept on B482 as Addendum 2. 2 files did not land: a.pdf: x. b.pdf: y.')
  })
  it('the mark a kept mail wears', () => {
    expect(mailKeptWords(['Addendum 2'], 'B482')).toBe('Kept as Addendum 2 on B482')
    expect(mailKeptWords(['Addendum 2', 'Addendum 2'], 'B482')).toBe('Kept as Addendum 2 on B482')
    expect(mailKeptWords(['Addendum 2', 'Issued set'], 'B482')).toBe('Kept in 2 sets on B482')
    expect(mailKeptWords([''], 'B482')).toBe('Kept on B482')
  })
  it('reads a file’s size, or nothing when the row holds none', () => {
    // The attachment row's own words (lineFiles' sizeWords), so the form and the row above it agree (v2.7556).
    expect(fileSizeWords(2_202_009)).toBe('2.2 MB')
    expect(fileSizeWords(248_000)).toBe('248 KB')
    expect(fileSizeWords(400)).toBe('400 bytes')
    expect(fileSizeWords(0)).toBe('')
    expect(fileSizeWords(null)).toBe('')
  })
})

describe('mailBySet: the mail a set came from', () => {
  it('reads each set’s mail from the files filed into it, the first file’s mail when two mails fed one set', () => {
    const mails = mailBySet([
      { bid_plan_set_id: 'set-1', message_id: 'm1', messages: { contact_id: 'c-dana', contacts: { kind: 'customer' } } },
      { bid_plan_set_id: 'set-1', message_id: 'm2', messages: { contact_id: 'c-dana', contacts: { kind: 'customer' } } },
      { bid_plan_set_id: 'set-2', message_id: 'm3', messages: { contact_id: 'c-arch', contacts: null } },
      // A row the reader's policies hid the mail of, and a file in no set, name no mail.
      { bid_plan_set_id: 'set-3', message_id: 'm4', messages: null },
      { bid_plan_set_id: null, message_id: 'm5', messages: { contact_id: 'c-dana', contacts: { kind: 'customer' } } },
    ])
    expect([...mails]).toEqual([
      ['set-1', { messageId: 'm1', contactId: 'c-dana', contactKind: 'customer' }],
      ['set-2', { messageId: 'm3', contactId: 'c-arch', contactKind: null }],
    ])
  })
})

describe('the list under the bid’s Plan sets', () => {
  it('keeps the mail that carries a file, a link not counted, and names each one', () => {
    const lines = bidMailLines([
      { id: 'm1', at: '2026-11-16T15:04:00.000Z', subject: ' Re: Addendum 2 ', who_text: 'Dana Whitfield to the bids box', message_attachments: [{ kind: 'file' }, { kind: 'file' }, { kind: 'link' }] },
      { id: 'm2', at: '2026-11-15T15:04:00.000Z', subject: null, who_text: null, message_attachments: [{ kind: 'file' }] },
      { id: 'm3', at: '2026-11-14T15:04:00.000Z', subject: 'A link only', who_text: 'x', message_attachments: [{ kind: 'link' }] },
      { id: 'm4', at: '2026-11-13T15:04:00.000Z', subject: 'No file', who_text: 'x', message_attachments: null },
    ])
    expect(lines).toEqual([
      { id: 'm1', at: '2026-11-16T15:04:00.000Z', subject: 'Re: Addendum 2', who: 'Dana Whitfield to the bids box', files: 2 },
      { id: 'm2', at: '2026-11-15T15:04:00.000Z', subject: '(no subject)', who: '', files: 1 },
    ])
    expect(bidMailLineWords(lines[0]!)).toBe('Dana Whitfield · Nov 16 · 2 files')
    expect(bidMailLineWords(lines[1]!)).toBe('Nov 15 · 1 file')
  })
})

describe('plain words', () => {
  it('the feet and the lines a first-timer reads keep to the rules', () => {
    for (const words of [keepPressWords(2, 1, 'B482', null).foot!, keepPressWords(1, 2, 'B482', null).foot!, keepPressWords(0, 0, 'B482', null).foot!, nothingToKeepWords(1), nothingToKeepWords(3), bidKeptWords({ setName: 'Addendum 2', joined: false, landed: 2, failed: [], left: [] }, 'B482').words]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})
