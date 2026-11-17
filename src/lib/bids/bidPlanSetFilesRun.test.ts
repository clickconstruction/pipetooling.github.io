import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BID_PLANS_FOLDER_NAME,
  BID_SET_WRITE_ROLES,
  bidSetFileFacts,
  bidSetFolderHoldWords,
  civilDay,
  parseBidPlanSetFilesAsk,
  runBidPlanSetFiles,
  type BidMailAttachmentRow,
  type BidMailLineRow,
  type BidPlanSetFilesAsk,
  type BidPlanSetFilesDeps,
  type BidPlanSetFilesDrive,
  type BidSetFileFacts,
  type BidSetFolderSeen,
  type BidSetRow,
} from '../../../supabase/functions/_shared/bidPlanSetFilesRun'

/**
 * The rules of `bid-plan-set-files` (punch list #368, PR 1) over a fake database and a fake Drive: who may keep a
 * mail's files as a set on a bid, what is checked before anything is made, how a second press joins the set already
 * there, and when a file's row takes its mark. Every refusal also says nothing was made. Made-up rows only.
 */

const CALLER = 'user-estimator'
const BID = '11111111-1111-4111-8111-111111111111'
const OTHER_BID = '99999999-9999-4999-8999-999999999999'
const MAIL = '22222222-2222-4222-8222-222222222222'
const SET = '33333333-3333-4333-8333-333333333333'
const ATT = '44444444-4444-4444-8444-444444444444'
const PLANS = 'folder-plans'
const NOW = '2026-11-16T15:31:00.000Z'
const urlOf = (id: string) => `https://drive.example/folders/${id}`

type World = {
  me: { role?: string | null; read_only?: boolean; is_digital_twin?: boolean } | null
  seesBid: boolean
  mail: BidMailLineRow | null
  set: BidSetRow | null
  attachment: BidMailAttachmentRow | null
  /** The sets the table holds, by the folder their link points at. */
  sets: BidSetRow[]
  driveOn: boolean
  plansHold: string | null
  seen: BidSetFolderSeen
  insertFails: string | null
  stampFails: boolean
  factsFail: boolean
  bytes: Uint8Array | null
  /** Drive as it stands, and what the run did to it. */
  folders: Array<{ id: string; parent: string; name: string }>
  files: Array<{ id: string; folder: string; name: string; size: number; mime: string | null }>
  inserted: Array<Record<string, unknown>>
  stamped: Array<{ attachmentId: string; setId: string }>
  facts: Array<{ setId: string; facts: BidSetFileFacts }>
  plansAsked: number
  uploads: number
}

function makeWorld(over: Partial<World> = {}): World {
  return {
    me: { role: 'estimator', read_only: false, is_digital_twin: false },
    seesBid: true,
    mail: { id: MAIL, bid_id: BID, channel: 'email' },
    set: { id: SET, bid_id: BID, name: 'Addendum 2', link: urlOf('folder-set') },
    attachment: { id: ATT, kind: 'file', name: 'specs-rev2.pdf', mime: 'application/pdf', bucket_path: 'gm/1-specs-rev2.pdf', message_bid_id: BID },
    sets: [],
    driveOn: true,
    plansHold: null,
    seen: 'ok',
    insertFails: null,
    stampFails: false,
    factsFail: false,
    bytes: new Uint8Array([1, 2, 3]),
    folders: [],
    files: [],
    inserted: [],
    stamped: [],
    facts: [],
    plansAsked: 0,
    uploads: 0,
    ...over,
  }
}

