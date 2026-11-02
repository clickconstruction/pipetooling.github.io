import { describe, expect, it } from 'vitest'
import {
  budgetAllows,
  cutText,
  type DriveFileMeta,
  driveQueryTerm,
  exportMimeOf,
  type FileHome,
  folderKindOf,
  headlineToExcerpt,
  heldWhyWords,
  type HomeAt,
  INDEX_TEXT_MAX_CHARS,
  indexPassWords,
  indexPlan,
  indexRowOf,
  type KnownRow,
  passCursor,
  readingRowOf,
  sameInstant,
  settledWhy,
  SWEEP_CURSOR_MARK,
  sweepSince,
  sweepStamp,
  textKindOf,
  walkUp,
} from '../../../supabase/functions/_shared/fileIndexKernel'

/**
 * The file index's rules (punch list #240, PR 1): which files are read and how, where a file sits in a job, which
 * listed files a pass takes, how a pass's rows read, the sweep's cursor and the headline as an excerpt. Made-up names:
 * job 1187 Maple Court townhomes, bid 482 Boerne Retail Shell.
 */
const JOB: FileHome = { kind: 'job', id: 'job-1', hcpNumber: '1187', clickNumber: null, name: 'Maple Court townhomes', customerId: 'cust-1' }
const BID: FileHome = { kind: 'bid', id: 'bid-1', number: '482', name: 'Boerne Retail Shell', customerId: null }
const HOMES = new Map<string, HomeAt>([
  ['fJob', { home: JOB, via: null }],
  ['fPlans', { home: JOB, via: 'Plans' }],
  ['fBid', { home: BID, via: null }],
])
const TREE: Record<string, { name: string; parent: string | null }> = {
  fJob: { name: '1187 · Maple Court townhomes', parent: 'fCustomer' },
  fCustomer: { name: 'Ridgeway Builders', parent: 'root' },
  fTeam: { name: 'Team only', parent: 'fJob' },
  fPhotos: { name: 'Photos', parent: 'fTeam' },
  fSent: { name: 'Sent by us', parent: 'fTeam' },
  fPictures: { name: 'Customer Pictures', parent: 'fJob' },
  fRev2: { name: 'Rev 2', parent: 'fPlans' },
  fLoose: { name: 'Loose', parent: 'fCustomer' },
}
const metaOf = async (id: string) => TREE[id] ?? { name: '', parent: null }
const file = (over: Partial<DriveFileMeta> = {}): DriveFileMeta => ({ id: '1AbCdEfGhIjKlMnOpQrSt', name: 'Permit 2026-0412.pdf', mimeType: 'application/pdf', size: '419840', modifiedTime: '2026-10-14T15:00:00Z', parents: ['fJob'], ...over })
const NOW = new Date('2026-11-02T04:00:00Z')

describe('textKindOf', () => {
  it('routes a Google file to export, a PDF to its layer, a text file to its bytes, a picture to a scan, the rest to kind', () => {
    expect(textKindOf({ name: 'Scope', mimeType: 'application/vnd.google-apps.document' })).toBe('export')
    expect(textKindOf({ name: 'Takeoff', mimeType: 'application/vnd.google-apps.spreadsheet' })).toBe('export')
    expect(textKindOf({ name: 'Permit.pdf', mimeType: 'application/pdf' })).toBe('pdf')
    expect(textKindOf({ name: 'Permit.PDF', mimeType: 'application/octet-stream' })).toBe('pdf')
    expect(textKindOf({ name: 'notes.txt', mimeType: 'text/plain' })).toBe('plain')
    expect(textKindOf({ name: 'counts.csv', mimeType: 'application/octet-stream' })).toBe('plain')
    expect(textKindOf({ name: 'IMG_0412.jpg', mimeType: 'image/jpeg' })).toBe('image')
    expect(textKindOf({ name: 'scan.HEIC', mimeType: 'application/octet-stream' })).toBe('image')
    expect(textKindOf({ name: 'plans.dwg', mimeType: 'application/acad' })).toBe('kind')
  })
})

