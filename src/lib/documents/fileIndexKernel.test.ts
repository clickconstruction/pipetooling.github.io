import { describe, expect, it } from 'vitest'
import {
  budgetAllows,
  cutText,
  type DriveFileMeta,
  driveQueryTerm,
  EXCERPT_PDF_LIMITS,
  exportMimeOf,
  type FileHome,
  folderKindOf,
  headlineToExcerpt,
  heldWhyWords,
  type HomeAt,
  INDEX_PDF_LIMITS,
  INDEX_TEXT_MAX_CHARS,
  indexPassWords,
  indexPlan,
  indexRowOf,
  type KnownRow,
  newPassSpend,
  ocrRefusedColumns,
  PASS_READ_BUDGET_MS,
  PASS_READ_MAX_BYTES,
  passCursor,
  passMayTake,
  PDF_READ_BUDGET_MS,
  type PdfDoc,
  pdfPagesText,
  readColumns,
  readingRowOf,
  RETAKE_WHYS,
  RETRY_HOLD_MS,
  retryDue,
  SWEEP_RETAKE_ROWS,
  sameInstant,
  settledWhy,
  SWEEP_CURSOR_MARK,
  sweepSince,
  sweepStamp,
  TEXT_PDF_MAX_BYTES,
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
    // #285: an email file is decoded, by its kind or its name.
    expect(textKindOf({ name: 'Re: the rock.eml', mimeType: 'application/octet-stream' })).toBe('eml')
    expect(textKindOf({ name: 'mail', mimeType: 'message/rfc822' })).toBe('eml')
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
    ['same', { drive_file_id: 'same', modified_at: '2026-10-14T15:00:00+00:00', text_why: null, text_source: 'pdf_layer', checked_at: '2026-11-02T05:00:00Z' }],
    ['moved', { drive_file_id: 'moved', modified_at: '2026-10-01T00:00:00Z', text_why: null, text_source: 'pdf_layer', checked_at: '2026-11-02T05:00:00Z' }],
    ['slow', { drive_file_id: 'slow', modified_at: '2026-10-14T15:00:00Z', text_why: 'slow', text_source: null, checked_at: '2026-11-02T06:50:00Z' }],
    ['stopped', { drive_file_id: 'stopped', modified_at: '2026-10-14T15:00:00Z', text_why: 'reading', text_source: null, checked_at: '2026-11-02T05:00:00Z' }],
    ['scan', { drive_file_id: 'scan', modified_at: '2026-10-14T15:00:00Z', text_why: 'scan', text_source: null, checked_at: '2026-11-02T05:00:00Z' }],
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
    // A retry takes a held row only when its last check is an hour old: slow was checked ten minutes before, stopped two hours.
    const now = new Date('2026-11-02T07:00:00Z')
    const retry = indexPlan(listed, known, { retry: true, now })
    expect(retry.toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'stopped'])
    expect(retry.skipped).toContainEqual({ id: 'slow', why: 'held' })
    expect(indexPlan(listed, known, { retry: true, now: new Date('2026-11-02T08:00:00Z') }).toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'slow', 'stopped'])
  })

  it('retryDue: a row with no stamp or a stamp an hour old is due, a fresh one waits', () => {
    const now = new Date('2026-11-02T07:00:00Z')
    expect(retryDue(null, now)).toBe(true)
    expect(retryDue('2026-11-02T06:00:00Z', now)).toBe(true)
    expect(retryDue('2026-11-02T06:00:01Z', now)).toBe(false)
    expect(retryDue('not a time', now)).toBe(true)
    expect(RETRY_HOLD_MS).toBe(60 * 60 * 1000)
  })

  it('takes a scan once OCR is set up, when it was never tried or tried over a day ago (PR 3)', () => {
    const now = new Date('2026-11-02T12:00:00Z')
    expect(indexPlan(listed, known, { ocr: true, now }).toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'scan'])
    const tried = new Map(known)
    tried.set('scan', { ...known.get('scan')!, ocr_tried_at: '2026-11-02T08:00:00Z' })
    expect(indexPlan(listed, tried, { ocr: true, now }).toIndex.map((f) => f.id)).toEqual(['new', 'moved'])
    tried.set('scan', { ...known.get('scan')!, ocr_tried_at: '2026-10-30T08:00:00Z' })
    const due = indexPlan(listed, tried, { ocr: true, now })
    expect(due.toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'scan'])
    expect([...due.forOcr]).toEqual(['scan'])
    // A scan of a kind Document AI does not read (a phone's HEIC) is never due, however old its try, so it cannot
    // hold the OCR queue or keep a job from being done.
    const heic = file({ id: 'heic', name: 'IMG_0412.heic', mimeType: 'image/heic' })
    const withHeic = new Map(tried)
    withHeic.set('heic', { drive_file_id: 'heic', modified_at: heic.modifiedTime ?? null, text_why: 'scan', text_source: null, checked_at: '2026-11-02T05:00:00Z', ocr_tried_at: null })
    const plan = indexPlan([...listed, heic], withHeic, { ocr: true, now })
    expect(plan.toIndex.map((f) => f.id)).toEqual(['new', 'moved', 'scan'])
    expect(plan.skipped).toContainEqual({ id: 'heic', why: 'current' })
    expect(plan.forOcr.has('heic')).toBe(false)
    // A scan past Document AI's inline cap is the same: stamped once with the reason, never due again.
    const large = file({ id: 'large', name: 'Set.pdf', size: String(30 * 1024 * 1024) })
    const withLarge = new Map(tried)
    withLarge.set('large', { drive_file_id: 'large', modified_at: large.modifiedTime ?? null, text_why: 'scan', text_source: null, checked_at: '2026-11-02T05:00:00Z', ocr_tried_at: null })
    expect(indexPlan([large], withLarge, { ocr: true, now }).toIndex).toEqual([])
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
    expect(readingRowOf(file(), walk, NOW)).toMatchObject({ text: null, text_why: 'reading', text_source: null, ocr_tried_at: null, ocr_pages: null, ocr_note: null })
    expect(settledWhy('reading')).toBe('slow')
    expect(settledWhy('big')).toBe('big')
    expect(settledWhy(null)).toBeNull()
  })
})