function depsOf(w: World): BidPlanSetFilesDeps {
  const drive: BidPlanSetFilesDrive = {
    plansFolder: async () => {
      w.plansAsked += 1
      return w.plansHold ? { why: w.plansHold } : { id: PLANS }
    },
    findOrCreateFolder: async (parentId, name) => {
      const found = w.folders.find((f) => f.parent === parentId && f.name === name)
      if (found) return { id: found.id, created: false }
      const made = { id: `folder-${w.folders.length + 1}`, parent: parentId, name }
      w.folders.push(made)
      return { id: made.id, created: true }
    },
    seeFolder: async () => ({ seen: w.seen, owner: w.seen === 'outside_drive' ? 'Pat Example' : null }),
    filesNamed: async (folderId, name) => w.files.filter((f) => f.folder === folderId && f.name === name).map((f) => ({ id: f.id, size: f.size })),
    filesIn: async (folderId) => w.files.filter((f) => f.folder === folderId).map((f) => ({ name: f.name, size: f.size, mime: f.mime })),
    upload: async (folderId, bytes, name, mime) => {
      w.uploads += 1
      const file = { id: `file-${w.files.length + 1}`, folder: folderId, name, size: bytes.length, mime }
      w.files.push(file)
      return { id: file.id }
    },
  }
  return {
    readMe: async () => w.me,
    setsOnFolder: async (folderId) => w.sets.filter((s) => s.link.includes(folderId)),
    stampAttachment: async (attachmentId, setId) => {
      if (w.stampFails) throw new Error('The file is in the set’s folder, but the mail did not take its mark: timeout')
      w.stamped.push({ attachmentId, setId })
    },
    stampFileFacts: async (setId, facts) => {
      if (w.factsFail) throw new Error('timeout')
      w.facts.push({ setId, facts })
    },
    download: async () => w.bytes,
    canSeeBid: async () => w.seesBid,
    readMail: async () => w.mail,
    readSet: async () => w.set,
    readAttachment: async () => w.attachment,
    insertSet: async (row) => {
      if (w.insertFails) throw new Error(`The folder is made, but the set did not save: ${w.insertFails}`)
      w.inserted.push(row)
      const set = { id: `set-${w.sets.length + 1}`, bid_id: row.bid_id, name: row.name, link: row.link }
      w.sets.push(set)
      return set
    },
    folderIdFromUrl: (url) => /folders\/([\w-]+)/.exec(url ?? '')?.[1] ?? null,
    folderUrl: urlOf,
    fileUrl: (id) => `https://drive.example/file/${id}`,
    appEmail: () => 'app@example.iam',
    nowIso: () => NOW,
    drive: async () => (w.driveOn ? drive : null),
  }
}

const keepAsk = (over: Partial<Extract<BidPlanSetFilesAsk, { action: 'keep' }>> = {}): BidPlanSetFilesAsk => ({ action: 'keep', bidId: BID, messageId: MAIL, name: 'Addendum 2, revised specs', memo: 'Came by mail from Dana Whitfield, Nov 16.', planDate: '2026-11-16', ...over })
const saveAsk: BidPlanSetFilesAsk = { action: 'save_attachment', setId: SET, attachmentId: ATT }
const run = (ask: BidPlanSetFilesAsk, w: World) => runBidPlanSetFiles(ask, CALLER, depsOf(w))
/** Nothing was made: no folder asked for, no row, no upload, no mark. */
const untouched = (w: World) => w.plansAsked === 0 && w.folders.length === 0 && w.inserted.length === 0 && w.uploads === 0 && w.stamped.length === 0