describe('walkUp and folderKindOf', () => {
  it('finds the job from the folder itself, names the folders between, and reads the kind', async () => {
    const top = await walkUp('fJob', HOMES, 'root', metaOf)
    expect(top).toEqual({ home: JOB, via: null, names: [], path: '' })
    expect(folderKindOf(top.home, top.via, top.names)).toBe('top')
    const photos = await walkUp('fPhotos', HOMES, 'root', metaOf)
    expect(photos.path).toBe('Team only › Photos')
    expect(folderKindOf(photos.home, photos.via, photos.names)).toBe('photos')
    const sent = await walkUp('fSent', HOMES, 'root', metaOf)
    expect(folderKindOf(sent.home, sent.via, sent.names)).toBe('sent')
    const pictures = await walkUp('fPictures', HOMES, 'root', metaOf)
    expect(pictures.path).toBe('Customer Pictures')
    expect(folderKindOf(pictures.home, pictures.via, pictures.names)).toBe('pictures')
  })

  it('a hit through the plans link names Plans first, and a folder inside Plans after it', async () => {
    const plans = await walkUp('fPlans', HOMES, 'root', metaOf)
    expect(plans).toEqual({ home: JOB, via: 'Plans', names: [], path: 'Plans' })
    expect(folderKindOf(plans.home, plans.via, plans.names)).toBe('plans')
    const rev2 = await walkUp('fRev2', HOMES, 'root', metaOf)
    expect(rev2.path).toBe('Plans › Rev 2')
    expect(folderKindOf(rev2.home, rev2.via, rev2.names)).toBe('plans')
  })

  it('a bid’s folder is a home with kind other; a folder under no home stops at the root with its path', async () => {
    const bid = await walkUp('fBid', HOMES, 'root', metaOf)
    expect(bid.home).toEqual(BID)
    expect(folderKindOf(bid.home, bid.via, bid.names)).toBe('other')
    const loose = await walkUp('fLoose', HOMES, 'root', metaOf)
    expect(loose).toEqual({ home: null, via: null, names: ['Ridgeway Builders', 'Loose'], path: 'Ridgeway Builders › Loose' })
    expect(folderKindOf(null, null, loose.names)).toBe('other')
    expect(await walkUp(null, HOMES, 'root', metaOf)).toEqual({ home: null, via: null, names: [], path: '' })
  })
})

describe('indexPlan', () => {
  const known = new Map<string, KnownRow>([
    // The row's time as PostgREST reads it back: the same instant as the file's 2026-10-14T15:00:00Z, spelled otherwise.
    ['same', { drive_file_id: 'same', modified_at: '2026-10-14T15:00:00+00:00', text_why: null, text_source: 'pdf_layer' }],
    ['moved', { drive_file_id: 'moved', modified_at: '2026-10-01T00:00:00Z', text_why: null, text_source: 'pdf_layer' }],
    ['slow', { drive_file_id: 'slow', modified_at: '2026-10-14T15:00:00Z', text_why: 'slow', text_source: null }],
    ['stopped', { drive_file_id: 'stopped', modified_at: '2026-10-14T15:00:00Z', text_why: 'reading', text_source: null }],
    ['scan', { drive_file_id: 'scan', modified_at: '2026-10-14T15:00:00Z', text_why: 'scan', text_source: null }],
  ])
  const listed = [file({ id: 'new' }), file({ id: 'same' }), file({ id: 'moved' }), file({ id: 'slow' }), file({ id: 'stopped' }), file({ id: 'scan' }), file({ id: 'same' }), file({ id: 'folder', mimeType: 'application/vnd.google-apps.folder' })]

  it('takes a new file and a changed one, skips a current one, and holds a slow or stopped read unless asked to retry', () => {
    const plan = indexPlan(listed, known)
    expect(plan.toIndex.map((f) => f.id)).toEqual(['new', 'moved'])
    expect(plan.skipped).toEqual([
      { id: 'same', why: 'current' },
      { id: 'slow', why: 'held' },
      { id: 'stopped', why: 'held' },
      { id: 'scan', why: 'current' },
    ])
    expect(indexPlan(listed, known, { retry: true }).toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'slow', 'stopped'])
  })
})

