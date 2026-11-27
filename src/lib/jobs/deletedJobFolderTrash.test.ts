/**
 * A deleted ZZ test job's Drive folder to the trash (punch list #443, row 18): the rule the `job-drive-folders`
 * function's `trash` body decides by, read from its one copy under `supabase/functions/_shared/`. Made-up ids.
 */
import { describe, expect, it } from 'vitest'
import {
  JOB_FOLDER_TRASH_ROLE,
  countInside,
  deletedJobFacts,
  lookInsideFolder,
  madeByTheApp,
  trashCallerRefusal,
  trashFolderVerdict,
  trashHoldersRefusal,
  trashInsideRefusal,
  trashJobRefusal,
  trashLinkNothing,
  trashNoteWords,
  trashedWords,
  type TrashFolderSeen,
  type TrashListedItem,
} from '../../../supabase/functions/_shared/deletedJobFolderTrash'

const ROOT = 'root-folder-id'
const CUSTOMER = 'customer-folder-id'
const APP = 'app-account@zz-test.example'
const zz = { job_name: 'ZZ Test walk job', customer_name: 'Ridge Builders', google_drive_link: 'https://drive.google.com/drive/folders/job-folder-id' }
const folder = (over: Partial<Extract<TrashFolderSeen, { kind: 'folder' }>> = {}): TrashFolderSeen => ({
  kind: 'folder',
  id: 'job-folder-id',
  name: '1113 · ZZ Test walk job',
  parentId: CUSTOMER,
  grandparentId: ROOT,
  inDrive: true,
  trashed: false,
  canTrash: true,
  ...over,
})
const file = (byMe: boolean | null, byEmail: string | null = null, id = 'f'): TrashListedItem => ({ id, isFolder: false, byMe, byEmail })
const dir = (id: string): TrashListedItem => ({ id, isFolder: true, byMe: true, byEmail: null })

describe('trashCallerRefusal', () => {
  it('lets a dev ask and nobody else', () => {
    expect(JOB_FOLDER_TRASH_ROLE).toBe('dev')
    expect(trashCallerRefusal('dev')).toBeNull()
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', '', null, undefined]) {
      expect(trashCallerRefusal(role)).toEqual({ status: 403, why: 'dev_only', words: 'Only a developer moves a test job’s folder to the trash.' })
    }
  })
})

describe('deletedJobFacts', () => {
  it('reads the three columns from a kept row and nothing else', () => {
    expect(deletedJobFacts({ id: 'x', job_name: 'ZZ a', customer_name: null, google_drive_link: 'link', revenue: 5 })).toEqual({ job_name: 'ZZ a', customer_name: null, google_drive_link: 'link' })
  })
  it('answers null for no row, and null columns for anything that is not text', () => {
    expect(deletedJobFacts(null)).toBeNull()
    expect(deletedJobFacts('row')).toBeNull()
    expect(deletedJobFacts({ job_name: 7, customer_name: {}, google_drive_link: [] })).toEqual({ job_name: null, customer_name: null, google_drive_link: null })
  })
})

describe('trashJobRefusal', () => {
  it('lets a deleted ZZ job through, by its own name or its customer’s', () => {
    expect(trashJobRefusal(false, zz)).toBeNull()
    expect(trashJobRefusal(false, { job_name: 'Bldg C', customer_name: 'zz test customer', google_drive_link: null })).toBeNull()
  })
  it('refuses a job that still stands, before anything else', () => {
    expect(trashJobRefusal(true, zz)).toEqual({ status: 409, why: 'job_stands', words: 'This job is still here. Delete the job first. Its Drive folder then goes to the trash.' })
    expect(trashJobRefusal(true, null)?.why).toBe('job_stands')
  })
  it('refuses a job Deleted records keeps no copy of', () => {
    expect(trashJobRefusal(false, null)).toEqual({ status: 404, why: 'no_deleted_job', words: 'Deleted records keeps no copy of that job, so its folder cannot be found. Nothing went to the trash.' })
  })
  it('refuses a job that was not named ZZ', () => {
    for (const real of [
      { job_name: 'Oak Hollow Bldg C', customer_name: 'Ridge Builders', google_drive_link: zz.google_drive_link },
      { job_name: 'Dizzy’s remodel', customer_name: 'Pizza Co', google_drive_link: zz.google_drive_link },
      { job_name: null, customer_name: null, google_drive_link: zz.google_drive_link },
    ]) {
      expect(trashJobRefusal(false, real)).toEqual({ status: 403, why: 'not_a_test_job', words: 'Only a ZZ test job’s folder goes to the trash this way. This job was not named ZZ.' })
    }
  })
})

