import { describe, expect, it } from 'vitest'
import { BOERNE, FAIR_OAKS, HELOTES, IMG_2041, MB, ROCK_CLAUSE, STONE_OAK } from '../../test/fixtures/jobFilesDemo'
import { plainWordsFailures } from '../plainWords'
import { jobFiles, type JobFile } from './jobFiles'
import {
  EMAIL_FILE_LIMIT_BYTES,
  addDraftFile,
  attachPicker,
  chipFacts,
  chipHover,
  draftFromDevice,
  draftFromJob,
  emailFileNote,
  landingFor,
  linkFor,
  linkLines,
  previewFacts,
  sentCopyFoot,
  sentFiles,
  textFileNote,
  waysOut,
  type DraftFile,
  type LinkMakers,
} from './outgoing'

const byName = (files: JobFile[], name: string): JobFile => {
  const f = files.find((x) => x.name === name)
  if (!f) throw new Error(`no ${name}`)
  return f
}
const boerne = jobFiles(BOERNE)
const addendum = draftFromJob(byName(boerne, 'Addendum 2.pdf'))
const planSet = draftFromJob(byName(boerne, 'Boerne Retail Shell plans, rev 2'))
const bidTab = draftFromJob(byName(boerne, 'Bid tab, Sitework.pdf'))
const sow = draftFromJob(byName(jobFiles(STONE_OAK), 'Statement of work, Sitework.pdf'))
const contract = draftFromJob(byName(jobFiles(HELOTES), 'Our contract.pdf'))
const payApp = draftFromJob(byName(jobFiles(FAIR_OAKS), 'Pay application 3.pdf'))
const rock = draftFromDevice(ROCK_CLAUSE.key, ROCK_CLAUSE.name, ROCK_CLAUSE.bytes, 'pdf', 'computer')
const photo = draftFromDevice(IMG_2041.key, IMG_2041.name, IMG_2041.bytes, 'image', 'photo')

/** Greg's portal link, and the Drive handler's signed link to one file. */
const GREG_LINKS: LinkMakers = { portal: (page) => `https://app.example/t/greg-token#${page}`, file: (f) => `https://app.example/f/${f.key}` }
/** A customer with no portal pages yet, and Jonah the architect, who has no portal. */
const NO_PORTAL: LinkMakers = { portal: null, file: GREG_LINKS.file }

const big = (name: string, bytes: number): DraftFile => ({ key: `job:${name}`, name, bytes, kind: 'pdf', from: 'job', planSet: false, portalPage: null })

describe('waysOut: how each file goes', () => {
  it('sends the addendum as the file on an email, and the plan set as our link however small', () => {
    expect(waysOut([addendum, planSet], 'email').map((w) => [w.file.name, w.way, w.why])).toEqual([
      ['Addendum 2.pdf', 'file', null],
      ['Boerne Retail Shell plans, rev 2', 'link', 'plan_set'],
    ])
  })

  it('sends a file over 10 MB, or of unknown size, as our link', () => {
    const ways = waysOut([big('Survey.pdf', EMAIL_FILE_LIMIT_BYTES + 1), { ...bidTab, bytes: null }, big('Exactly.pdf', EMAIL_FILE_LIMIT_BYTES)], 'email')
    expect(ways.map((w) => [w.way, w.why])).toEqual([
      ['link', 'over_limit'],
      ['link', 'size_unknown'],
      ['file', null],
    ])
  })

  it('adds the files up: three 9 MB papers are 27 MB, so the first goes as our link and the other two fit', () => {
    const ways = waysOut([big('A.pdf', 9 * MB), big('B.pdf', 9 * MB), big('C.pdf', 9 * MB)], 'email')
    expect(ways.map((w) => [w.file.name, w.way, w.why])).toEqual([
      ['A.pdf', 'link', 'message_too_big'],
      ['B.pdf', 'file', null],
      ['C.pdf', 'file', null],
    ])
  })

  it('sends the largest as links first until the rest fit', () => {
    const ways = waysOut([big('Small.pdf', 2 * MB), big('Nine.pdf', 9 * MB), big('Eight.pdf', 8 * MB), big('Seven.pdf', 7 * MB)], 'email')
    expect(ways.filter((w) => w.way === 'link').map((w) => w.file.name)).toEqual(['Nine.pdf'])
  })

  it('sends a photo as the picture on an email, and as our link once it is over the limit', () => {
    expect(waysOut([photo], 'email')[0]?.way).toBe('picture')
    expect(waysOut([{ ...photo, bytes: 12 * MB }], 'email')[0]).toMatchObject({ way: 'link', why: 'over_limit' })
  })

  it('sends every file on a text as our link, a photo too, since Quo sends no picture messages', () => {
    expect(waysOut([addendum, rock, sow, photo], 'text').map((w) => [w.way, w.why])).toEqual([
      ['link', null],
      ['link', null],
      ['link', null],
      ['link', null],
    ])
  })
})

