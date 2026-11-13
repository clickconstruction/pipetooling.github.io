/**
 * The dev seat reads a Drive folder and files a bid's sent paper from Drive onto its bid (punch list #339, the bid
 * train's pair 6; server 0.82.0): read_drive_folder, plan_bid_submission → apply_bid_submission. The kernel runs here
 * over a stood-in database (the seat's Reader) and a stood-in Drive (DriveGet); every name is made up.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_SUBMISSION_VERBS,
  DRIVE_FOLDER_PAGE,
  DRIVE_NAME_MAX,
  DRIVE_READONLY_SCOPE,
  SUBMISSION_LANDING,
  SUBMISSION_LANDING_WORDS,
  SUBMISSION_UPLOAD_MAX_BYTES,
  bidSubmissionAppliedWords,
  bidSubmissionDryRun,
  bidSubmissionInput,
  driveFolderArgs,
  driveGetWith,
  driveIdOf,
  driveKind,
  driveReadRefusal,
  folderReadNextWords,
  isBidSubmissionVerb,
  readBidSubmissionWorld,
  readCompanyDrive,
  readDriveFile,
  readDriveFolder,
  submissionFilingRefusal,
  submissionFolderHold,
  submissionLinkWrite,
  submissionNoteRow,
  submissionNoteText,
  uploadBytesProblem,
  type BidSubmissionPayload,
  type DriveAnswer,
  type DriveGet,
  type Json,
  type SubmissionWorld,
} from '../../../supabase/functions/_shared/devMcpBidSubmission'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { REPLY_MAX_CHARS, replyText } from '../../../supabase/functions/_shared/devMcpDoor'
import { JOB_FOLDER_TREE } from '../../../supabase/functions/_shared/whereFilesGo'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planMismatch, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const FILES_IO = readFileSync('src/lib/bids/bidFilesIo.ts', 'utf8')
const DRIVE_LINK = readFileSync('supabase/functions/drive-link/index.ts', 'utf8')
const BID_FOLDER = readFileSync('supabase/functions/_shared/bidFolder.ts', 'utf8')

const BID = 'aaaaaaaa-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const SA = 'intake@zz-test-project.iam.gserviceaccount.com'
const ROOT = 'zzRootFolder00000000001'
const COMPANY_DRIVE = '0AZZcompanyDrive0001'
const PROJECT = 'zzProjectFolder0000001'
const TEAM = 'zzTeamOnlyFolder000001'
const SENT = 'zzSentByUsFolder000001'
const PAPER = 'zzPaperFile00000000001'
const OTHER = 'zzOtherPaper0000000001'
const MD5 = 'd41d8cd98f00b204e9800998ecf8427e'
const SHA = 'b'.repeat(64)
const FOLDER = 'application/vnd.google-apps.folder'
const linkOf = (id: string) => `https://drive.google.com/file/d/${id}/view`
const folderLink = (id: string) => `https://drive.google.com/drive/folders/${id}`

// ── the stood-in database ────────────────────────────────────────────────────────────────────────────────────────────

type Tables = Record<string, Row[]>
const bidRow = (over: Row = {}): Row => ({ id: BID, bid_number: '398', project_name: 'ZZ Test', address: '1 Made Up Way', created_at: '2026-03-02T15:00:00Z', customer_id: null, service_type_id: 'st1', drive_link: folderLink(PROJECT), bid_submission_link: null, ...over })
const tables = (bid: Row = bidRow(), settings: Row[] = [{ key: 'drive_jobs_root_folder_id', value_text: ROOT }]): Tables => ({
  bids: [bid],
  service_types: [{ id: 'st1', ledger_bid_prefix: 'BP' }],
  app_settings: settings,
  customers: [{ id: 'cust1', name: 'ZZ Made Up Builders' }],
})

function readerOver(t: Tables): Reader & { asked: { table: string; query: RowsQuery }[] } {
  const asked: { table: string; query: RowsQuery }[] = []
  return {
    asked,
    rpc: async (name) => {
      if (name === 'search_bids_for_clock') return (t.bids ?? []).map((b) => ({ id: b.id, bid_number: b.bid_number, service_type_id: b.service_type_id, project_name: b.project_name }))
      throw new Error(`no rpc ${name}`)
    },
    rows: async (table, query) => {
      asked.push({ table, query })
      let rows = t[table] ?? []
      for (const f of query.filters ?? []) {
        if (f.op === 'eq') rows = rows.filter((r) => r[f.column] === f.value)
        if (f.op === 'in') rows = rows.filter((r) => (f.value as unknown[]).includes(r[f.column]))
      }
      return rows
    },
  }
}

// ── the stood-in Drive ───────────────────────────────────────────────────────────────────────────────────────────────

type DriveWorld = {
  /** files.get by id: the body, or a status to refuse with. */
  files: Record<string, Json | { status: number; message?: string }>
  /** files.list by the parent in `q`. */
  children: Record<string, Json[]>
  drives?: Record<string, string>
  permissions?: Record<string, Json[] | { status: number }>
  nextPage?: Record<string, string>
}

const paper = (over: Json = {}): Json => ({ id: PAPER, name: 'ZZ Test Proposal.pdf', mimeType: 'application/pdf', size: '204800', md5Checksum: MD5, sha256Checksum: SHA, modifiedTime: '2026-04-01T14:00:00.000Z', driveId: COMPANY_DRIVE, parents: ['zzIntakeFolder00000001'], webViewLink: linkOf(PAPER), capabilities: { canCopy: true, canDownload: true }, ...over })
const projectFolder = (over: Json = {}): Json => ({ id: PROJECT, name: 'ZZ Test', mimeType: FOLDER, driveId: COMPANY_DRIVE, parents: [ROOT], capabilities: { canAddChildren: true }, ...over })
const driveWorld = (over: Partial<DriveWorld> = {}): DriveWorld => ({
  files: { [ROOT]: { id: ROOT, name: 'Jobs', mimeType: FOLDER, driveId: COMPANY_DRIVE }, [PROJECT]: projectFolder(), [PAPER]: paper(), ...(over.files ?? {}) },
  children: { [PROJECT]: [{ id: TEAM, name: JOB_FOLDER_TREE.teamOnly, mimeType: FOLDER }], [TEAM]: [{ id: SENT, name: JOB_FOLDER_TREE.sentByUs, mimeType: FOLDER }], [SENT]: [], ...(over.children ?? {}) },
  drives: { [COMPANY_DRIVE]: 'ZZ Company Jobs', ...(over.drives ?? {}) },
  permissions: over.permissions ?? {},
  nextPage: over.nextPage ?? {},
})