describe('the OCR columns on a row (PR 3)', () => {
  const walk = { home: JOB, via: null, names: [], path: '' }
  it('a scan read by OCR keeps the source, the pages and the try; a refused try keeps the reason and stays a scan; no try leaves the columns null', () => {
    const read = indexRowOf(file({ name: 'Permit scan.pdf' }), walk, { text: 'PERMIT 2026-0412', source: 'ocr', pages: 2 }, NOW, { tried: true, note: null })
    expect(read).toMatchObject({ text: 'PERMIT 2026-0412', text_source: 'ocr', text_why: null, pages: 2, ocr_tried_at: NOW.toISOString(), ocr_pages: 2, ocr_note: null })
    const refused = indexRowOf(file({ name: 'Permit scan.pdf' }), walk, { why: 'scan' }, NOW, { tried: true, note: 'Document AI answered PERMISSION_DENIED: the API is not enabled.' })
    expect(refused).toMatchObject({ text: null, text_source: null, text_why: 'scan', ocr_tried_at: NOW.toISOString(), ocr_pages: null, ocr_note: 'Document AI answered PERMISSION_DENIED: the API is not enabled.' })
    expect(indexRowOf(file(), walk, { why: 'scan' }, NOW)).toMatchObject({ ocr_tried_at: null, ocr_pages: null, ocr_note: null })
  })

  it('the OCR pass patches a known scan with the read’s columns alone, or the refusal’s try and reason (v2.6491)', () => {
    const read = readColumns({ text: 'PERMIT 2026-0412', source: 'ocr', pages: 2 }, NOW, { tried: true, note: null })
    // The same columns the whole row carries for the same read, and none of the file's own: the row keeps its home, name and time.
    const whole = indexRowOf(file({ name: 'Permit scan.pdf' }), walk, { text: 'PERMIT 2026-0412', source: 'ocr', pages: 2 }, NOW, { tried: true, note: null })
    for (const [k, v] of Object.entries(read)) expect(whole[k as keyof typeof whole]).toEqual(v)
    expect(Object.keys(read).sort()).toEqual(['checked_at', 'embed_note', 'embed_tried_at', 'embedded_at', 'indexed_at', 'ocr_note', 'ocr_pages', 'ocr_tried_at', 'pages', 'pages_read', 'text', 'text_source', 'text_why'])
    expect(read).toMatchObject({ text: 'PERMIT 2026-0412', text_source: 'ocr', text_why: null, pages: 2, pages_read: 2, indexed_at: NOW.toISOString(), ocr_pages: 2, ocr_note: null, embedded_at: null, embed_tried_at: null, embed_note: null })
    // A refusal moves neither the text nor the index stamp: the row stays a scan, checked now, due again a day later.
    expect(ocrRefusedColumns('Document AI answered PERMISSION_DENIED: the API is not enabled.', NOW)).toEqual({ ocr_tried_at: NOW.toISOString(), ocr_note: 'Document AI answered PERMISSION_DENIED: the API is not enabled.', checked_at: NOW.toISOString() })
    expect(ocrRefusedColumns(null, NOW).ocr_note).toBe('no reason given')
    expect(RETAKE_WHYS).toEqual(['slow', 'reading'])
    expect(SWEEP_RETAKE_ROWS).toBe(5)
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
    expect(indexPassWords({ indexed: 12, held: [{ id: 'a', name: 'a', why: 'scan' }], remaining: 28 })).toBe('Indexed 12 files, 11 with their words, 1 held, 28 to go.')
    expect(indexPassWords({ indexed: 9, held: Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: String(i), why: 'scan' as const })), remaining: 0 })).toBe('Indexed 9 files, 2 with their words, 7 held.')
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

describe('a PDF inside its time budget (v2.6332)', () => {
  /** A made-up document: each page's items, and how long the clock moves while that page is read. */
  const doc = (pages: { items: unknown[]; ms?: number }[], clock: { t: number }): PdfDoc & { read: number[]; cleaned: number[] } => {
    const read: number[] = []
    const cleaned: number[] = []
    return {
      numPages: pages.length,
      read,
      cleaned,
      getPage: async (n: number) => ({
        getTextContent: async () => {
          read.push(n)
          clock.t += pages[n - 1]!.ms ?? 0
          return { items: pages[n - 1]!.items }
        },
        cleanup: () => cleaned.push(n),
      }),
    }
  }
  const limits = { maxPages: 100, budgetMs: 800 }

  it('reads every page when the time allows, in the shape unpdf merges: line ends kept, runs of space one, at most one blank line', async () => {
    const clock = { t: 0 }
    const pdf = doc([{ items: [{ str: 'SHEET  P-101', hasEOL: true }, { str: 'WATER HEATER' }, { str: '  ' }, { str: 'WH-1', hasEOL: true }, { notText: true }] }, { items: [] }, { items: [{ str: 'GENERAL NOTES' }] }], clock)
    const r = await pdfPagesText(pdf, limits, () => clock.t)
    expect(r.text).toBe('SHEET P-101\nWATER HEATER WH-1\n\nGENERAL NOTES')
    expect(r.pagesRead).toBe(3)
    expect(pdf.cleaned).toEqual([1, 2, 3])
  })

  it('stops between pages once its time is spent, keeps what it read, and always reads the first page', async () => {
    const clock = { t: 0 }
    const dense = { items: [{ str: 'a sheet' }], ms: 300 }
    const pdf = doc([dense, dense, dense, dense, dense], clock)
    const r = await pdfPagesText(pdf, limits, () => clock.t)
    expect(pdf.read).toEqual([1, 2, 3])
    expect(r.pagesRead).toBe(3)
    expect(r.text).toBe('a sheet\na sheet\na sheet')
    // One sheet that takes longer than the whole budget still counts, so the next file is never blocked by nothing read.
    const slow = { t: 0 }
    const one = doc([{ items: [{ str: 'heavy' }], ms: 5000 }, { items: [{ str: 'never' }] }], slow)
    expect(await pdfPagesText(one, limits, () => slow.t)).toEqual({ text: 'heavy', pagesRead: 1 })
    // The clock starts with the document open: a cold worker's slow load never costs a short letter its pages.
    const cold = { t: 900 }
    const opened = doc([{ items: [{ str: 'first' }] }, { items: [{ str: 'second' }] }], cold)
    expect(await pdfPagesText(opened, limits, () => cold.t)).toEqual({ text: 'first\nsecond', pagesRead: 2 })
  })

  it('stops at the page cap and at the text cap', async () => {
    const clock = { t: 0 }
    const page = { items: [{ str: 'x' }] }
    const capped = doc([page, page, page], clock)
    expect((await pdfPagesText(capped, { maxPages: 2, budgetMs: 800 }, () => clock.t)).pagesRead).toBe(2)
    const long = { items: [{ str: 'y'.repeat(INDEX_TEXT_MAX_CHARS) }] }
    expect((await pdfPagesText(doc([long, long, long], clock), limits, () => clock.t)).pagesRead).toBe(1)
  })

  it('lets a pass start a file only when it fits: the first always, the rest by what they should cost and hold', () => {
    const pdf = (mb: number) => file({ size: String(mb * 1024 * 1024) })
    // The first file of a request always starts, so a call makes progress.
    expect(passMayTake(pdf(12), newPassSpend())).toBe(true)
    // A PDF over the cap is held with no download, so it costs nothing and never stops a pass.
    expect(passMayTake(pdf(13), { ms: 5000, bytes: 15 * 1024 * 1024 })).toBe(true)
    // A small PDF fits where a dense one does not.
    expect(passMayTake(pdf(1), { ms: 1000, bytes: 1 })).toBe(true)
    expect(passMayTake(pdf(8), { ms: 1000, bytes: 1 })).toBe(false)
    expect(passMayTake(pdf(8), { ms: 400, bytes: 1 })).toBe(true)
    // The bytes one request holds: a second large set waits for the next request, whatever the clock says.
    expect(passMayTake(pdf(10), { ms: 10, bytes: 7 * 1024 * 1024 })).toBe(false)
    expect(passMayTake(pdf(9), { ms: 10, bytes: 7 * 1024 * 1024 })).toBe(true)
    // A file with no parse goes on until the budget is spent, and an unknown size reads as small.
    const doc1 = file({ name: 'Scope.gdoc', mimeType: 'application/vnd.google-apps.document', size: null })
    expect(passMayTake(doc1, { ms: PASS_READ_BUDGET_MS - 1, bytes: 0 })).toBe(true)
    expect(passMayTake(doc1, { ms: PASS_READ_BUDGET_MS, bytes: 0 })).toBe(false)
    expect(passMayTake(file({ size: null }), { ms: 1100, bytes: 0 })).toBe(true)
    // The budgets fit under the platform's two seconds of CPU, and its 256 MB, however the worst file lands.
    expect(PASS_READ_BUDGET_MS - 150 + PDF_READ_BUDGET_MS).toBeLessThan(2000)
    expect(PASS_READ_MAX_BYTES).toBeGreaterThan(TEXT_PDF_MAX_BYTES)
    expect(PASS_READ_MAX_BYTES).toBeLessThanOrEqual(16 * 1024 * 1024)
  })

  it('reads for the index and for a search’s ten excerpts by different limits', () => {
    // A 25 MB plan set alone ran a worker out of memory on prod, and an 11 MB one read through (v2.6408).
    expect(INDEX_PDF_LIMITS).toMatchObject({ maxBytes: 12 * 1024 * 1024, passMaxBytes: 16 * 1024 * 1024 })
    expect(EXCERPT_PDF_LIMITS).toEqual({ maxBytes: 8 * 1024 * 1024, maxPages: 40, budgetMs: 300, passBudgetMs: 1000, passMaxBytes: 24 * 1024 * 1024 })
  })

  it('a row keeps the pages and how many its read reached; a file read whole reads the same; a held file has neither', () => {
    const walk = { home: null, via: null, names: [], path: '' }
    expect(indexRowOf(file(), walk, { text: 'cover sheet', source: 'pdf_layer', pages: 212, pagesRead: 9 }, NOW)).toMatchObject({ pages: 212, pages_read: 9 })
    expect(indexRowOf(file(), walk, { text: 'a letter', source: 'pdf_layer', pages: 2 }, NOW)).toMatchObject({ pages: 2, pages_read: 2 })
    expect(indexRowOf(file(), walk, { why: 'big' }, NOW)).toMatchObject({ pages: null, pages_read: null })
  })
})