describe('parseBidPlanSetFilesAsk', () => {
  it('takes a keep and a save, and nothing else', () => {
    expect(parseBidPlanSetFilesAsk({ action: 'keep', bid_id: BID, message_id: MAIL, name: '  Addendum   2 ', memo: ' note ', plan_date: ' 2026-11-16 ' })).toEqual({ action: 'keep', bidId: BID, messageId: MAIL, name: 'Addendum 2', memo: 'note', planDate: '2026-11-16' })
    expect(parseBidPlanSetFilesAsk({ action: 'keep', bid_id: BID, message_id: MAIL })).toEqual({ action: 'keep', bidId: BID, messageId: MAIL, name: '', memo: '', planDate: '' })
    expect(parseBidPlanSetFilesAsk({ action: 'save_attachment', set_id: SET, attachment_id: ATT })).toEqual({ action: 'save_attachment', setId: SET, attachmentId: ATT })
    expect(parseBidPlanSetFilesAsk({ action: 'keep', bid_id: 'b482', message_id: MAIL, name: 'x' })).toBeNull()
    expect(parseBidPlanSetFilesAsk({ action: 'save_attachment', set_id: SET })).toBeNull()
    expect(parseBidPlanSetFilesAsk({ action: 'folder', set_id: SET })).toBeNull()
    expect(parseBidPlanSetFilesAsk(null)).toBeNull()
  })
  it('cuts a long name and memo on whole characters', () => {
    const ask = parseBidPlanSetFilesAsk({ action: 'keep', bid_id: BID, message_id: MAIL, name: 'n'.repeat(260), memo: 'm'.repeat(2400) })
    expect(ask).toMatchObject({ action: 'keep' })
    if (ask?.action !== 'keep') throw new Error('not a keep')
    expect(ask.name).toHaveLength(200)
    expect(ask.memo).toHaveLength(2000)
  })
})

describe('civilDay', () => {
  it('holds a real day and refuses the rest', () => {
    expect(civilDay('2026-11-16')).toBe('2026-11-16')
    expect(civilDay('2026-02-30')).toBeNull()
    expect(civilDay('11/16/2026')).toBeNull()
    expect(civilDay('')).toBeNull()
  })
})

describe('who may', () => {
  it('names the roles the table’s own insert policy names', () => {
    const dir = resolve(process.cwd(), 'supabase/migrations')
    const newest = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => readFileSync(resolve(dir, f), 'utf8').includes('CREATE POLICY bid_plan_sets_insert'))
      .pop()
    expect(newest).toBeTruthy()
    const sql = readFileSync(resolve(dir, newest!), 'utf8')
    const policy = sql.slice(sql.indexOf('CREATE POLICY bid_plan_sets_insert'), sql.indexOf('DROP POLICY IF EXISTS bid_plan_sets_update'))
    const roles = [...policy.matchAll(/'(\w+)'::public\.user_role/g)].map((m) => m[1])
    expect(roles.length).toBeGreaterThan(0)
    expect([...roles].sort()).toEqual([...BID_SET_WRITE_ROLES].sort())
  })
  it.each([
    ['no account read', { me: null }, 'Your account did not read, so nothing changed.'],
    ['a digital twin', { me: { role: 'estimator', is_digital_twin: true } }, 'A digital twin cannot change Drive.'],
    ['a training account', { me: { role: 'assistant', read_only: true } }, 'A training account cannot change Drive.'],
    ['a helper', { me: { role: 'helpers' } }, 'Only the office and the estimators add a set of plans to a bid.'],
    ['a primary', { me: { role: 'primary' } }, 'Only the office and the estimators add a set of plans to a bid.'],
  ] as const)('refuses %s on both asks, with nothing made', async (_who, over, words) => {
    for (const ask of [keepAsk(), saveAsk]) {
      const w = makeWorld(over as Partial<World>)
      const reply = await run(ask, w)
      expect(reply).toEqual({ status: 403, body: { error: words } })
      expect(untouched(w)).toBe(true)
    }
  })
  it('lets each writing role keep', async () => {
    for (const role of BID_SET_WRITE_ROLES) {
      const reply = await run(keepAsk(), makeWorld({ me: { role } }))
      expect(reply.status, role).toBe(200)
    }
  })
})