describe('indexRowOf and readingRowOf', () => {
  const walk = { home: JOB, via: null, names: ['Team only', 'Sent by us'], path: 'Team only › Sent by us' }

  it('writes the home, the kind, the caps and the text’s source', () => {
    const row = indexRowOf(file(), walk, { text: 'x'.repeat(INDEX_TEXT_MAX_CHARS + 5) + '\u0000', source: 'pdf_layer', pages: 3 }, NOW)
    expect(row).toMatchObject({ drive_file_id: '1AbCdEfGhIjKlMnOpQrSt', jobs_ledger_id: 'job-1', bid_id: null, customer_id: 'cust-1', folder_kind: 'sent', path: 'Team only › Sent by us', name: 'Permit 2026-0412.pdf', mime: 'application/pdf', bytes: 419840, modified_at: '2026-10-14T15:00:00Z', text_source: 'pdf_layer', text_why: null, pages: 3, indexed_at: NOW.toISOString(), checked_at: NOW.toISOString() })
    expect(row.text).toHaveLength(INDEX_TEXT_MAX_CHARS)
    expect(row.text).not.toContain('\u0000')
  })

  it('a read with no text keeps why and no source; a bid’s file keeps the bid; the reading stamp is a row with why reading', () => {
    const held = indexRowOf(file({ size: null, name: '' }), { home: BID, via: null, names: [], path: '' }, { why: 'scan' }, NOW)
    expect(held).toMatchObject({ bid_id: 'bid-1', jobs_ledger_id: null, customer_id: null, folder_kind: 'other', name: 'Untitled', bytes: null, text: null, text_source: null, text_why: 'scan', pages: null })
    expect(readingRowOf(file(), walk, NOW)).toMatchObject({ text: null, text_why: 'reading', text_source: null })
    expect(settledWhy('reading')).toBe('slow')
    expect(settledWhy('big')).toBe('big')
    expect(settledWhy(null)).toBeNull()
  })
})

