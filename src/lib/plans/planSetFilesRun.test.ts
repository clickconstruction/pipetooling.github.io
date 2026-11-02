import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PLAN_SET_PUT_MAX_BYTES,
  parsePlanSetFilesAsk,
  planSetFileNameAt,
  planSetFolderName,
  planSetFolderNameAt,
  runPlanSetFiles,
  type MailAttachmentRow,
  type PlanSetFileRow,
  type PlanSetFilesAsk,
  type PlanSetFilesDeps,
  type PlanSetFilesDrive,
} from '../../../supabase/functions/_shared/planSetFilesRun'

/**
 * The rules of `plan-set-files` (punch list #239, PR 5) over a fake database and a fake Drive: who may file, what is
 * checked before anything is made, which job's folder holds a set, how two sets of one name keep two folders, and a
 * second try of a mail's file. Every refusal also says nothing was made. Made-up rows only.
 */

const CALLER = 'user-crew'
const SET_ID = '11111111-1111-4111-8111-111111111111'
const ATT_ID = '22222222-2222-4222-8222-222222222222'
const JOB_FOLDER = 'folder-job-a'
const JOB_LINK = `https://drive.example/folders/${JOB_FOLDER}`

type World = {
  set: PlanSetFileRow | null
  attachment: MailAttachmentRow | null
  canWrite: boolean
  me: { read_only?: boolean; is_digital_twin?: boolean } | null
  team: string[]
  partOf: Record<string, string | null>
  ownerJob: string | null
  jobsOnPart: Array<{ id: string; google_drive_link: string | null }>
  jobFolders: Record<string, { google_drive_link: string | null; drive_folder_hold: string | null }>
  /** Folder ids another set's link points at. */
  held: string[]
  driveOn: boolean
  stampFails: boolean
  downloadFails: boolean
  bytes: Uint8Array | null
  /** Drive as it stands, and what the run did to it. */
  folders: Array<{ id: string; parent: string; name: string }>
  files: Array<{ id: string; folder: string; name: string; size: number }>
  stamps: Array<{ setId: string; url: string }>
  driveOpened: number
  downloaded: string[]
}

function makeWorld(over: Partial<World> = {}): World {
  return {
    set: { id: SET_ID, part_id: 'part-a', name: 'As-built · JP972 · 2026-11-02', kind: 'as_built', link: '', job_id: 'job-a', created_by: CALLER },
    attachment: { id: ATT_ID, kind: 'file', name: 'spec-book.pdf', mime: 'application/pdf', bucket_path: 'gm/1-spec-book.pdf', jobs_ledger_id: 'job-a' },
    canWrite: true,
    me: { read_only: false, is_digital_twin: false },
    team: ['job-a'],
    partOf: { 'job-a': 'part-a', 'job-b': 'part-a', 'job-other': 'part-z' },
    ownerJob: null,
    jobsOnPart: [],
    jobFolders: { 'job-a': { google_drive_link: JOB_LINK, drive_folder_hold: null } },
    held: [],
    driveOn: true,
    stampFails: false,
    downloadFails: false,
    bytes: new Uint8Array([1, 2, 3]),
    folders: [],
    files: [],
    stamps: [],
    driveOpened: 0,
    downloaded: [],
    ...over,
  }
}

function depsOf(w: World): PlanSetFilesDeps {
  let nextId = 1
  const drive: PlanSetFilesDrive = {
    plansFolder: async (jobFolderId) => (await drive.findOrCreateFolder(jobFolderId, 'Plans')).id,
    isChildOf: async (folderId, parentId) => w.folders.some((f) => f.id === folderId && f.parent === parentId),
    findOrCreateFolder: async (parent, name) => {
      const found = w.folders.find((f) => f.parent === parent && f.name === name)
      if (found) return { id: found.id, created: false }
      const id = `made-${nextId++}`
      w.folders.push({ id, parent, name })
      return { id, created: true }
    },
    filesNamed: async (folder, name) => w.files.filter((f) => f.folder === folder && f.name === name).map((f) => ({ id: f.id, size: f.size })),
    upload: async (folder, bytes, name) => {
      const id = `file-${nextId++}`
      w.files.push({ id, folder, name, size: bytes.length })
      return { id }
    },
  }
  return {
    readSet: async () => w.set,
    readAttachment: async () => w.attachment,
    canWritePart: async () => w.canWrite,
    readMe: async () => w.me,
    isOnJobTeam: async (jobId) => w.team.includes(jobId),
    partOfJob: async (jobId) => w.partOf[jobId] ?? null,
    ownerJobOfPart: async () => w.ownerJob,
    jobsOnPart: async () => w.jobsOnPart,
    jobFolderOf: async (jobId) => w.jobFolders[jobId] ?? null,
    otherSetHolds: async (folderId) => w.held.includes(folderId),
    stampLink: async (setId, url) => {
      if (w.stampFails) throw new Error('The folder is made, but the set did not take its link: refused')
      w.stamps.push({ setId, url })
    },
    download: async (path) => {
      w.downloaded.push(path)
      return w.downloadFails ? null : w.bytes
    },
    decodeBase64: (b64) => (b64 === 'not-base64' ? null : new Uint8Array(Array.from(atob(b64), (c) => c.charCodeAt(0)))),
    folderIdFromUrl: (url) => /\/folders\/(.+)$/.exec(url ?? '')?.[1] ?? null,
    folderUrl: (id) => `https://drive.example/folders/${id}`,
    fileUrl: (id) => `https://drive.example/file/${id}`,
    drive: async () => {
      w.driveOpened += 1
      return w.driveOn ? drive : null
    },
  }
}