describe('keep: the set’s folder and its row', () => {
  it('makes Plans › the set’s name and adds the set, as the caller, pointing at the folder', async () => {
    const w = makeWorld()
    const reply = await run(keepAsk(), w)
    expect(w.folders).toEqual([{ id: 'folder-1', parent: PLANS, name: 'Addendum 2, revised specs' }])
    expect(w.inserted).toEqual([{ bid_id: BID, name: 'Addendum 2, revised specs', memo: 'Came by mail from Dana Whitfield, Nov 16.', plan_date: '2026-11-16', link: urlOf('folder-1'), created_by: CALLER }])
    expect(reply).toEqual({ status: 200, body: { set: { id: 'set-1', bid_id: BID, name: 'Addendum 2, revised specs', link: urlOf('folder-1') }, folderUrl: urlOf('folder-1'), made: true, reused: false } })
    expect(BID_PLANS_FOLDER_NAME).toBe('Plans')
  })
  it('keeps a set with no date, and a name with a slash as a folder with a dash', async () => {
    const w = makeWorld()
    await run(keepAsk({ name: 'Addendum 2/3', planDate: '' }), w)
    expect(w.folders[0]!.name).toBe('Addendum 2-3')
    expect(w.inserted[0]).toMatchObject({ name: 'Addendum 2/3', plan_date: null })
  })
  it.each([
    ['no name', keepAsk({ name: '' }), {}, 400, 'Give the set a name.'],
    ['a date that is not a day', keepAsk({ planDate: '2026-02-30' }), {}, 400, 'That date is not a day on the calendar.'],
    ['a bid the caller cannot see', keepAsk(), { seesBid: false }, 404, 'This bid is not one you can see.'],
    ['a mail the caller cannot see', keepAsk(), { mail: null }, 404, 'That mail is not one you can see.'],
    ['a text', keepAsk(), { mail: { id: MAIL, bid_id: BID, channel: 'text' } }, 409, 'Only an email’s files are kept as a set of plans.'],
    ['a mail tied to another bid', keepAsk(), { mail: { id: MAIL, bid_id: OTHER_BID, channel: 'email' } }, 409, 'That mail is not tied to this bid. Tie it to the bid first.'],
    ['a mail tied to no bid', keepAsk(), { mail: { id: MAIL, bid_id: null, channel: 'email' } }, 409, 'That mail is not tied to this bid. Tie it to the bid first.'],
    ['Drive not set up', keepAsk(), { driveOn: false }, 503, 'Drive is not set up here yet.'],
  ] as const)('refuses %s before anything is made', async (_what, ask, over, status, words) => {
    const w = makeWorld(over as Partial<World>)
    const reply = await run(ask, w)
    expect(reply.status).toBe(status)
    expect(reply.body.error).toBe(words)
    expect(untouched(w)).toBe(true)
  })
  it('says why the bid’s folder is held, and adds no set', async () => {
    const w = makeWorld({ plansHold: 'The app cannot open this bid’s project folder. Share it with app@example.iam as an editor. Nothing was made. The mail keeps its files.' })
    const reply = await run(keepAsk(), w)
    expect(reply).toEqual({ status: 409, body: { error: w.plansHold, why: 'folder_held' } })
    expect(w.folders).toEqual([])
    expect(w.inserted).toEqual([])
  })
  it('a second press, or a later mail under the same name, joins the set already there', async () => {
    const w = makeWorld()
    const first = await run(keepAsk(), w)
    const second = await run(keepAsk({ memo: 'another mail' }), w)
    expect(w.inserted).toHaveLength(1)
    expect(w.folders).toHaveLength(1)
    expect(second.body).toEqual({ set: (first.body as { set: BidSetRow }).set, folderUrl: urlOf('folder-1'), made: false, reused: true })
  })
  it('takes a folder of that name nobody holds: a keep whose row did not save is finished by the next try', async () => {
    const w = makeWorld({ insertFails: 'permission denied' })
    await expect(run(keepAsk(), w)).rejects.toThrow('The folder is made, but the set did not save: permission denied')
    expect(w.folders).toHaveLength(1)
    w.insertFails = null
    const again = await run(keepAsk(), w)
    expect(w.folders).toHaveLength(1)
    expect(w.inserted).toHaveLength(1)
    expect(again.body).toMatchObject({ made: false, reused: false, folderUrl: urlOf('folder-1') })
  })
  it('steps past a folder another bid’s set points at', async () => {
    const w = makeWorld({ folders: [{ id: 'folder-theirs', parent: PLANS, name: 'Addendum 2, revised specs' }], sets: [{ id: 'set-theirs', bid_id: OTHER_BID, name: 'Addendum 2, revised specs', link: urlOf('folder-theirs') }] })
    const reply = await run(keepAsk(), w)
    expect(w.folders.map((f) => f.name)).toEqual(['Addendum 2, revised specs', 'Addendum 2, revised specs · 2'])
    expect(reply.body).toMatchObject({ made: true, reused: false })
    expect(w.inserted[0]).toMatchObject({ link: urlOf('folder-2') })
  })
})