describe('our link: their portal page when they have it, else the file', () => {
  it("opens Greg's portal at the plans for the plan set and the addendum", () => {
    expect(linkFor(planSet, 'trade', GREG_LINKS)).toEqual({ to: 'portal', page: 'plans', url: 'https://app.example/t/greg-token#plans' })
    expect(linkFor(sow, 'trade', GREG_LINKS)).toEqual({ to: 'portal', page: 'sow', url: 'https://app.example/t/greg-token#sow' })
  })

  it('opens the file for a file with no page, a page their portal lacks, a customer with no pages yet, and an architect', () => {
    expect(linkFor(bidTab, 'trade', GREG_LINKS).to).toBe('file')
    expect(linkFor(contract, 'trade', GREG_LINKS).to).toBe('file')
    expect(linkFor(contract, 'customer', NO_PORTAL)).toEqual({ to: 'file', url: 'https://app.example/f/paper:contract:contract-helotes' })
    expect(linkFor(planSet, 'arch', GREG_LINKS).to).toBe('file')
  })

  it("opens Dr. Raman's portal at the contract once the customer pages land, but never at the plans", () => {
    const priya: LinkMakers = { portal: (page) => `https://app.example/c/priya#${page}`, file: GREG_LINKS.file }
    expect(linkFor(contract, 'customer', priya)).toEqual({ to: 'portal', page: 'contract', url: 'https://app.example/c/priya#contract' })
    expect(linkFor(planSet, 'customer', priya).to).toBe('file')
  })

  it('puts one line on a text per portal page, however many files point at it, and one per file with no page, a photo too', () => {
    const lines = linkLines(waysOut([addendum, planSet, bidTab, photo], 'text'), 'trade', GREG_LINKS)
    expect(lines).toEqual([
      { text: 'The plans are in your portal: ', url: 'https://app.example/t/greg-token#plans' },
      { text: 'Bid tab, Sitework.pdf: ', url: 'https://app.example/f/drive:drv-bid-tab' },
      { text: 'IMG_2041.jpg: ', url: 'https://app.example/f/device:img-2041' },
    ])
  })

  it("gives Elena the pay application's own link while the customer pages are not there", () => {
    expect(linkLines(waysOut([payApp], 'text'), 'customer', NO_PORTAL)).toEqual([{ text: 'Pay application 3.pdf: ', url: 'https://app.example/f/paper:payapp:payapp-3' }])
  })
})