const folderAsk: PlanSetFilesAsk = { action: 'folder', setId: SET_ID }
const putAsk: PlanSetFilesAsk = { action: 'put', setId: SET_ID, name: 'photo.jpg', mime: 'image/jpeg', base64: btoa('abc') }
const mailAsk: PlanSetFilesAsk = { action: 'save_attachment', setId: SET_ID, attachmentId: ATT_ID }

const run = (ask: PlanSetFilesAsk, w: World) => runPlanSetFiles(ask, CALLER, depsOf(w))

const newest = (w: World) => w.folders[w.folders.length - 1]!

/** A refused ask opened no Drive session, or at least made nothing in it. */
function expectNothingMade(w: World) {
  expect(w.folders).toEqual([])
  expect(w.files).toEqual([])
  expect(w.stamps).toEqual([])
}

describe('the wiring in plan-set-files/index.ts', () => {
  const source = readFileSync(resolve(process.cwd(), 'supabase/functions/plan-set-files/index.ts'), 'utf8')

  it('reads the set, the mail’s file and the right to write through the caller’s client, so RLS decides: a fake cannot see this', () => {
    expect(source).toMatch(/readSet:[^\n]*anon\.from\('plan_sets'\)/)
    expect(source).toMatch(/anon\.from\('message_attachments'\)/)
    expect(source).toMatch(/anon\.rpc\('plan_part_can_write'/)
    expect(source).not.toMatch(/admin\s*\.from\('message_attachments'\)/)
  })
})

describe('parsePlanSetFilesAsk', () => {
  it('takes the three asks and refuses the rest', () => {
    expect(parsePlanSetFilesAsk({ action: 'folder', set_id: SET_ID })).toEqual({ action: 'folder', setId: SET_ID })
    expect(parsePlanSetFilesAsk({ action: 'save_attachment', set_id: SET_ID, attachment_id: ATT_ID })).toEqual({ action: 'save_attachment', setId: SET_ID, attachmentId: ATT_ID })
    expect(parsePlanSetFilesAsk({ action: 'put', set_id: SET_ID, name: ' a.jpg ', base64: 'x' })).toEqual({ action: 'put', setId: SET_ID, name: 'a.jpg', mime: 'application/octet-stream', base64: 'x' })
    expect(parsePlanSetFilesAsk(null)).toBeNull()
    expect(parsePlanSetFilesAsk({ action: 'folder', set_id: 'not-a-uuid' })).toBeNull()
    expect(parsePlanSetFilesAsk({ action: 'delete', set_id: SET_ID })).toBeNull()
    expect(parsePlanSetFilesAsk({ action: 'put', set_id: SET_ID, name: '  ' })).toBeNull()
    expect(parsePlanSetFilesAsk({ action: 'save_attachment', set_id: SET_ID, attachment_id: 'nope' })).toBeNull()
  })

  it('cuts a long file name on a whole character', () => {
    const ask = parsePlanSetFilesAsk({ action: 'put', set_id: SET_ID, name: `${'a'.repeat(199)}🙂🙂`, base64: 'x' })
    expect(ask && ask.action === 'put' ? ask.name : '').toBe(`${'a'.repeat(199)}🙂`)
  })
})

describe('the names', () => {
  it('a set’s folder has no slash, and a long name is cut on a whole character so Drive’s query can be built', () => {
    expect(planSetFolderName('A/B\\C   D')).toBe('A-B-C D')
    expect(planSetFolderName('   ')).toBe('Set')
    const cut = planSetFolderName(`${'a'.repeat(119)}🙂🙂`)
    expect(cut).toBe(`${'a'.repeat(119)}🙂`)
    expect(() => encodeURIComponent(cut)).not.toThrow()
  })

  it('counts on from the first', () => {
    expect(planSetFolderNameAt('Addendum', 1)).toBe('Addendum')
    expect(planSetFolderNameAt('Addendum', 2)).toBe('Addendum · 2')
    expect(planSetFileNameAt('plan.pdf', 1)).toBe('plan.pdf')
    expect(planSetFileNameAt('plan.pdf', 2)).toBe('plan (2).pdf')
    expect(planSetFileNameAt('notes', 3)).toBe('notes (3)')
    expect(planSetFileNameAt('.hidden', 2)).toBe('.hidden (2)')
  })
})

describe('who may file', () => {
  it('a set the caller cannot see is refused before anything else is read', async () => {
    const w = makeWorld({ set: null })
    expect(await run(folderAsk, w)).toEqual({ status: 404, body: { error: 'That set is not one you can see.' } })
    expect(w.driveOpened).toBe(0)
  })

  it('a digital twin, a training account and an account that did not read change nothing', async () => {
    for (const me of [{ is_digital_twin: true }, { read_only: true }, null]) {
      const w = makeWorld({ me })
      expect((await run(folderAsk, w)).status).toBe(403)
      expect(w.driveOpened).toBe(0)
      expectNothingMade(w)
    }
  })

  it('the office files into any set it can see, on a job it is not on', async () => {
    const w = makeWorld({ canWrite: true, team: [], set: { ...makeWorld().set!, created_by: 'someone-else' } })
    expect((await run(folderAsk, w)).status).toBe(200)
  })

  it('someone who is neither the office nor the author is refused', async () => {
    const w = makeWorld({ canWrite: false, set: { ...makeWorld().set!, created_by: 'someone-else' } })
    expect((await run(folderAsk, w)).body.error).toBe('Only the office, or whoever added the set, files into it.')
    expect(w.driveOpened).toBe(0)
  })

  it('an author files into their own set on a job they are on', async () => {
    const w = makeWorld({ canWrite: false })
    expect((await run(folderAsk, w)).status).toBe(200)
  })

  it('an author who rewrote their row’s job cannot aim it at a job they are not on, or a job on another part', async () => {
    const elsewhere = makeWorld({ canWrite: false, team: ['job-a'], set: { ...makeWorld().set!, job_id: 'job-b' }, jobFolders: { 'job-b': { google_drive_link: JOB_LINK, drive_folder_hold: null } } })
    expect((await run(folderAsk, elsewhere)).body.error).toBe('You file only into a set on a job you are on.')
    expect(elsewhere.driveOpened).toBe(0)
    const otherPart = makeWorld({ canWrite: false, team: ['job-other'], set: { ...makeWorld().set!, job_id: 'job-other' } })
    expect((await run(folderAsk, otherPart)).status).toBe(403)
    const noJob = makeWorld({ canWrite: false, set: { ...makeWorld().set!, job_id: null } })
    expect((await run(folderAsk, noJob)).status).toBe(403)
    expectNothingMade(elsewhere)
  })

  it('an author cannot reach a mail’s file: the read goes through their own client, and RLS hides the row', async () => {
    const w = makeWorld({ canWrite: false, attachment: null })
    expect(await run(mailAsk, w)).toEqual({ status: 404, body: { error: 'That file is not one we kept.' } })
    expect(w.downloaded).toEqual([])
    expectNothingMade(w)
  })

  it('a read that fails is an error with its reason, never a refusal that reads as an answer', async () => {
    const deps = depsOf(makeWorld())
    await expect(runPlanSetFiles(folderAsk, CALLER, { ...deps, jobFolderOf: () => Promise.reject(new Error('The job did not read: timeout')) })).rejects.toThrow('The job did not read: timeout')
    await expect(runPlanSetFiles(folderAsk, CALLER, { ...deps, canWritePart: () => Promise.reject(new Error('Who may write this part did not read: timeout')) })).rejects.toThrow('did not read')
  })
})

describe('which job’s folder holds the set', () => {
  const noJobOnSet = () => ({ ...makeWorld().set!, job_id: null })
  const folderOf = (id: string) => ({ google_drive_link: `https://drive.example/folders/${id}`, drive_folder_hold: null })

  it('the part’s own job when the set names none', async () => {
    const w = makeWorld({ set: noJobOnSet(), ownerJob: 'job-b', jobFolders: { 'job-b': folderOf('folder-b') } })
    await run(folderAsk, w)
    expect(w.folders[0]).toMatchObject({ parent: 'folder-b', name: 'Plans' })
  })

  it('the oldest job on the part with a Drive folder, past an older one with none', async () => {
    const w = makeWorld({
      set: noJobOnSet(),
      jobsOnPart: [
        { id: 'job-old', google_drive_link: null },
        { id: 'job-b', google_drive_link: 'https://drive.example/folders/folder-b' },
      ],
      jobFolders: { 'job-b': folderOf('folder-b') },
    })
    expect((await run(folderAsk, w)).status).toBe(200)
    expect(w.folders[0]).toMatchObject({ parent: 'folder-b', name: 'Plans' })
  })

  it('says so when no job names the part, and when the job has no folder or a held one, and makes nothing', async () => {
    const none = makeWorld({ set: noJobOnSet() })
    expect((await run(folderAsk, none)).body.why).toBe('no_job')
    const noFolder = makeWorld({ jobFolders: { 'job-a': { google_drive_link: null, drive_folder_hold: null } } })
    const reply = await run(folderAsk, noFolder)
    expect(reply.body.why).toBe('no_folder')
    expect(reply.body.error).toBe('That job has no Drive folder yet. The Documents tab says when the sweep makes one. Then try again.')
    const held = makeWorld({ jobFolders: { 'job-a': { google_drive_link: null, drive_folder_hold: 'Pick the customer first' } } })
    expect((await run(folderAsk, held)).body.error).toBe('The job’s Drive folder is held: Pick the customer first')
    for (const w of [none, noFolder, held]) {
      expect(w.driveOpened).toBe(0)
      expectNothingMade(w)
    }
  })

  it('says so when Drive is not set up here', async () => {
    const w = makeWorld({ driveOn: false })
    expect(await run(folderAsk, w)).toEqual({ status: 503, body: { error: 'Drive is not set up here yet.' } })
  })
})

describe('the set’s folder', () => {
  it('makes Plans › the set’s name, and a set with no link takes the folder’s', async () => {
    const w = makeWorld()
    const reply = await run(folderAsk, w)
    expect(w.folders.map((f) => f.name)).toEqual(['Plans', 'As-built · JP972 · 2026-11-02'])
    expect(reply.body).toEqual({ folderId: 'made-2', url: 'https://drive.example/folders/made-2', made: true })
    expect(w.stamps).toEqual([{ setId: SET_ID, url: 'https://drive.example/folders/made-2' }])
  })

  it('a set whose link already sits inside Plans keeps it and stamps nothing', async () => {
    const w = makeWorld({ folders: [{ id: 'plans', parent: JOB_FOLDER, name: 'Plans' }, { id: 'renamed-one', parent: 'plans', name: 'An older name' }] })
    w.set!.link = 'https://drive.example/folders/renamed-one'
    const reply = await run(folderAsk, w)
    expect(reply.body).toMatchObject({ folderId: 'renamed-one', made: false })
    expect(w.stamps).toEqual([])
    expect(w.folders).toHaveLength(2)
  })

  it('a set whose link is somewhere else keeps that link and still gets its own folder here', async () => {
    const w = makeWorld()
    w.set!.link = 'https://drive.example/folders/the-gcs-drive'
    expect((await run(folderAsk, w)).body).toMatchObject({ made: true })
    expect(w.stamps).toEqual([])
  })

  it('two sets of one name keep two folders: a folder another set’s link holds is that set’s', async () => {
    const taken = { id: 'theirs', parent: 'plans', name: 'As-built · JP972 · 2026-11-02' }
    const w = makeWorld({ folders: [{ id: 'plans', parent: JOB_FOLDER, name: 'Plans' }, taken], held: ['theirs'] })
    const reply = await run(folderAsk, w)
    expect(newest(w)).toMatchObject({ parent: 'plans', name: 'As-built · JP972 · 2026-11-02 · 2' })
    expect(reply.body.folderId).toBe(newest(w).id)
    expect(w.stamps[0]!.url).toContain(newest(w).id)
  })

  it('a folder of its name no set holds is its own, as after a stamp that failed', async () => {
    const w = makeWorld({ stampFails: true })
    await expect(run(folderAsk, w)).rejects.toThrow('the set did not take its link')
    const made = newest(w)
    w.stampFails = false
    const reply = await run(folderAsk, w)
    expect(reply.body).toMatchObject({ folderId: made.id, made: false })
    expect(w.stamps).toEqual([{ setId: SET_ID, url: `https://drive.example/folders/${made.id}` }])
  })
})

describe('a file from the phone or this computer', () => {
  it('lands in the set’s folder under the name given', async () => {
    const w = makeWorld()
    const reply = await run(putAsk, w)
    const folder = newest(w)
    expect(w.files).toEqual([expect.objectContaining({ folder: folder.id, name: 'photo.jpg', size: 3 })])
    expect(reply.body).toMatchObject({ url: `https://drive.example/file/${w.files[0]!.id}`, folderUrl: `https://drive.example/folders/${folder.id}` })
  })

  it('a name the folder holds takes the next, so a later batch of one day reads apart', async () => {
    const w = makeWorld()
    await run(putAsk, w)
    w.set!.link = w.stamps[0]!.url
    await run(putAsk, w)
    expect(w.files.map((f) => f.name)).toEqual(['photo.jpg', 'photo (2).jpg'])
  })

  it('a file over the cap or one that did not come through is refused, and no folder is made for it', async () => {
    const big = makeWorld()
    const tooLong: PlanSetFilesAsk = { ...putAsk, action: 'put', name: 'a.jpg', mime: 'image/jpeg', base64: 'x'.repeat(Math.ceil((PLAN_SET_PUT_MAX_BYTES * 4) / 3) + 201) }
    expect((await run(tooLong, big)).status).toBe(413)
    const decodedBig = makeWorld()
    expect((await runPlanSetFiles(putAsk, CALLER, { ...depsOf(decodedBig), decodeBase64: () => new Uint8Array(PLAN_SET_PUT_MAX_BYTES + 1) })).status).toBe(413)
    const bad = makeWorld()
    expect(await run({ ...putAsk, action: 'put', name: 'a.jpg', mime: 'image/jpeg', base64: 'not-base64' }, bad)).toEqual({ status: 400, body: { error: 'That file did not come through.' } })
    const empty = makeWorld()
    expect((await run({ ...putAsk, action: 'put', name: 'a.jpg', mime: 'image/jpeg', base64: '' }, empty)).status).toBe(400)
    for (const w of [big, decodedBig, bad, empty]) {
      expect(w.driveOpened).toBe(0)
      expectNothingMade(w)
    }
  })
})

describe('a mail’s file', () => {
  it('lands in the set’s folder from our copy', async () => {
    const w = makeWorld()
    const reply = await run(mailAsk, w)
    expect(w.downloaded).toEqual(['gm/1-spec-book.pdf'])
    expect(w.files).toEqual([expect.objectContaining({ name: 'spec-book.pdf', size: 3 })])
    expect(reply.status).toBe(200)
    expect(reply.body.reused).toBeUndefined()
  })

  it('a mail tagged to another job on the same part is the same register', async () => {
    const w = makeWorld({ attachment: { ...makeWorld().attachment!, jobs_ledger_id: 'job-b' } })
    expect((await run(mailAsk, w)).status).toBe(200)
  })

  it('refuses a file that stayed in Gmail, a link, a mail on another part or on no job, and our copy not reading, and makes no empty folder for any of them', async () => {
    const att = makeWorld().attachment!
    const cases: Array<[Partial<World>, number, string]> = [
      [{ attachment: { ...att, bucket_path: null } }, 409, 'That file stayed in Gmail, so we hold no copy of it to file.'],
      [{ attachment: { ...att, kind: 'link' } }, 404, 'That file is not one we kept.'],
      [{ attachment: { ...att, jobs_ledger_id: 'job-other' } }, 409, 'That mail is not tagged to a job on this set’s part.'],
      [{ attachment: { ...att, jobs_ledger_id: null } }, 409, 'That mail is not tagged to a job on this set’s part.'],
      [{ downloadFails: true }, 500, 'Our copy of that file did not read.'],
    ]
    for (const [over, status, error] of cases) {
      const w = makeWorld(over)
      expect(await run(mailAsk, w)).toEqual({ status, body: { error } })
      expectNothingMade(w)
    }
  })

  it('a second try finds the file that landed and files nothing twice', async () => {
    const w = makeWorld()
    await run(mailAsk, w)
    w.set!.link = w.stamps[0]!.url
    const reply = await run(mailAsk, w)
    expect(w.files).toHaveLength(1)
    expect(reply.body).toMatchObject({ driveFileId: w.files[0]!.id, reused: true })
  })

  it('a second file of one name and another size is its own file, and lands beside the first', async () => {
    const w = makeWorld()
    await run(mailAsk, w)
    w.set!.link = w.stamps[0]!.url
    w.bytes = new Uint8Array([1, 2, 3, 4, 5])
    const reply = await run(mailAsk, w)
    expect(w.files.map((f) => f.name)).toEqual(['spec-book.pdf', 'spec-book (2).pdf'])
    expect(reply.body.reused).toBeUndefined()
  })
})