function driveOver(w: DriveWorld): DriveGet & { calls: { path: string; params: Record<string, string> }[] } {
  const calls: { path: string; params: Record<string, string> }[] = []
  const get = (async (path: string, params: Record<string, string> = {}): Promise<DriveAnswer> => {
    calls.push({ path, params })
    const refuse = (status: number, message = 'File not found') => ({ status, body: { error: { message, errors: [{ reason: status === 404 ? 'notFound' : 'forbidden' }] } } })
    const drive = /^\/drives\/(.+)$/.exec(path)
    if (drive) return w.drives?.[decodeURIComponent(drive[1]!)] ? { status: 200, body: { name: w.drives[decodeURIComponent(drive[1]!)]! } } : refuse(404)
    const perms = /^\/files\/([^/]+)\/permissions$/.exec(path)
    if (perms) {
      const p = w.permissions?.[perms[1]!]
      if (!p) return { status: 200, body: { permissions: [] } }
      return Array.isArray(p) ? { status: 200, body: { permissions: p } } : refuse(p.status, 'The user does not have sufficient permissions for this file')
    }
    const one = /^\/files\/([^/]+)$/.exec(path)
    if (one) {
      const f = w.files[decodeURIComponent(one[1]!)]
      if (!f) return refuse(404)
      if (typeof f.status === 'number' && !('id' in f)) return refuse(f.status, typeof f.message === 'string' ? f.message : undefined)
      return { status: 200, body: f as Json }
    }
    if (path === '/files') {
      const q = params.q ?? ''
      const parent = /^'([^']+)' in parents/.exec(q)?.[1] ?? ''
      let rows = w.children[parent] ?? []
      const named = / and name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]
      if (named !== undefined) rows = rows.filter((r) => r.name === named.replace(/\\'/g, "'"))
      if (/mimeType = 'application\/vnd\.google-apps\.folder'/.test(q)) rows = rows.filter((r) => r.mimeType === FOLDER)
      if (/mimeType != 'application\/vnd\.google-apps\.folder'/.test(q)) rows = rows.filter((r) => r.mimeType !== FOLDER)
      if (params.pageToken && params.pageToken !== w.nextPage?.[parent]) return { status: 400, body: { error: { message: 'Invalid Value', errors: [{ reason: 'invalid' }] } } }
      return { status: 200, body: { files: rows, ...(w.nextPage?.[parent] && !params.pageToken ? { nextPageToken: w.nextPage[parent] } : {}) } }
    }
    return refuse(404)
  }) as DriveGet & { calls: typeof calls }
  get.calls = calls
  return get
}