describe('the send window’s file notes', () => {
  it('says why each file goes as our link on an email, and what the link opens', () => {
    expect(emailFileNote(waysOut([addendum, planSet], 'email'), 'trade', GREG_LINKS)).toBe(
      'Boerne Retail Shell plans, rev 2 goes as our link, the way a plan set always has. The link opens their portal at the plans. The link is ours, not Drive’s. We see when it is opened, never who, and we can cut it off.',
    )
    expect(emailFileNote(waysOut([big('Survey.pdf', 12 * MB), { ...bidTab, bytes: null }], 'email'), 'trade', GREG_LINKS)).toBe(
      "Survey.pdf is over the email limit, so it goes as our link. We do not know how big Bid tab, Sitework.pdf is yet, so it goes as our link. Our link opens that one file in the job's Drive folder. The link is ours, not Drive’s. We see when it is opened, never who, and we can cut it off.",
    )
    expect(emailFileNote(waysOut([big('A.pdf', 9 * MB), big('B.pdf', 9 * MB), big('C.pdf', 9 * MB)], 'email'), 'arch', NO_PORTAL)).toMatch(/^The files together are over the email limit, so A\.pdf goes as our link\./)
  })

  it('has no note when every file goes as the file', () => {
    expect(emailFileNote(waysOut([addendum, sow], 'email'), 'trade', GREG_LINKS)).toBeNull()
  })

  it('says on a text that every file goes as our link, photos too', () => {
    expect(textFileNote(waysOut([photo, addendum], 'text'))).toBe('A text cannot carry a file or a photo, so each goes as our link. It opens their portal when the file has a page there.')
    expect(textFileNote(waysOut([photo, { ...photo, key: 'p2' }], 'text'))).toBe('A text cannot carry a photo, so each goes as our link.')
    expect(textFileNote(waysOut([bidTab], 'text'))).toBe('A text cannot carry a file, so each goes as our link.')
    expect(textFileNote([])).toBeNull()
  })

  it('draws each chip in the email preview with how it goes and its size', () => {
    const ways = waysOut([addendum, planSet, { ...bidTab, bytes: null }], 'email')
    expect(ways.map((w) => chipFacts(w, 'trade', GREG_LINKS))).toEqual([['412 KB'], ['our link to their portal'], ['our link to it in Drive']])
  })

  it('says where a chip came from and how it goes on each channel', () => {
    expect(chipHover(rock)).toEqual(['From this computer.', "It goes into the job's Team only folder on the way out.", 'On an email it goes as the file.', 'On a text it goes as our link, to their portal when the file has a page there.'])
    expect(chipHover(planSet)).toEqual(['From the job.', 'A plan set always goes as our link.', 'On an email it goes as our link.', 'On a text it goes as our link, to their portal when the file has a page there.'])
    expect(chipHover(photo)).toEqual(['A photo from this device.', 'On an email it goes as the picture.', 'On a text it goes as our link to the photo.'])
  })

  it('says the copy keeps its files', () => {
    expect(sentCopyFoot(0)).toBe('A copy of this email is kept in Documents.')
    expect(sentCopyFoot(1)).toBe('A copy of this email is kept in Documents, with its file.')
    expect(sentCopyFoot(3)).toBe('A copy of this email is kept in Documents, with its files.')
  })
})

describe('the message keeps its files', () => {
  it('keeps each file with how it went, and the link when it went as one', () => {
    expect(sentFiles(waysOut([addendum, planSet, photo], 'email'), 'trade', GREG_LINKS).map((f) => [f.name, f.sentAs, f.link])).toEqual([
      ['Addendum 2.pdf', 'file', null],
      ['Boerne Retail Shell plans, rev 2', 'link', 'https://app.example/t/greg-token#plans'],
      ['IMG_2041.jpg', 'picture', null],
    ])
  })

  it('lands a file from this computer in Team only and a photo in the job’s photos', () => {
    expect(landingFor(rock)).toEqual({ folder: ['Team only', 'Sent by us'], words: "Kept on the message and in the job's Team only folder." })
    expect(landingFor(photo)).toEqual({ folder: ['Photos'], words: "Goes as the picture on an email and as our link on a text. Saved to the job's photos." })
    expect(landingFor(addendum)).toBeNull()
  })

  it('puts a file on the message once, by its key', () => {
    const one = addDraftFile([], addendum)
    expect(one).toEqual({ ok: true, files: [addendum], toast: 'Addendum 2.pdf is on the message.' })
    expect(one.ok && addDraftFile(one.files, { ...addendum })).toEqual({ ok: false, toast: 'That one is on it already.' })
    expect(one.ok && addDraftFile(one.files, { ...addendum, key: 'drive:another' }).ok).toBe(true)
  })
})