describe('save_attachment: one of the mail’s files into the set’s folder', () => {
  it('files our copy, marks the file’s row with the set, and says what the folder holds', async () => {
    const w = makeWorld()
    const reply = await run(saveAsk, w)
    expect(w.files).toEqual([{ id: 'file-1', folder: 'folder-set', name: 'specs-rev2.pdf', size: 3, mime: 'application/pdf' }])
    expect(w.stamped).toEqual([{ attachmentId: ATT, setId: SET }])
    expect(w.facts).toEqual([{ setId: SET, facts: { file_name: 'specs-rev2.pdf', file_size: 3, file_count: 1, checked_at: NOW, check_note: null } }])
    expect(reply).toEqual({ status: 200, body: { driveFileId: 'file-1', url: 'https://drive.example/file/file-1', folderUrl: urlOf('folder-set') } })
  })
  it.each([
    ['a set the caller cannot see', { set: null }, 404, 'That set is not one you can see.'],
    ['a file the caller cannot see', { attachment: null }, 404, 'That file is not one we kept.'],
    ['a link, not a file', { attachment: { id: ATT, kind: 'link', name: 'Dropbox', mime: null, bucket_path: null, message_bid_id: BID } }, 404, 'That file is not one we kept.'],
    ['a file that stayed in Gmail', { attachment: { id: ATT, kind: 'file', name: 'big.pdf', mime: 'application/pdf', bucket_path: null, message_bid_id: BID } }, 409, 'That file stayed in Gmail, so we hold no copy of it to file.'],
    ['a mail tied to another bid', { attachment: { id: ATT, kind: 'file', name: 'a.pdf', mime: 'application/pdf', bucket_path: 'gm/a.pdf', message_bid_id: OTHER_BID } }, 409, 'That mail is not tied to this set’s bid.'],
    ['a mail tied to no bid', { attachment: { id: ATT, kind: 'file', name: 'a.pdf', mime: 'application/pdf', bucket_path: 'gm/a.pdf', message_bid_id: null } }, 409, 'That mail is not tied to this set’s bid.'],
    ['a set whose link is no Drive folder', { set: { id: SET, bid_id: BID, name: 'Issued set', link: 'https://example.com/plans.pdf' } }, 409, 'This set’s link is not a Drive folder. Nothing was made. The mail keeps its files.'],
    ['Drive not set up', { driveOn: false }, 503, 'Drive is not set up here yet.'],
    ['a folder the app cannot add to', { seen: 'cannot_write' }, 409, 'The app can open this set’s folder but cannot add to it. Share it with app@example.iam as an editor. Nothing was made. The mail keeps its files.'],
    ['a folder in a personal Drive', { seen: 'outside_drive' }, 409, 'This set’s folder is in Pat Example’s My Drive, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive. Nothing was made. The mail keeps its files.'],
    ['a copy that does not read', { bytes: null }, 500, 'Our copy of that file did not read.'],
  ] as const)('refuses %s with nothing filed and no mark', async (_what, over, status, words) => {
    const w = makeWorld(over as Partial<World>)
    const reply = await run(saveAsk, w)
    expect(reply.status).toBe(status)
    expect(reply.body.error).toBe(words)
    expect(w.uploads).toBe(0)
    expect(w.stamped).toEqual([])
  })
  it('a second try finds the file that already landed, and still marks it', async () => {
    const w = makeWorld({ files: [{ id: 'file-there', folder: 'folder-set', name: 'specs-rev2.pdf', size: 3, mime: 'application/pdf' }] })
    const reply = await run(saveAsk, w)
    expect(w.uploads).toBe(0)
    expect(w.stamped).toEqual([{ attachmentId: ATT, setId: SET }])
    expect(reply.body).toMatchObject({ driveFileId: 'file-there', reused: true })
  })
  it('a different file of the same name lands beside it under the next name', async () => {
    const w = makeWorld({ files: [{ id: 'file-there', folder: 'folder-set', name: 'specs-rev2.pdf', size: 99, mime: 'application/pdf' }] })
    await run(saveAsk, w)
    expect(w.files.map((f) => f.name)).toEqual(['specs-rev2.pdf', 'specs-rev2 (2).pdf'])
    expect(w.facts[0]!.facts).toMatchObject({ file_name: null, file_count: 2, file_size: 102 })
  })
  it('a mark that fails is an error, and the next try marks the file without filing it twice', async () => {
    const w = makeWorld({ stampFails: true })
    await expect(run(saveAsk, w)).rejects.toThrow('the mail did not take its mark')
    expect(w.uploads).toBe(1)
    w.stampFails = false
    const again = await run(saveAsk, w)
    expect(w.uploads).toBe(1)
    expect(w.stamped).toHaveLength(1)
    expect(again.body).toMatchObject({ reused: true })
  })
  it('the set’s file line failing does not fail the file', async () => {
    const w = makeWorld({ factsFail: true })
    const reply = await run(saveAsk, w)
    expect(reply.status).toBe(200)
    expect(w.stamped).toHaveLength(1)
  })
})