const input = (over: Json = {}, verb: 'plan_bid_submission' | 'apply_bid_submission' = 'plan_bid_submission'): BidSubmissionPayload => {
  const built = bidSubmissionInput(verb, { submission: { bid: 'b398', drive_file_id: PAPER, ...over }, ...(verb === 'apply_bid_submission' ? { plan_hash: HASH } : {}) })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const CTX = { envRoot: null, serviceAccount: SA }
async function world(drive: DriveWorld = driveWorld(), t: Tables = tables(), over: Json = {}): Promise<SubmissionWorld> {
  const w = await readBidSubmissionWorld(readerOver(t), driveOver(drive), input(over), CTX)
  if ('refused' in w) throw new Error(w.refused)
  return w
}
async function plan(drive: DriveWorld = driveWorld(), t: Tables = tables(), over: Json = {}) {
  const p = input(over)
  return bidSubmissionDryRun(p, await world(drive, t, over), { serviceAccount: SA })
}
async function refusal(drive: DriveWorld = driveWorld(), t: Tables = tables(), over: Json = {}): Promise<string> {
  const dry = await plan(drive, t, over)
  if (dry.ok) throw new Error('the plan was not refused')
  return dry.refused
}
async function reply(drive: DriveWorld = driveWorld(), t: Tables = tables(), over: Json = {}): Promise<Json> {
  const dry = await plan(drive, t, over)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}

// ── the verbs on the list ────────────────────────────────────────────────────────────────────────────────────────────

describe('devMcpBidSubmission — the verbs on the server', () => {
  it('the pair is two write verbs with no RPC, plan before apply, and the read is a tool that writes nothing', () => {
    expect(BID_SUBMISSION_VERBS).toEqual(['plan_bid_submission', 'apply_bid_submission'])
    for (const v of BID_SUBMISSION_VERBS) {
      expect(isBidSubmissionVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_submission')).toBe('plan_bid_submission')
    expect(isBidSubmissionVerb('plan_bid_update')).toBe(false)
    expect(isWriteVerb('read_drive_folder')).toBe(false)
    expect(SERVER).toContain("case 'read_drive_folder': {")
    expect(SERVER).toContain("name: 'read_drive_folder',")
    expect(Object.keys(WRITE_VERBS)).toHaveLength(99)
    expect(SERVER.match(/^ {4}name: '/gm)?.length).toBe(145)
  })
  it('0.82.0: the server, its instructions, the README and the function docs name all three', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.82.0'")
    expect(SERVER).toContain('Writes are ninety-nine verbs and nothing else:')
    expect(SERVER).toContain('plan_bid_submission → apply_bid_submission files the paper that was sent onto its bid')
    expect(SERVER).toContain('read_drive_folder lists a Drive folder or reads one file')
    expect(README).toContain('`read_drive_folder(folder | file, page?)`')
    expect(README).toContain('`plan_bid_submission(submission)` · `apply_bid_submission(submission, plan_hash)`')
    expect(README).toContain('ninety-nine `plan_` / `apply_` / `revert_` verbs')
    expect(README).toContain("ninety-nine since v2.7154's sent paper")
    expect(EDGE).toContain('**v2.7154 (server 0.82.0)')
  })
  it('the header comment counts what WRITE_VERBS holds, not what it held a year ago', () => {
    const rpcs = Object.values(WRITE_VERBS).map((v) => v.rpc).filter((r): r is NonNullable<typeof r> => r !== null)
    expect([Object.keys(WRITE_VERBS).length, rpcs.length, new Set(rpcs).size, Object.keys(WRITE_VERBS).length - rpcs.length]).toEqual([99, 47, 20, 52])
    expect(SERVER).toContain('// are a SECOND path, not a loosening of the first: ninety-nine verbs')
    expect(SERVER).toContain('forty-seven POST one of twenty hard-coded, dev-gated RPCs as the dev')
    expect(SERVER).toContain('the other fifty-two name no RPC')
    expect(SERVER).not.toContain('thirty-seven POST one of fifteen')
  })
  it('the read runs on a read-only token as the dev alone, and the plan reads on the same token', () => {
    expect(DRIVE_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/drive.readonly')
    // Two mints of the read-only token: the read verb's and the pair's dry run. The full token is minted in the copy alone.
    expect(SERVER.match(/googleServiceToken\(saJson, \[DRIVE_READONLY_SCOPE\]\)/g)?.length).toBe(2)
    const branch = SERVER.slice(SERVER.indexOf("case 'plan_bid_submission':"), SERVER.indexOf("    case 'plan_submittal_rows':"))
    expect(branch.indexOf('googleAccessToken(saJson)')).toBeGreaterThan(branch.indexOf('planMismatch(name'))
    expect(branch.match(/googleAccessToken\(/g)?.length).toBe(1)
    expect(SERVER).toContain("if (verb === 'read_drive_folder') return finish(refused('view_as reads as a person")
    expect(SERVER).toContain("if (who.role !== 'dev') return refused('read_drive_folder reads Drive through the intake service account")
  })
  it('the apply uses the doors the app has: the folder press, the upload door, the link write, the note row', () => {
    const branch = SERVER.slice(SERVER.indexOf("case 'plan_bid_submission':"), SERVER.indexOf("    case 'plan_submittal_rows':"))
    expect(branch).toContain("invokeAsDev(session, 'bid-photos', { action: 'make', bid_id: world.bid.id })")
    expect(FILES_IO).toContain("supabase.functions.invoke('bid-photos', { body: { action: 'make', bid_id: bidId } })")
    expect(branch).toContain("invokeAsDev(session, 'drive-link', { action: 'put', job: { bid_id: world.bid.id }, name: file.name, mime: file.mime, where: 'sent', base64: bytesToBase64(bytes) })")
    expect(DRIVE_LINK).toContain("if (where === 'sent' || where === 'photos') return landingFolder(google, folder, landingPath(where))")
    expect(branch).toContain("restRows(session, 'PATCH', 'bids', write.query, write.body, 'return=representation')")
    expect(FILES_IO).toContain('return updateBid(bidId, { bid_submission_link: value })')
    expect(branch).toContain("restRows(session, 'POST', 'bids_submission_entries', 'select=id', submissionNoteRow(")
    // The order: the log's one-apply rule, the hash, the folder, the paper, the link, the note.
    const at = (s: string) => branch.indexOf(s)
    expect(at('hooks.priorApply(name')).toBeGreaterThan(at("if (built.step === 'plan') return ok("))
    expect(at('planMismatch(name')).toBeGreaterThan(at('hooks.priorApply(name'))
    expect(at("'bid-photos'")).toBeGreaterThan(at('planMismatch(name'))
    expect(at("'drive-link'")).toBeGreaterThan(at("'bid-photos'"))
    expect(at("'PATCH', 'bids'")).toBeGreaterThan(at("'drive-link'"))
    expect(at("'POST', 'bids_submission_entries'")).toBeGreaterThan(at("'PATCH', 'bids'"))
  })
  it('lands where the app keeps what we sent, and reads tables the catalog holds', () => {
    expect(SUBMISSION_LANDING).toEqual([JOB_FOLDER_TREE.teamOnly, JOB_FOLDER_TREE.sentByUs])
    expect(SUBMISSION_LANDING_WORDS).toBe('Team only › Sent by us')
    for (const table of ['bids', 'service_types', 'app_settings', 'customers', 'bids_submission_entries']) expect(CATALOG_TABLES[table], table).toBeTruthy()
    for (const col of ['drive_link', 'bid_submission_link', 'bid_number', 'project_name', 'address', 'created_at', 'customer_id', 'service_type_id']) expect(CATALOG_TABLES.bids!.columns[col], col).toBeTruthy()
    // The folder's own kinds are bidFolder.ts' seeBidFolder's, read through DriveGet here.
    for (const kind of ["seen: 'cannot_open'", "seen: 'not_a_folder'", "seen: 'cannot_write'", "seen: 'outside_drive'"]) expect(BID_FOLDER).toContain(kind)
  })
})

// ── read_drive_folder ────────────────────────────────────────────────────────────────────────────────────────────────

describe('read_drive_folder — the ask', () => {
  it('takes a folder or a file, an id or any Drive link, never both and never neither', () => {
    expect(driveFolderArgs({ folder: PROJECT })).toEqual({ ok: true, ask: { kind: 'folder', id: PROJECT, page: null } })
    expect(driveFolderArgs({ folder: `https://drive.google.com/drive/u/0/folders/${PROJECT}?usp=sharing` })).toEqual({ ok: true, ask: { kind: 'folder', id: PROJECT, page: null } })
    expect(driveFolderArgs({ file: linkOf(PAPER) })).toEqual({ ok: true, ask: { kind: 'file', id: PAPER } })
    expect(driveFolderArgs({ file: `https://docs.google.com/document/d/${PAPER}/edit` })).toEqual({ ok: true, ask: { kind: 'file', id: PAPER } })
    expect(driveFolderArgs({ folder: PROJECT, page: 'tokenOfTheNextPage' })).toEqual({ ok: true, ask: { kind: 'folder', id: PROJECT, page: 'tokenOfTheNextPage' } })
    for (const bad of [{}, { folder: PROJECT, file: PAPER }, { folder: '' }]) {
      const r = driveFolderArgs(bad)
      expect(r.ok === false && r.error).toContain('read_drive_folder needs folder')
    }
    const notDrive = driveFolderArgs({ folder: 'https://example.com/folders/abc' })
    expect(notDrive.ok === false && notDrive.error).toContain('is not a Drive id or a Drive link')
    const paged = driveFolderArgs({ file: PAPER, page: 'x' })
    expect(paged.ok === false && paged.error).toBe('page reads a folder on; one file’s facts come in one reply.')
    const badPage = driveFolderArgs({ folder: PROJECT, page: 'two words' })
    expect(badPage.ok === false && badPage.error).toContain('page is the next_page value')
    expect(driveIdOf('short')).toBeNull()
    expect(driveIdOf(`https://drive.google.com/open?id=${PAPER}`)).toBe(PAPER)
  })
})

describe('read_drive_folder — a folder', () => {
  const ctx = async (w: DriveWorld, t: Tables = tables()) => ({ serviceAccount: SA, company: await readCompanyDrive(readerOver(t), driveOver(w), null) })

  it('lists what the folder holds with each entry’s kind, size, owner and whether the company’s Shared Drive holds it', async () => {
    const w = driveWorld({
      children: {
        [PROJECT]: [
          { id: TEAM, name: 'Team only', mimeType: FOLDER, driveId: COMPANY_DRIVE, modifiedTime: '2026-04-02T10:00:00.000Z' },
          { id: PAPER, name: 'ZZ Test Proposal.pdf', mimeType: 'application/pdf', size: '204800', driveId: COMPANY_DRIVE, md5Checksum: MD5, modifiedTime: '2026-04-01T14:00:00.000Z', webViewLink: linkOf(PAPER) },
          { id: OTHER, name: 'ZZ notes', mimeType: 'application/vnd.google-apps.document', owners: [{ displayName: 'ZZ Made Up Person', emailAddress: 'zz.person@example.com' }] },
          { id: 'zzShortcut000000000001', name: 'ZZ link', mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: PAPER } },
        ],
      },
    })
    const drive = driveOver(w)
    const read = await readDriveFolder(drive, { kind: 'folder', id: PROJECT, page: null }, await ctx(w))
    if (!read.ok) throw new Error(read.error)
    expect(read.rows).toBe(4)
    expect(read.reply.folder).toEqual({ id: PROJECT, name: 'ZZ Test', url: folderLink(PROJECT), owner: null, shared_drive: 'ZZ Company Jobs', company_drive: true, trashed: false, parent: ROOT })
    expect(read.reply).toMatchObject({ listed: 4, folders: 1, files: 3, next_page: null })
    expect(read.reply.read_next).toBeUndefined()
    const entries = read.reply.entries as Json[]
    expect(entries[0]).toEqual({ id: TEAM, name: 'Team only', kind: 'folder', mime: FOLDER, size_bytes: null, modified_time: '2026-04-02T10:00:00.000Z', owner: null, company_drive: true, url: folderLink(TEAM) })
    expect(entries[1]).toMatchObject({ id: PAPER, kind: 'file', size_bytes: 204800, company_drive: true, url: linkOf(PAPER) })
    expect(entries[2]).toMatchObject({ kind: 'google_doc', owner: 'ZZ Made Up Person <zz.person@example.com>', company_drive: false, size_bytes: null })
    expect(entries[3]).toMatchObject({ kind: 'shortcut', points_to: PAPER })
    // The listing asks for a page of a hundred, folders first, in every drive, and never for a file's bytes.
    const list = drive.calls.find((c) => c.path === '/files')!
    expect(list.params).toMatchObject({ q: `'${PROJECT}' in parents and trashed = false`, pageSize: String(DRIVE_FOLDER_PAGE), orderBy: 'folder,name', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })
    expect(drive.calls.some((c) => 'alt' in c.params)).toBe(false)
  })
  it('hands back next_page for a long folder, with the words that read on, and takes it back as page', async () => {
    const w = driveWorld({ children: { [PROJECT]: [{ id: PAPER, name: 'a.pdf', mimeType: 'application/pdf' }] }, nextPage: { [PROJECT]: 'pageTwoToken' } })
    const first = await readDriveFolder(driveOver(w), { kind: 'folder', id: PROJECT, page: null }, await ctx(w))
    if (!first.ok) throw new Error(first.error)
    expect(first.reply.next_page).toBe('pageTwoToken')
    expect(first.reply.read_next).toContain('page: next_page, quoted whole')
    const drive = driveOver(w)
    const second = await readDriveFolder(drive, { kind: 'folder', id: PROJECT, page: 'pageTwoToken' }, await ctx(w))
    expect(second.ok).toBe(true)
    expect(drive.calls.find((c) => c.path === '/files')!.params.pageToken).toBe('pageTwoToken')
    const stale = await readDriveFolder(driveOver(w), { kind: 'folder', id: PROJECT, page: 'someOtherToken' }, await ctx(w))
    expect(stale.ok === false && stale.error).toContain('Drive did not take that page')
    expect(folderReadNextWords({ listed: 3, of: 3, nextPage: null })).toEqual({})
  })
  it('the limits: a name is cut, and a page too long for a reply is shortened whole entries at a time and says so', async () => {
    const long = 'N'.repeat(5000)
    const w = driveWorld({ children: { [PROJECT]: Array.from({ length: DRIVE_FOLDER_PAGE }, (_, i) => ({ id: `zzLongNamedFile00000${String(i).padStart(3, '0')}`, name: long, mimeType: 'application/pdf', webViewLink: `https://drive.google.com/file/d/${'u'.repeat(900)}${i}/view` })) }, nextPage: { [PROJECT]: 'more' } })
    const read = await readDriveFolder(driveOver(w), { kind: 'folder', id: PROJECT, page: null }, await ctx(w))
    if (!read.ok) throw new Error(read.error)
    const entries = read.reply.entries as Json[]
    expect(String(entries[0]!.name)).toHaveLength(DRIVE_NAME_MAX + 1)
    expect(entries.length).toBeLessThan(DRIVE_FOLDER_PAGE)
    expect(replyText(read.reply).length).toBeLessThanOrEqual(REPLY_MAX_CHARS)
    // A page cut to fit hands back no next_page: the token would skip the entries dropped.
    expect(read.reply.next_page).toBeNull()
    expect(read.reply.read_next).toContain(`These are the first ${entries.length} of the ${DRIVE_FOLDER_PAGE} entries`)
    expect(read.rows).toBe(entries.length)
  })
  it('a folder the account cannot open is refused in words that name the share that fixes it', async () => {
    const w = driveWorld()
    const missing = await readDriveFolder(driveOver(w), { kind: 'folder', id: 'zzNotSharedFolder00001', page: null }, await ctx(w))
    expect(missing.ok === false && missing.error).toBe(
      `Drive has no folder zzNotSharedFolder00001 that the intake service account (${SA}) can open: the id is wrong, or the folder was never shared with it. Share the folder with the intake service account (${SA}) as a Viewer, or add it to the folder's Shared Drive as a Viewer member; then read again.`,
    )
    expect(driveReadRefusal('folder', 'x1', 403, 'The user does not have sufficient permissions', SA)).toContain('Drive refused the read of folder x1: The user does not have sufficient permissions. Share the folder with')
    expect(driveReadRefusal('file', 'x1', 403, 'User rate limit exceeded [userRateLimitExceeded]', SA)).toContain('rate-limiting the service account')
    expect(driveReadRefusal('file', 'x1', 500, '', null)).toBe('Drive could not read file x1 (500): no reason given. Try again in a minute.')
    expect(driveReadRefusal('file', 'x1', 404, '', null)).toContain('the intake service account (the client_email in GOOGLE_SERVICE_ACCOUNT_JSON)')
    const aFile = await readDriveFolder(driveOver(w), { kind: 'folder', id: PAPER, page: null }, await ctx(w))
    expect(aFile.ok === false && aFile.error).toBe(`ZZ Test Proposal.pdf is a file, not a folder. read_drive_folder { file: "${PAPER}" } answers its facts.`)
  })
  it('the company’s Shared Drive is the one that holds the jobs root, read as the dev, the env filling in', async () => {
    const reader = readerOver(tables())
    const company = await readCompanyDrive(reader, driveOver(driveWorld()), null)
    expect(company).toMatchObject({ rootFolderId: ROOT, driveId: COMPANY_DRIVE, name: 'ZZ Company Jobs' })
    expect(reader.asked[0]).toMatchObject({ table: 'app_settings', query: { select: 'key,value_text' } })
    const fromEnv = await readCompanyDrive(readerOver(tables(bidRow(), [])), driveOver(driveWorld()), ROOT)
    expect(fromEnv.driveId).toBe(COMPANY_DRIVE)
    const none = await readCompanyDrive(readerOver(tables(bidRow(), [])), driveOver(driveWorld()), null)
    expect(none).toMatchObject({ rootFolderId: null, driveId: null, name: null })
    // A root in someone's My Drive is no Shared Drive: nothing reads as the company's.
    const myDrive = await readCompanyDrive(readerOver(tables()), driveOver(driveWorld({ files: { [ROOT]: { id: ROOT, name: 'Jobs', mimeType: FOLDER } } })), null)
    expect(myDrive.driveId).toBeNull()
  })
})

describe('read_drive_folder — one file', () => {
  it('answers its facts, the folders above it and who it is shared with', async () => {
    const w = driveWorld({
      files: {
        [PAPER]: paper({ parents: [SENT], createdTime: '2026-03-30T09:00:00.000Z', lastModifyingUser: { displayName: 'ZZ Made Up Person' } }),
        [SENT]: { id: SENT, name: 'Sent by us', parents: [TEAM] },
        [TEAM]: { id: TEAM, name: 'Team only', parents: [PROJECT] },
        [ROOT]: { id: ROOT, name: 'Jobs', mimeType: FOLDER, driveId: COMPANY_DRIVE, parents: [] },
      },
      permissions: { [PAPER]: [{ type: 'user', role: 'writer', emailAddress: 'zz.person@example.com', displayName: 'ZZ Made Up Person' }, { type: 'domain', role: 'reader', domain: 'example.com' }, { type: 'anyone', role: 'reader' }, { type: 'user', role: 'reader', emailAddress: 'gone@example.com', deleted: true }] },
    })
    const company = await readCompanyDrive(readerOver(tables()), driveOver(w), null)
    const drive = driveOver(w)
    const read = await readDriveFile(drive, { kind: 'file', id: PAPER }, { serviceAccount: SA, company })
    if (!read.ok) throw new Error(read.error)
    expect(read.reply.file).toEqual({
      id: PAPER, name: 'ZZ Test Proposal.pdf', kind: 'file', mime: 'application/pdf', size_bytes: 204800, md5: MD5, sha256: SHA,
      created_time: '2026-03-30T09:00:00.000Z', modified_time: '2026-04-01T14:00:00.000Z', modified_by: 'ZZ Made Up Person', owner: null,
      shared_drive: 'ZZ Company Jobs', company_drive: true, trashed: false, url: linkOf(PAPER),
    })
    expect(read.reply.parents).toEqual([{ id: SENT, name: 'Sent by us' }, { id: TEAM, name: 'Team only' }, { id: PROJECT, name: 'ZZ Test' }, { id: ROOT, name: 'Jobs' }])
    expect(read.reply.path).toEqual(['Jobs', 'ZZ Test', 'Team only', 'Sent by us'])
    expect(read.reply.shared_with).toEqual([
      { who: 'zz.person@example.com', name: 'ZZ Made Up Person', kind: 'user', role: 'writer' },
      { who: 'example.com', name: null, kind: 'domain', role: 'reader' },
      { who: 'anyone with the link', name: null, kind: 'anyone', role: 'reader' },
    ])
    expect(drive.calls.some((c) => 'alt' in c.params)).toBe(false)
  })
  it('stands without the sharing when Drive does not show it, and refuses a file it cannot open', async () => {
    const w = driveWorld({ permissions: { [PAPER]: { status: 403 } } })
    const company = await readCompanyDrive(readerOver(tables()), driveOver(w), null)
    const read = await readDriveFile(driveOver(w), { kind: 'file', id: PAPER }, { serviceAccount: SA, company })
    if (!read.ok) throw new Error(read.error)
    expect(read.reply.shared_with).toBeNull()
    expect(read.reply.shared_with_why).toContain('Drive did not show the sharing (403')
    const missing = await readDriveFile(driveOver(w), { kind: 'file', id: 'zzNoSuchFile0000000001' }, { serviceAccount: SA, company })
    expect(missing.ok === false && missing.error).toContain('Share the file, or the folder that holds it, with the intake service account')
  })
  it('names each kind', () => {
    expect([FOLDER, 'application/pdf', 'application/vnd.google-apps.shortcut', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation', 'application/vnd.google-apps.form'].map(driveKind)).toEqual(['folder', 'file', 'shortcut', 'google_sheet', 'google_slides', 'google_other'])
  })
  it('the real DriveGet only ever GETs', async () => {
    const seen: { url: string; method: string | undefined; auth: string | null }[] = []
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method, auth: new Headers(init?.headers).get('Authorization') })
      return new Response(JSON.stringify({ id: 'x' }), { status: 200 })
    }) as typeof fetch
    const a = await driveGetWith('zz-token', fake)('/files/abc', { fields: 'id', supportsAllDrives: 'true' })
    expect(a).toEqual({ status: 200, body: { id: 'x' } })
    expect(seen).toEqual([{ url: 'https://www.googleapis.com/drive/v3/files/abc?fields=id&supportsAllDrives=true', method: 'GET', auth: 'Bearer zz-token' }])
  })
})

// ── plan_bid_submission: the ask ─────────────────────────────────────────────────────────────────────────────────────

describe('plan_bid_submission — the ask', () => {
  it('names a bid by id or by text, the paper by id or by link, and replace', () => {
    expect(input()).toEqual({ action: 'file', bid: 'b398', drive_file_id: PAPER, replace: false })
    expect(input({ drive_file_id: undefined, drive_url: linkOf(PAPER), replace: true })).toEqual({ action: 'file', bid: 'b398', drive_file_id: PAPER, replace: true })
    expect(input({ bid: BID, drive_url: linkOf(PAPER) }).bid).toBe(BID)
    const built = writeRpcBody('plan_bid_submission', { submission: { bid: 'b398', drive_file_id: PAPER } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: 'b398', planHash: null })
  })
  it('refuses a shape it cannot read, each in its own words', () => {
    const bad = (submission: unknown, plan_hash?: string) => {
      const r = bidSubmissionInput(plan_hash === undefined ? 'plan_bid_submission' : 'apply_bid_submission', { submission, ...(plan_hash === undefined ? {} : { plan_hash }) } as Json)
      if (r.ok) throw new Error('taken')
      return r.error
    }
    expect(bad(null)).toContain('plan_bid_submission needs submission — { bid')
    expect(bad({ drive_file_id: PAPER })).toContain('bid names the bid')
    expect(bad({ bid: 'b398' })).toContain('name the paper by drive_file_id or drive_url')
    expect(bad({ bid: 'b398', drive_file_id: linkOf(PAPER) })).toContain('is not a Drive file id; a link goes in drive_url')
    expect(bad({ bid: 'b398', drive_url: 'https://example.com/paper.pdf' })).toContain('does not carry a Drive file id')
    expect(bad({ bid: 'b398', drive_url: folderLink(PROJECT) })).toContain("drive_url is a folder's link, and a sent paper is one file")
    expect(bad({ bid: 'b398', drive_file_id: PAPER, drive_url: linkOf(OTHER) })).toContain('name two files; send one')
    expect(bad({ bid: 'b398', drive_file_id: PAPER, replace: 'yes' })).toBe('plan_bid_submission: replace is true or false.')
    expect(bad({ bid: 'b398', drive_file_id: PAPER }, 'nope')).toBe('apply_bid_submission needs plan_hash — the 64-hex value plan_bid_submission replied with.')
    const noHash = writeRpcBody('apply_bid_submission', { submission: { bid: 'b398', drive_file_id: PAPER } })
    expect(noHash.ok === false && noHash.error).toContain('apply_bid_submission needs plan_hash')
  })
})

// ── the plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('plan_bid_submission — the happy path', () => {
  it('a paper in the company’s Shared Drive: Drive’s own copy into Team only › Sent by us, the link and the note named', async () => {
    const r = await reply()
    expect(r).toMatchObject({
      action: 'file',
      bid: { id: BID, label: 'BP398', project_name: 'ZZ Test' },
      file: { drive_file_id: PAPER, name: 'ZZ Test Proposal.pdf', mime: 'application/pdf', size_bytes: 204800, md5: MD5, sha256: SHA, modified_time: '2026-04-01T14:00:00.000Z', owner: null, in_company_drive: true, url: linkOf(PAPER) },
      project_folder: { state: 'exists', id: PROJECT, name: 'ZZ Test', url: folderLink(PROJECT) },
      lands: 'Team only › Sent by us of ZZ Test',
      how: 'copy',
      already_filed_as: null,
      sent_by_us: { exists: true, holds: 0, papers: [] },
      link: { column: 'bid_submission_link', before: null, replaces: false },
      warnings: [],
    })
    expect(String(r.how_words)).toContain("Drive's own copy: ZZ Test Proposal.pdf (application/pdf, 200 KB) is in the company's Shared Drive")
    expect(String((r.link as Json).after)).toContain('known once the apply has filed it')
    expect((r.note as Json).text).toBe('Sent paper filed from Drive: “ZZ Test Proposal.pdf” is in Team only › Sent by us of the bid’s project folder and is the bid’s submission link.')
    expect((r.not_done as string[]).join(' ')).toContain('Log contact')
    expect((r.not_done as string[]).join(' ')).toContain('plan_bid_update')
  })
  it('reads the bid as the dev by its number, and Drive by GETs alone', async () => {
    const reader = readerOver(tables())
    const drive = driveOver(driveWorld())
    const w = await readBidSubmissionWorld(reader, drive, input(), CTX)
    if ('refused' in w) throw new Error(w.refused)
    expect(w.bid).toEqual({ id: BID, label: 'BP398', projectName: 'ZZ Test', link: null, linkRaw: null, driveLink: folderLink(PROJECT) })
    expect(w.folder).toEqual({ kind: 'ok', id: PROJECT, name: 'ZZ Test', url: folderLink(PROJECT), driveId: COMPANY_DRIVE })
    expect(w.sent).toEqual({ id: SENT, papers: [], capped: false })
    // The bid is found by its number as find_bid finds it; nothing but the bid, the prefixes and the office's Drive settings is read.
    expect([...new Set(reader.asked.map((a) => a.table))].sort()).toEqual(['app_settings', 'bids', 'service_types'])
    expect(drive.calls.some((c) => 'alt' in c.params)).toBe(false)
  })
  it('a bid with no project folder: the plan names the folder the apply makes first, by the office’s pattern', async () => {
    const t = tables(bidRow({ drive_link: null, customer_id: 'cust1' }), [{ key: 'drive_jobs_root_folder_id', value_text: ROOT }, { key: 'drive_bid_folder_pattern', value_text: '["customer","project"]' }])
    const reader = readerOver(t)
    const w = await readBidSubmissionWorld(reader, driveOver(driveWorld()), input(), CTX)
    if ('refused' in w) throw new Error(w.refused)
    expect(w.folder.kind).toBe('none')
    expect(w.folder.name).toContain('ZZ Made Up Builders')
    expect(w.folder.name).toContain('ZZ Test')
    expect(reader.asked.map((a) => a.table)).toContain('customers')
    const dry = bidSubmissionDryRun(input(), w, { serviceAccount: SA })
    if (!dry.ok) throw new Error(dry.refused)
    expect(dry.reply.project_folder).toMatchObject({ state: 'made_at_apply', name: w.folder.name })
    expect(String((dry.reply.project_folder as Json).makes)).toContain("as the Files window's Make the project folder does (bid-photos' make, as you)")
    expect(dry.reply.lands).toBe(`Team only › Sent by us of ${w.folder.name}`)
    expect(dry.reply.how).toBe('copy')
    expect(dry.reply.sent_by_us).toMatchObject({ exists: false, holds: 0 })
  })
  it('a paper outside the company’s Shared Drive is read on the server and uploaded, and the plan says so', async () => {
    const r = await reply(driveWorld({ files: { [PAPER]: paper({ driveId: undefined, owners: [{ displayName: 'ZZ Made Up Person', emailAddress: 'zz.person@example.com' }] }) } }))
    expect(r.how).toBe('upload')
    expect(String(r.how_words)).toContain("uploads them into Team only › Sent by us of ZZ Test through drive-link's put as you")
    expect((r.file as Json).in_company_drive).toBe(false)
    expect((r.file as Json).owner).toBe('ZZ Made Up Person <zz.person@example.com>')
    expect((r.warnings as string[])[0]).toContain("is not in the company's Shared Drive")
  })
  it('a paper already in Sent by us is only linked: by its place, or by the same name, size and md5', async () => {
    const there = await reply(driveWorld({ files: { [PAPER]: paper({ parents: [SENT] }) }, children: { [SENT]: [{ id: PAPER, name: 'ZZ Test Proposal.pdf', size: '204800', md5Checksum: MD5 }] } }))
    expect(there).toMatchObject({ how: 'already_there', already_filed_as: PAPER, link: { after: linkOf(PAPER) }, sent_by_us: { holds: 0 } })
    expect(String(there.how_words)).toContain('Nothing is copied: ZZ Test Proposal.pdf is already in')
    const twin = await reply(driveWorld({ children: { [SENT]: [{ id: OTHER, name: 'ZZ Test Proposal.pdf', size: '204800', md5Checksum: MD5, modifiedTime: '2026-04-03T00:00:00.000Z' }] } }))
    expect(twin).toMatchObject({ how: 'already_there', already_filed_as: OTHER, link: { after: linkOf(OTHER) } })
    expect(String(twin.how_words)).toContain(`the same bytes are already in Team only › Sent by us of ZZ Test as ${OTHER}`)
  })
  it('several papers on one bid: the column holds one link, the newest filed keeps it, and a same-name file is warned of', async () => {
    const sent = [{ id: OTHER, name: 'ZZ Test Proposal.pdf', size: '999', md5Checksum: 'f'.repeat(32), modifiedTime: '2026-03-01T00:00:00.000Z' }, { id: 'zzThirdPaper0000000001', name: 'ZZ Test Option B.pdf', size: '5', md5Checksum: 'e'.repeat(32), modifiedTime: '2026-02-01T00:00:00.000Z' }]
    const r = await reply(driveWorld({ children: { [SENT]: sent } }), tables(bidRow({ bid_submission_link: linkOf(OTHER) })), { replace: true })
    expect(r.how).toBe('copy')
    expect(r.sent_by_us).toMatchObject({ exists: true, holds: 2, papers: [{ id: OTHER, name: 'ZZ Test Proposal.pdf', modified_time: '2026-03-01T00:00:00.000Z' }, { id: 'zzThirdPaper0000000001' }] })
    expect(String((r.sent_by_us as Json).one_link)).toContain('holds one link and the folder holds 2 other papers. This paper, the newest filed, becomes the link')
    expect(r.link).toMatchObject({ before: linkOf(OTHER), replaces: true })
    expect((r.warnings as string[])[0]).toContain(`already holds a file named ZZ Test Proposal.pdf with other bytes (${OTHER})`)
    expect((r.note as Json).text).toBe(`Sent paper filed from Drive: “ZZ Test Proposal.pdf” is in Team only › Sent by us of the bid’s project folder and is the bid’s submission link. It takes the place of ${linkOf(OTHER)}.`)
  })
})

describe('plan_bid_submission — each refusal in its own words', () => {
  it('a bid nobody finds, a bid RLS hides, and a file the service account cannot open', async () => {
    const none = await readBidSubmissionWorld(readerOver({ ...tables(), bids: [] }), driveOver(driveWorld()), input(), CTX)
    expect(none).toEqual({ refused: 'No bid matches "b398".' })
    const hidden = await readBidSubmissionWorld(readerOver({ ...tables(), bids: [] }), driveOver(driveWorld()), input({ bid: BID }), CTX)
    expect(hidden).toEqual({ refused: `No bid ${BID} — it does not exist, or RLS hides it from you.` })
    const noFile = await readBidSubmissionWorld(readerOver(tables()), driveOver(driveWorld({ files: { [PAPER]: { status: 404 } } })), input(), CTX)
    expect('refused' in noFile && noFile.refused).toBe(
      `Drive has no file ${PAPER} that the intake service account (${SA}) can open: the id is wrong, or the file was never shared with it. Share the file, or the folder that holds it, with the intake service account (${SA}) as a Viewer; then read again.`,
    )
  })
  it('a file in the trash, a folder, a shortcut, and a Google Doc', async () => {
    expect(await refusal(driveWorld({ files: { [PAPER]: paper({ trashed: true }) } }))).toBe("ZZ Test Proposal.pdf is in Drive's trash. Restore it first, then plan again.")
    expect(await refusal(driveWorld({ files: { [PAPER]: { id: PAPER, name: 'ZZ Old proposals', mimeType: FOLDER } } }))).toBe(`ZZ Old proposals is a folder, and a sent paper is one file. read_drive_folder { folder: "${PAPER}" } lists its files with their ids; file them one a call.`)
    expect(await refusal(driveWorld({ files: { [PAPER]: { id: PAPER, name: 'ZZ link', mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: OTHER } } } }))).toBe(`ZZ link is a shortcut to ${OTHER}, not the paper itself. Name the file it points to.`)
    expect(await refusal(driveWorld({ files: { [PAPER]: { id: PAPER, name: 'ZZ Proposal draft', mimeType: 'application/vnd.google-apps.document' } } }))).toBe(
      'ZZ Proposal draft is a Google Doc: it can still be edited, so it is not the paper that was sent, and the plan has no bytes to commit to. In Drive, File → Download → PDF, put the PDF beside it, and name that file.',
    )
  })
  it('a project folder the app cannot file into: not a folder, cannot open, cannot add, a personal Drive', async () => {
    const tail = " Nothing was filed and the bid's link is as it was; plan again once it is fixed."
    expect(await refusal(driveWorld(), tables(bidRow({ drive_link: 'https://example.com/our-folder' })))).toBe(`This bid’s project folder link is not a Drive folder. Fix it on the bid, under Files & links.${tail}`)
    expect(await refusal(driveWorld({ files: { [PROJECT]: { status: 404 } } }))).toBe(`The app cannot open this bid’s project folder. Share it with ${SA} as an editor.${tail}`)
    expect(await refusal(driveWorld({ files: { [PROJECT]: projectFolder({ capabilities: { canAddChildren: false } }) } }))).toBe(`The app can open this bid’s project folder but cannot add to it. Share it with ${SA} as an editor.${tail}`)
    expect(await refusal(driveWorld({ files: { [PROJECT]: projectFolder({ driveId: undefined, owners: [{ displayName: 'ZZ Made Up Person' }] }) } }))).toBe(
      `This bid’s project folder is in ZZ Made Up Person’s My Drive, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive.${tail}`,
    )
    // The hold is bidFolderHoldWords' own sentence; its line about photos is not this verb's to say.
    for (const seen of ['not_a_folder', 'cannot_open', 'cannot_write', 'outside_drive'] as const) expect(submissionFolderHold(seen, SA, null)).not.toContain('photos')
    expect(submissionFolderHold('cannot_open', null, null)).toContain('Share it with the intake service account as an editor.')
  })
  it('a bid with no folder while no jobs root is set', async () => {
    expect(await refusal(driveWorld(), tables(bidRow({ drive_link: null }), []))).toBe(
      'This bid has no project folder, and the jobs root to make one under is not set yet. Set it on Documents → Where files go, or paste the bid’s folder on the bid under Files & links; then plan again.',
    )
  })
  it('a bid that already has a link, unless the plan says replace; and a bid already linked to this paper', async () => {
    const linked = tables(bidRow({ bid_submission_link: `  ${linkOf(OTHER)} ` }))
    expect(await refusal(driveWorld(), linked)).toBe(
      `BP398 already has a submission link: ${linkOf(OTHER)}. The column holds one link. Plan again with replace: true to make ZZ Test Proposal.pdf the link in its place; the paper it points to now stays where it is in Drive.`,
    )
    expect((await reply(driveWorld(), linked, { replace: true })).link).toMatchObject({ before: linkOf(OTHER), replaces: true })
    // A link to the very file that sits in Sent by us, in any of Drive's link forms: nothing to do, replace or not.
    const same = driveWorld({ files: { [PAPER]: paper({ parents: [SENT] }) }, children: { [SENT]: [{ id: PAPER, name: 'ZZ Test Proposal.pdf', size: '204800', md5Checksum: MD5 }] } })
    for (const replace of [false, true]) {
      expect(await refusal(same, tables(bidRow({ bid_submission_link: `https://drive.google.com/open?id=${PAPER}` })), { replace })).toBe(
        `BP398 already carries this paper as its submission link (https://drive.google.com/open?id=${PAPER}), and the file is in Team only › Sent by us of its project folder. There is nothing to file or to link.`,
      )
    }
    const noLink = await reply(driveWorld(), tables(), { replace: true })
    expect(noLink.warnings).toEqual(['replace was given and the bid carries no submission link: nothing is replaced.'])
  })
  it('a paper outside the Shared Drive that is too big, empty, or that Drive will not hand over; and a copy Drive forbids', async () => {
    const outside = (over: Json) => driveWorld({ files: { [PAPER]: paper({ driveId: undefined, ...over }) } })
    expect(await refusal(outside({ size: String(SUBMISSION_UPLOAD_MAX_BYTES + 1) }))).toBe(
      "ZZ Test Proposal.pdf is outside the company's Shared Drive (ZZ Company Jobs), so it is read on the server and uploaded, and it is 10.0 MB: an upload takes at most 10 MB. Move it into the company's Shared Drive, where Drive copies it whole whatever its size; then plan again.",
    )
    expect(await refusal(outside({ size: '0' }))).toBe('ZZ Test Proposal.pdf is empty in Drive (0 bytes); there is no paper in it to file.')
    expect(await refusal(outside({ capabilities: { canCopy: false, canDownload: false } }))).toContain('Drive does not let the intake service account download it')
    expect(await refusal(driveWorld({ files: { [PAPER]: paper({ capabilities: { canCopy: false, canDownload: true } }) } }))).toContain('Drive does not let the intake service account copy ZZ Test Proposal.pdf')
    // Inside the Shared Drive size is no limit: Drive copies it and no byte passes through the function.
    expect((await reply(driveWorld({ files: { [PAPER]: paper({ size: String(80 * 1024 * 1024) }) } }))).how).toBe('copy')
  })
  it('a Drive that answers badly is an error, not a plan', async () => {
    await expect(readBidSubmissionWorld(readerOver(tables()), driveOver(driveWorld({ files: { [PROJECT]: { status: 500 } } })), input(), CTX)).rejects.toThrow('Drive answered 500 when the app looked at the bid’s folder.')
  })
})