describe('the Attach picker', () => {
  it("lists Boerne's files for Greg with their size, how a big one goes and where it sits in his portal", () => {
    const pk = attachPicker('B482 Boerne Retail Shell', boerne, 'trade', [], true)
    expect(pk.jobHead).toBe('From B482 Boerne Retail Shell')
    expect(pk.jobRows.map((r) => [r.name, r.facts])).toEqual([
      ['Boerne Retail Shell plans, rev 2', ['a plan set, so it goes as our link', 'in their portal under the plans']],
      ['Bid tab, Sitework.pdf', ['96 KB']],
      ['Addendum 2.pdf', ['412 KB', 'in their portal under the plans']],
    ])
    expect(pk.jobEmpty).toBeNull()
    expect(pk.starred).toEqual([])
    expect(pk.device.map((r) => r.name)).toEqual(['A file from this computer', 'A photo'])
  })

  it('names no portal page a customer’s portal lacks', () => {
    expect(attachPicker('B482 Boerne Retail Shell', boerne, 'customer', [], false).jobRows[2]?.facts).toEqual(['412 KB'])
  })

  it('stars the step’s papers first, with their portal link when they have one', () => {
    const pk = attachPicker('#42 Stone Oak Pharmacy', jobFiles(STONE_OAK), 'trade', [{ paper: 'w9', short: 'W-9' }], true)
    expect(pk.starred.map((r) => [r.key, r.name, r.facts])).toEqual([
      ['form:w9', 'The W-9 form', ['What they fill in and send back, or upload in their portal.']],
      ['portal:papers', 'Their portal link', ['Uploads there land on their Documents and finish the step.']],
    ])
    expect(attachPicker('#42 Stone Oak Pharmacy', [], 'arch', [{ paper: 'w9', short: 'W-9' }], false).starred.map((r) => r.key)).toEqual(['form:w9'])
  })

  it('says why there is nothing to pick on a message tied to no job, and when a job has nothing yet', () => {
    const none = attachPicker(null, boerne, 'trade', [], true)
    expect(none.jobHead).toBe("This message is on nobody's job, so nothing to pick from a job.")
    expect(none.jobRows).toEqual([])
    expect(attachPicker('B491 Boerne Retail Pad B', [], 'trade', [], true).jobEmpty).toBe('Nothing on this job yet.')
  })

  it('heads the preview with the size, the pages when known, how it goes and the job', () => {
    expect(previewFacts(byName(jobFiles(STONE_OAK), 'Statement of work, Sitework.pdf'), 4, 'Stone Oak Pharmacy')).toEqual(['210 KB', '4 pages', 'from Stone Oak Pharmacy'])
    expect(previewFacts(byName(boerne, 'Boerne Retail Shell plans, rev 2'), null, 'Boerne Retail Shell')).toEqual(['a plan set, so it goes as our link', 'from Boerne Retail Shell'])
    expect(previewFacts({ ...byName(boerne, 'Addendum 2.pdf'), bytes: 30 * MB }, 1, null)).toEqual(['30 MB', '1 page', 'over the email limit, so it goes as our link', 'from the job'])
  })
})

describe('plain words', () => {
  it('keeps every note, hover line, toast and picker line plain', () => {
    const notes = [
      emailFileNote(waysOut([addendum, planSet], 'email'), 'trade', GREG_LINKS),
      emailFileNote(waysOut([big('Survey.pdf', 12 * MB), big('Drawings.pdf', 14 * MB), { ...bidTab, bytes: null }], 'email'), 'arch', NO_PORTAL),
      emailFileNote(waysOut([big('A.pdf', 9 * MB), big('B.pdf', 9 * MB), big('C.pdf', 9 * MB)], 'email'), 'customer', NO_PORTAL),
      textFileNote(waysOut([photo, addendum], 'text')),
      sentCopyFoot(2),
      ...[rock, planSet, photo, addendum, { ...bidTab, bytes: null }].flatMap(chipHover),
      addDraftFile([addendum], addendum).toast,
      landingFor(rock)?.words,
      landingFor(photo)?.words,
    ]
    const pk = attachPicker(null, [], 'trade', [{ paper: 'w9', short: 'W-9' }], true)
    const picker = [pk.jobHead, ...pk.starred.flatMap((r) => r.facts), ...pk.device.flatMap((r) => r.facts), attachPicker('B491', [], 'trade', [], true).jobEmpty]
    for (const s of [...notes, ...picker]) expect(plainWordsFailures(s ?? '')).toEqual([])
  })
})