describe('the budget, the sweep’s cursor and the words', () => {
  it('budgetAllows stops at the budget', () => {
    expect(budgetAllows(0, 24_999)).toBe(true)
    expect(budgetAllows(0, 25_000)).toBe(false)
    expect(budgetAllows(0, 5, 10)).toBe(true)
  })

  it('the cursor is the last listed file handled, taken or passed over, and stops at the first file left untaken', () => {
    const listed = [file({ id: 'a', modifiedTime: '2026-11-02T01:00:00Z' }), file({ id: 'b', modifiedTime: '2026-11-02T02:00:00Z' }), file({ id: 'c', modifiedTime: '2026-11-02T03:00:00Z' }), file({ id: 'd', modifiedTime: '2026-11-02T04:00:00Z' })]
    // Every file current (a backfill ran): nothing to take, the cursor still reaches the last file.
    expect(passCursor(listed, new Set(), new Set())).toBe('2026-11-02T04:00:00Z')
    // b and d need indexing; b was taken, d was left: the cursor stops before d, past c which was current.
    expect(passCursor(listed, new Set(['b', 'd']), new Set(['b']))).toBe('2026-11-02T03:00:00Z')
    // The budget ran out before the first file that needed indexing.
    expect(passCursor(listed, new Set(['a']), new Set())).toBeNull()
    expect(passCursor([], new Set(), new Set())).toBeNull()
  })

  it('the stamp is now when nothing is left, the cursor (marked) when some is, and kept when the pass handled nothing', () => {
    expect(sweepStamp(NOW, '2026-11-02T03:50:00Z', 0)).toBe(NOW.toISOString())
    expect(sweepStamp(NOW, '2026-11-02T03:50:00Z', 3)).toBe(`2026-11-02T03:50:00Z${SWEEP_CURSOR_MARK}`)
    expect(sweepStamp(NOW, null, 3)).toBeNull()
    // A wall-clock stamp is listed from two minutes back; a cursor from its own instant, inclusively, with no overlap,
    // so a dense minute of uploads (forty files inside the overlap, all current) can never hold the stamp still.
    expect(sweepSince('2026-11-02T03:50:00.000Z')).toEqual({ since: '2026-11-02T03:48:00.000Z', inclusive: false })
    expect(sweepSince(`2026-11-02T03:50:00.000Z${SWEEP_CURSOR_MARK}`)).toEqual({ since: '2026-11-02T03:50:00.000Z', inclusive: true })
    expect(sweepSince(null)).toEqual({ since: '1970-01-01T00:00:00.000Z', inclusive: false })
    expect(sweepSince('not a time')).toEqual({ since: '1970-01-01T00:00:00.000Z', inclusive: false })
  })

  it('sameInstant reads Drive’s and PostgREST’s spellings of one time as the same, and two nulls as the same', () => {
    expect(sameInstant('2026-10-14T15:00:00.000Z', '2026-10-14T15:00:00+00:00')).toBe(true)
    expect(sameInstant('2026-10-14T15:00:00.123Z', '2026-10-14T15:00:00.123+00:00')).toBe(true)
    expect(sameInstant('2026-10-14T15:00:00.000Z', '2026-10-14T15:00:01+00:00')).toBe(false)
    expect(sameInstant(null, null)).toBe(true)
    expect(sameInstant('2026-10-14T15:00:00.000Z', null)).toBe(false)
    expect(sameInstant('not a time', 'not a time')).toBe(true)
  })

  it('cuts text on a whole character, and names a Sheet’s export kind', () => {
    expect(cutText('abc', 5)).toBe('abc')
    expect(cutText('abcdef', 3)).toBe('abc')
    expect(cutText('ab😀', 3)).toBe('ab')
    expect(exportMimeOf('application/vnd.google-apps.spreadsheet')).toBe('text/csv')
    expect(exportMimeOf('application/vnd.google-apps.document')).toBe('text/plain')
  })

  it('escapes a Drive query term', () => {
    expect(driveQueryTerm("rock 'n' roll\\")).toBe("rock \\'n\\' roll\\\\")
  })

  it('counts a pass in words, and names a held file’s reason', () => {
    expect(indexPassWords({ indexed: 1, held: [], remaining: 0 })).toBe('Indexed 1 file.')
    expect(indexPassWords({ indexed: 12, held: [{ id: 'a', name: 'a', why: 'scan' }], remaining: 28 })).toBe('Indexed 12 files, 1 held, 28 to go.')
    expect(indexPassWords({ indexed: 0, held: [{ id: 'a', name: 'a', why: 'big' }, { id: 'b', name: 'b', why: 'slow' }], remaining: 0 })).toBe('Indexed 0 files, 2 held.')
    expect(heldWhyWords('scan')).toBe('a scan with no text to read')
    expect(heldWhyWords('slow')).toBe('the read ran out of time')
  })
})

describe('headlineToExcerpt', () => {
  it('turns ts_headline’s marks into spans, merging two a space apart so the phrase bolds as one', () => {
    expect(headlineToExcerpt('the GC agreed to the <mark>rock</mark> <mark>clause</mark> as written')).toEqual({ text: 'the GC agreed to the rock clause as written', marks: [[21, 32]] })
  })

  it('collapses the text’s line breaks, keeps marks apart when words sit between, and reads a headline with no marks as plain', () => {
    expect(headlineToExcerpt('a <mark>permit</mark>\n  for the\n<mark>trench</mark> here')).toEqual({ text: 'a permit for the trench here', marks: [[2, 8], [17, 23]] })
    expect(headlineToExcerpt('nothing marked')).toEqual({ text: 'nothing marked', marks: [] })
  })
})