// ── the hash ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('plan_bid_submission — the hash', () => {
  const hashOf = async (drive: DriveWorld = driveWorld(), t: Tables = tables(), over: Json = {}) => {
    const p = input(over)
    const dry = bidSubmissionDryRun(p, await world(drive, t, over), { serviceAccount: SA })
    if (!dry.ok) throw new Error(dry.refused)
    return planHash('plan_bid_submission', p, dry.reply)
  }
  it('never covers the dry run’s own clock: the same plan read a day apart hashes the same, and the plan carries no stamp', async () => {
    const realNow = Date.now
    try {
      Date.now = () => Date.parse('2026-11-13T15:00:00Z')
      const first = await hashOf()
      const text = JSON.stringify(await reply())
      Date.now = () => Date.parse('2026-11-14T23:59:59Z')
      expect(await hashOf()).toBe(first)
      expect(JSON.stringify(await reply())).toBe(text)
      // No instant but the file's own modified time is in the plan; the note is stamped when the apply writes it.
      expect(text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g)).toEqual(['2026-04-01T14:00'])
      expect(text).toContain('stamped when the apply writes it')
    } finally {
      Date.now = realNow
    }
    // The apply hashes the same payload under its own verb, as planHash is asked by the branch.
    const p = input()
    const dry = bidSubmissionDryRun(p, await world(), { serviceAccount: SA })
    if (!dry.ok) throw new Error(dry.refused)
    const fresh = await planHash('plan_bid_submission', p, dry.reply)
    expect(await planHash('apply_bid_submission', input({}, 'apply_bid_submission'), dry.reply)).toBe(fresh)
    expect(planReply('plan_bid_submission', dry.reply, fresh)).toMatchObject({ plan_hash: fresh, action: 'file' })
    expect(String(planReply('plan_bid_submission', dry.reply, fresh).next)).toContain('call apply_bid_submission with the same input and plan_hash')
  })
  it('moves with a changed world: the file’s bytes, its name, a link set since, a folder made since, a paper filed since, replace', async () => {
    const base = await hashOf()
    const moved = [
      await hashOf(driveWorld({ files: { [PAPER]: paper({ md5Checksum: 'c'.repeat(32), sha256Checksum: 'd'.repeat(64) }) } })),
      await hashOf(driveWorld({ files: { [PAPER]: paper({ size: '204801' }) } })),
      await hashOf(driveWorld({ files: { [PAPER]: paper({ name: 'ZZ Test Proposal rev 2.pdf' }) } })),
      await hashOf(driveWorld({ children: { [SENT]: [{ id: OTHER, name: 'ZZ another.pdf', size: '1', md5Checksum: 'f'.repeat(32) }] } })),
      await hashOf(driveWorld({ children: { [TEAM]: [] } })),
      await hashOf(driveWorld(), tables(bidRow({ bid_submission_link: linkOf(OTHER) })), { replace: true }),
      await hashOf(driveWorld(), tables(), { replace: true }),
      await hashOf(driveWorld(), tables(bidRow({ drive_link: null }))),
    ]
    for (const h of moved) expect(h).not.toBe(base)
    expect(new Set(moved).size).toBe(moved.length)
    expect(planMismatch('apply_bid_submission', HASH, base)).toContain('Call plan_bid_submission again and read it.')
  })
})