describe('the words and the file line', () => {
  it('says why a folder cannot take a file, with the fix, and nothing for one that can', () => {
    expect(bidSetFolderHoldWords('ok', 'This bid’s project folder', 'app@example.iam', null)).toBeNull()
    expect(bidSetFolderHoldWords('cannot_open', 'This bid’s project folder', 'app@example.iam', null)).toBe('The app cannot open this bid’s project folder. Share it with app@example.iam as an editor. Nothing was made. The mail keeps its files.')
    expect(bidSetFolderHoldWords('outside_drive', 'This bid’s project folder', 'app@example.iam', null)).toContain('is in a personal Drive')
    expect(bidSetFolderHoldWords('not_a_folder', 'This bid’s project folder link', 'app@example.iam', null)).toBe('This bid’s project folder link is not a Drive folder. Nothing was made. The mail keeps its files.')
  })
  it('reads one file by its name, PDFs alone by their count, and a mix as files', () => {
    const pdf = (name: string, size: number) => ({ name, size, mime: 'application/pdf' })
    expect(bidSetFileFacts([pdf('a.pdf', 10)], NOW)).toEqual({ file_name: 'a.pdf', file_size: 10, file_count: 1, checked_at: NOW, check_note: null })
    expect(bidSetFileFacts([pdf('a.pdf', 10), pdf('b.pdf', 5)], NOW)).toMatchObject({ file_name: null, file_size: 15, file_count: 2 })
    expect(bidSetFileFacts([pdf('a.pdf', 10), { name: 'schedule.xlsx', size: 4, mime: 'application/vnd.ms-excel' }], NOW)).toMatchObject({ file_name: '2 files', file_size: 14, file_count: null })
    expect(bidSetFileFacts([], NOW)).toMatchObject({ file_name: null, file_size: null, file_count: null })
  })
})

describe('the function is wired to its rules', () => {
  it('reads the bid, the mail and the set as the caller, and marks the file as the service role', () => {
    const src = readFileSync(resolve(process.cwd(), 'supabase/functions/bid-plan-set-files/index.ts'), 'utf8')
    for (const read of ["mine.from('bids')", "mine.from('messages')", "mine.from('bid_plan_sets').select", "mine.from('message_attachments')", "mine.from('bid_plan_sets').insert"]) expect(src, read).toContain(read)
    expect(src).toContain("admin.from('message_attachments').update({ bid_plan_set_id: setId })")
    expect(src).toContain('refuseArchivedCaller')
  })
})