describe('trashLinkNothing', () => {
  it('goes on when the link is a folder’s', () => {
    expect(trashLinkNothing(zz.google_drive_link, 'job-folder-id')).toBeNull()
  })
  it('says there was no folder on record', () => {
    for (const link of [null, undefined, '', '   ']) {
      expect(trashLinkNothing(link, null)).toEqual({ act: 'none', words: 'This job had no Drive folder on record. Nothing went to the trash.' })
    }
  })
  it('says the link was not a folder’s', () => {
    expect(trashLinkNothing('https://example.com/a-page', null)).toEqual({ act: 'none', words: 'This job’s Drive link was not a folder’s. Nothing went to the trash.' })
  })
})

describe('trashFolderVerdict', () => {
  it('goes on for a job’s folder under a customer’s folder under the root, that the app may trash', () => {
    expect(trashFolderVerdict(folder(), ROOT, APP)).toBeNull()
  })
  it('says a folder already gone is gone, and one already in the trash is there: neither is a refusal', () => {
    expect(trashFolderVerdict({ kind: 'gone' }, ROOT, APP)).toEqual({ act: 'gone', words: 'Its Drive folder is already gone, or the app can no longer open it. Nothing went to the trash.' })
    expect(trashFolderVerdict(folder({ trashed: true }), ROOT, APP)).toEqual({ act: 'already', words: 'Its Drive folder is already in Drive’s trash.' })
    expect(trashFolderVerdict({ kind: 'not_a_folder' }, ROOT, APP)).toEqual({ act: 'none', words: 'This job’s Drive link was not a folder’s. Nothing went to the trash.' })
  })
  it('never takes the jobs root or a folder straight under it', () => {
    const words = 'The link pointed at the jobs root or a customer’s folder, not a job’s folder. It stays.'
    expect(trashFolderVerdict(folder({ id: ROOT, parentId: 'drive-top', grandparentId: null }), ROOT, APP)).toEqual({ status: 409, why: 'not_a_job_folder', words })
    expect(trashFolderVerdict(folder({ id: CUSTOMER, parentId: ROOT, grandparentId: 'drive-top' }), ROOT, APP)).toEqual({ status: 409, why: 'not_a_job_folder', words })
  })
  it('never takes a folder in a My Drive', () => {
    expect(trashFolderVerdict(folder({ inDrive: false }), ROOT, APP)).toEqual({ status: 409, why: 'outside_drive', words: 'The folder is in a My Drive, not the app’s Shared Drive. It stays for its owner.' })
  })
  it('never takes a folder that sits anywhere but under a folder of the root', () => {
    const words = 'The folder is not under a customer’s folder in the jobs root. It stays.'
    expect(trashFolderVerdict(folder({ grandparentId: 'somewhere-else' }), ROOT, APP)).toEqual({ status: 409, why: 'outside_tree', words })
    expect(trashFolderVerdict(folder({ grandparentId: null }), ROOT, APP)).toEqual({ status: 409, why: 'outside_tree', words })
    expect(trashFolderVerdict(folder({ parentId: null, grandparentId: null }), ROOT, APP)).toEqual({ status: 409, why: 'outside_tree', words })
  })
  it('says who to make a content manager when Drive does not let the app trash it', () => {
    expect(trashFolderVerdict(folder({ canTrash: false }), ROOT, APP)).toEqual({
      status: 409,
      why: 'cannot_trash',
      words: `Drive does not let the app move this folder to the trash. Make ${APP} a content manager of the Shared Drive.`,
    })
    expect(trashFolderVerdict(folder({ canTrash: false }), ROOT, '')?.words).toContain('Make the app’s account a content manager')
  })
  it('reads a folder in the trash as already there before it reads where it sits', () => {
    expect(trashFolderVerdict(folder({ trashed: true, inDrive: false, grandparentId: null }), ROOT, APP)).toEqual({ act: 'already', words: 'Its Drive folder is already in Drive’s trash.' })
  })
})