// ── the apply's pure pieces ──────────────────────────────────────────────────────────────────────────────────────────

describe('apply_bid_submission — the writes and the words', () => {
  it('the link is the Files window’s PATCH, held to the link the plan read', () => {
    expect(submissionLinkWrite(BID, null, linkOf(PAPER))).toEqual({ query: `id=eq.${BID}&or=(bid_submission_link.is.null,bid_submission_link.eq.)&select=id,bid_submission_link`, body: { bid_submission_link: linkOf(PAPER) } })
    expect(submissionLinkWrite(BID, '   ', linkOf(PAPER)).query).toContain('or=(bid_submission_link.is.null,bid_submission_link.eq.)')
    expect(submissionLinkWrite(BID, linkOf(OTHER), linkOf(PAPER)).query).toBe(`id=eq.${BID}&bid_submission_link=eq.${encodeURIComponent(linkOf(OTHER))}&select=id,bid_submission_link`)
    expect(FILES_IO).toContain(".from('bids').update(patch).eq('id', bidId).select('id')")
  })
  it('the note is the Bid Board’s own row, stamped by the apply', () => {
    const POPOVER = readFileSync('src/components/bids/BidGcNotesPopover.tsx', 'utf8')
    const row = submissionNoteRow(BID, submissionNoteText('ZZ Test Proposal.pdf', null), { userId: DEV }, '2026-11-13T16:00:00.000Z')
    expect(row).toEqual({ bid_id: BID, gc_customer_id: null, notes: 'Sent paper filed from Drive: “ZZ Test Proposal.pdf” is in Team only › Sent by us of the bid’s project folder and is the bid’s submission link.', contact_method: null, occurred_at: '2026-11-13T16:00:00.000Z', created_by: DEV })
    for (const col of ['bid_id', 'gc_customer_id', 'notes', 'contact_method', 'occurred_at', 'created_by']) expect(POPOVER).toContain(col)
  })
  it('bytes read at the apply must be the paper the plan saw', () => {
    const file = { name: 'ZZ Test Proposal.pdf', size_bytes: 204800, sha256: SHA }
    expect(uploadBytesProblem(file, { length: 204800, sha256: SHA.toUpperCase() })).toBeNull()
    expect(uploadBytesProblem({ ...file, sha256: null }, { length: 204800, sha256: 'e'.repeat(64) })).toBeNull()
    expect(uploadBytesProblem(file, { length: 204799, sha256: SHA })).toBe('ZZ Test Proposal.pdf read as 204,799 bytes and the plan saw 204,800: the file changed in Drive since. Nothing was filed. Plan again.')
    expect(uploadBytesProblem(file, { length: 204800, sha256: 'e'.repeat(64) })).toContain('read with sha256 eeeeeeeeeeee… and the plan saw bbbbbbbbbbbb…')
  })
  it('Drive’s refusal of the copy names the share that fixes it', () => {
    expect(submissionFilingRefusal('Copy failed (403): The user does not have sufficient permissions for this file.', SA, folderLink(PROJECT))).toBe(
      `Drive refused the filing: Copy failed (403): The user does not have sufficient permissions for this file. A manager gives the intake service account (${SA}) write access to the bid's project folder (${folderLink(PROJECT)}): Contributor on its Shared Drive. Nothing was filed and the bid's link is as it was.`,
    )
    expect(submissionFilingRefusal('Folder create failed (403): User rate limit exceeded', null, null)).toContain('Wait a minute and plan again.')
    expect(submissionFilingRefusal("Copy failed (403): The user's Drive storage quota has been exceeded", SA, null)).toContain("Move the folder into the company's Shared Drive.")
  })
  it('the reply names each step: filed and linked, filed but not linked, a note that failed', async () => {
    const r = await reply()
    const filed = { id: OTHER, url: linkOf(OTHER), how: 'copy' as const, md5: MD5 }
    const done = bidSubmissionAppliedWords(r, { filed, folder: { made: false, url: folderLink(PROJECT) }, link: { set: true, before: null, after: linkOf(OTHER) }, note: { saved: true, id: 'n1' } })
    expect(done).toMatchObject({
      filed: "ZZ Test Proposal.pdf is in Team only › Sent by us of ZZ Test (Drive's own copy).",
      drive_file_id: OTHER,
      url: linkOf(OTHER),
      project_folder: { made: false, url: folderLink(PROJECT) },
      link: { column: 'bid_submission_link', before: null, after: linkOf(OTHER), set: true },
      note: { saved: true, id: 'n1' },
      bid: { id: BID, label: 'BP398' },
    })
    expect(done.warnings).toBeUndefined()
    expect(String(done.next)).toContain(`read_drive_folder { file: "${OTHER}" }`)
    const unlinked = bidSubmissionAppliedWords(r, { filed, folder: { made: true, url: folderLink(PROJECT) }, link: { set: false, before: null, after: linkOf(OTHER), why: 'the write matched no row' }, note: { saved: false } })
    expect(unlinked.link).toMatchObject({ set: false, after: null })
    expect((unlinked.warnings as string[])[0]).toBe(`The paper is filed and the link was NOT set: the write matched no row. plan_bid_update { update: { bid_id: "${BID}", set: { bid_submission_link: "${linkOf(OTHER)}" } } } sets it.`)
    const noNote = bidSubmissionAppliedWords(r, { filed: { ...filed, md5: 'c'.repeat(32) }, folder: { made: false, url: null }, link: { set: true, before: null, after: linkOf(OTHER) }, note: { saved: false, why: 'answered 403' } })
    expect((noNote.warnings as string[]).join(' ')).toContain("The copy's md5")
    expect((noNote.warnings as string[]).join(' ')).toContain('The note did not save (answered 403); the paper is filed and linked.')
    const there = bidSubmissionAppliedWords({ ...r, how: 'already_there' }, { filed: { ...filed, how: 'already_there', md5: null }, folder: { made: false, url: null }, link: { set: true, before: null, after: linkOf(OTHER) }, note: { saved: true } })
    expect(there.filed).toBe('ZZ Test Proposal.pdf was already in Team only › Sent by us of ZZ Test; nothing was copied.')
  })
  it('a second apply of a plan that landed is refused in its own words', () => {
    expect(alreadyApplied('apply_bid_submission', { target: BID, at: '2026-11-13T16:00:00Z' })).toBe(
      'Nothing written: this plan was already applied on this bid at 2026-11-13T16:00:00Z. The paper is in Team only › Sent by us of its project folder and the bid carries its link; get_bid shows it. Another paper, or the same one after a change, needs a new plan.',
    )
  })
})