describe('trashHoldersRefusal', () => {
  it('goes on when no live record names the folder', () => {
    expect(trashHoldersRefusal({ jobs: 0, bids: 0, customers: 0 })).toBeNull()
  })
  it('keeps a folder a bid still keeps: a job made from a bid takes the bid’s own folder', () => {
    expect(trashHoldersRefusal({ jobs: 0, bids: 1, customers: 0 })).toEqual({ status: 409, why: 'in_use', words: '1 bid still keeps this folder. It stays.' })
  })
  it('names each kind with its count', () => {
    expect(trashHoldersRefusal({ jobs: 2, bids: 0, customers: 0 })?.words).toBe('2 jobs still keep this folder. It stays.')
    expect(trashHoldersRefusal({ jobs: 1, bids: 1, customers: 0 })?.words).toBe('1 bid and 1 job still keep this folder. It stays.')
    expect(trashHoldersRefusal({ jobs: 1, bids: 2, customers: 1 })?.words).toBe('2 bids, 1 job and 1 customer still keep this folder. It stays.')
    expect(trashHoldersRefusal({ jobs: 0, bids: 0, customers: 1 })?.words).toBe('1 customer still keeps this folder. It stays.')
  })
})

describe('madeByTheApp and countInside', () => {
  it('counts a thing as the app’s when Drive says the asking account changed it last, or names that account', () => {
    expect(madeByTheApp({ byMe: true, byEmail: null }, APP)).toBe(true)
    expect(madeByTheApp({ byMe: false, byEmail: APP.toUpperCase() }, APP)).toBe(true)
    expect(madeByTheApp({ byMe: null, byEmail: ` ${APP} ` }, APP)).toBe(true)
  })
  it('counts a thing as a person’s when another account changed it, or Drive does not say', () => {
    expect(madeByTheApp({ byMe: false, byEmail: 'someone@zz-test.example' }, APP)).toBe(false)
    expect(madeByTheApp({ byMe: null, byEmail: null }, APP)).toBe(false)
    expect(madeByTheApp({ byMe: false, byEmail: '' }, '')).toBe(false)
  })
  it('counts folders and files, and only files toward a person’s', () => {
    expect(countInside([dir('a'), { ...dir('b'), byMe: false }, file(true), file(false, 'someone@zz-test.example'), file(null)], APP)).toEqual({ folders: 2, files: 3, byPeople: 2, cut: false })
    expect(countInside([], APP, true)).toEqual({ folders: 0, files: 0, byPeople: 0, cut: true })
  })
})

describe('lookInsideFolder', () => {
  const tree: Record<string, TrashListedItem[][]> = {
    'job-folder-id': [[dir('pictures'), dir('plans'), dir('team')]],
    pictures: [[file(true, null, 'p1')], [file(true, null, 'p2')]],
    plans: [[]],
    team: [[dir('photos'), dir('sent')]],
    photos: [[file(true, null, 'ph1')]],
    sent: [[]],
  }
  const lister = (calls: string[], from = tree) => async (parentId: string, pageToken: string) => {
    calls.push(`${parentId}:${pageToken}`)
    const pages = from[parentId] ?? [[]]
    const at = pageToken ? Number(pageToken) : 0
    return { items: pages[at] ?? [], next: at + 1 < pages.length ? String(at + 1) : '' }
  }

  it('reads the job’s folder and every folder inside, page by page', async () => {
    const calls: string[] = []
    expect(await lookInsideFolder(lister(calls), 'job-folder-id', APP)).toEqual({ folders: 5, files: 3, byPeople: 0, cut: false })
    expect(calls).toEqual(['job-folder-id:', 'pictures:', 'pictures:1', 'plans:', 'team:', 'photos:', 'sent:'])
  })
  it('counts a file a person added, wherever it sits', async () => {
    const withOne = { ...tree, sent: [[file(false, 'someone@zz-test.example', 's1')]] }
    expect(await lookInsideFolder(lister([], withOne), 'job-folder-id', APP)).toEqual({ folders: 5, files: 4, byPeople: 1, cut: false })
  })
  it('gives up past the folder cap and says so', async () => {
    const calls: string[] = []
    const out = await lookInsideFolder(lister(calls), 'job-folder-id', APP, { folders: 2, items: 2000 })
    expect(out.cut).toBe(true)
    expect(calls).toEqual(['job-folder-id:', 'pictures:', 'pictures:1'])
  })
  it('gives up past the item cap and says so', async () => {
    const out = await lookInsideFolder(lister([]), 'job-folder-id', APP, { folders: 60, items: 2 })
    expect(out.cut).toBe(true)
  })
  it('throws on when a listing fails, so nothing is decided on half a look', async () => {
    const failing = async () => {
      throw new Error('Drive answered 500')
    }
    await expect(lookInsideFolder(failing, 'job-folder-id', APP)).rejects.toThrow('Drive answered 500')
  })
})

describe('trashInsideRefusal and trashedWords', () => {
  it('goes on when everything inside is the app’s own', () => {
    expect(trashInsideRefusal({ folders: 5, files: 3, byPeople: 0, cut: false })).toBeNull()
    expect(trashInsideRefusal({ folders: 0, files: 0, byPeople: 0, cut: false })).toBeNull()
  })
  it('keeps a folder that holds a file a person added, and counts them', () => {
    expect(trashInsideRefusal({ folders: 5, files: 4, byPeople: 1, cut: false })).toEqual({
      status: 409,
      why: 'holds_a_persons_files',
      words: 'A person added or changed 1 file in this folder by hand. It stays. Move them out, or trash it in Drive.',
    })
    expect(trashInsideRefusal({ folders: 5, files: 4, byPeople: 3, cut: true })?.words).toBe('A person added or changed 3 files in this folder by hand. It stays. Move them out, or trash it in Drive.')
  })
  it('keeps a folder too large to read whole', () => {
    expect(trashInsideRefusal({ folders: 60, files: 10, byPeople: 0, cut: true })).toEqual({ status: 409, why: 'too_much_to_check', words: 'The folder holds more than the app reads in one go. It stays. Trash it in Drive by hand.' })
  })
  it('writes a note on the folder that says why it is in the trash and which job it was, with no person’s name', () => {
    expect(trashNoteWords('11111111-1111-4111-8111-111111111111', '2026-11-27')).toBe('Moved to the trash by PipeTooling on 2026-11-27, when a developer deleted its ZZ test job. Job id 11111111-1111-4111-8111-111111111111.')
  })
  it('says what went to the trash and how long it can come back', () => {
    expect(trashedWords({ folders: 5, files: 3 })).toBe('Its Drive folder went to Drive’s trash, with the 5 folders and 3 files inside. A manager of the Shared Drive can restore it for 30 days.')
    expect(trashedWords({ folders: 1, files: 0 })).toBe('Its Drive folder went to Drive’s trash, with the 1 folder inside. A manager of the Shared Drive can restore it for 30 days.')
    expect(trashedWords({ folders: 0, files: 0 })).toBe('Its Drive folder went to Drive’s trash. A manager of the Shared Drive can restore it for 30 days.')
  })
})
