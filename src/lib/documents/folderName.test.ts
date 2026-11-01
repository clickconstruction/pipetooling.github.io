import { describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_KEY_DRIVE_BID_FOLDER_PATTERN,
  APP_SETTINGS_KEY_DRIVE_FOLDERS_MADE,
  APP_SETTINGS_KEY_DRIVE_JOB_FOLDER_PATTERN,
  APP_SETTINGS_KEY_DRIVE_JOBS_ROOT_FOLDER_ID,
} from '../appSettingsKeys'
import { plainWordsFailures } from '../plainWords'
import {
  bidFolderName,
  customerFolderName,
  customerFolderNameApart,
  DEFAULT_BID_FOLDER_PATTERN,
  DEFAULT_JOB_FOLDER_PATTERN,
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  driveFolderIdFromLinkOrId,
  driveSafeName,
  driveFailWords,
  driveSettingsFromRows,
  FOLDER_NAME_MAX,
  folderPathWords,
  folderName,
  folderPatternJson,
  JOB_FOLDER_PIECE_LABELS,
  JOB_FOLDER_PIECES,
  NO_CUSTOMER_FOLDER_NAME,
  outsideDriveWords,
  parseBidFolderPattern,
  parseFoldersMade,
  parseJobFolderPattern,
  placeFolder,
  tidyOutcomeWords,
  writeCheckWords,
} from './folderName'

const job = { id: '7d759246-8476-4a37-884f-ed1562d5663f', number: '972', name: 'Oak Hollow Bldg C', customer: 'Oak Hollow HOA', address: '14 Oak Hollow Dr', year: 2026 }

describe('folderName', () => {
  it('names a job by the pieces in the pattern’s order, joined by the dot', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, job)).toBe('972 · Oak Hollow Bldg C')
    expect(folderName(['name', 'number'], job)).toBe('Oak Hollow Bldg C · 972')
    expect(folderName(['year', 'number', 'customer', 'address'], job)).toBe('2026 · 972 · Oak Hollow HOA · 14 Oak Hollow Dr')
  })

  it('skips a piece the job has no value for, and names a job with none of them by its id', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: null })).toBe('972')
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, number: '  ' })).toBe('Oak Hollow Bldg C')
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { id: job.id })).toBe('Job 7d759246')
  })

  it('keeps the name Drive-safe as v2.6054’s press did: no backslashes, one space between words, capped', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: ' Oak\\Hollow   Bldg\tC ' })).toBe('972 · Oak Hollow Bldg C')
    expect(driveSafeName('a\u0000b\u001fc')).toBe('a b c')
    const long = folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: 'x'.repeat(200) })
    expect(long.length).toBeLessThanOrEqual(FOLDER_NAME_MAX)
    expect(long.startsWith('972 · xxx')).toBe(true)
  })

  it('names a bid by the project name as drive-intake did, or by its number when the pieces are empty', () => {
    const bid = { id: 'b1f3a0d2-0000-4000-8000-000000000000', project: 'Oak Hollow Bldg C', number: 482, customer: 'Oak Hollow HOA', address: null, year: 2026 }
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, bid)).toBe('Oak Hollow Bldg C')
    expect(bidFolderName(['number', 'project'], bid)).toBe('482 · Oak Hollow Bldg C')
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, { ...bid, project: '' })).toBe('Bid 482')
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, { id: bid.id })).toBe('Bid b1f3a0d2')
  })

  it('labels every piece in the tray, in plain words', () => {
    for (const p of JOB_FOLDER_PIECES) expect(JOB_FOLDER_PIECE_LABELS[p].length).toBeGreaterThan(2)
  })
})

describe('the stored pattern', () => {
  it('reads a JSON list, drops a piece it does not know and a repeat, and falls back when nothing is left', () => {
    expect(parseJobFolderPattern('["name","number"]')).toEqual(['name', 'number'])
    expect(parseJobFolderPattern('["number","name","number","color"]')).toEqual(['number', 'name'])
    expect(parseJobFolderPattern('["color"]')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern('not json')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern('{"a":1}')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern(null)).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseBidFolderPattern('["number","project"]')).toEqual(['number', 'project'])
    expect(parseBidFolderPattern('["name"]')).toEqual([...DEFAULT_BID_FOLDER_PATTERN])
  })

  it('round-trips through its stored form', () => {
    expect(parseJobFolderPattern(folderPatternJson(['year', 'number']))).toEqual(['year', 'number'])
  })

  it('reads the folders-made choice, upfront unless as-needed is stored', () => {
    expect(parseFoldersMade('as-needed')).toBe('as-needed')
    expect(parseFoldersMade('upfront')).toBe('upfront')
    expect(parseFoldersMade('later')).toBe('upfront')
    expect(parseFoldersMade(null)).toBe('upfront')
  })
})

describe('driveSettingsFromRows', () => {
  it('takes the setting’s root, else the env’s, and says which', () => {
    const rows = [
      { key: DRIVE_JOBS_ROOT_FOLDER_ID_KEY, value_text: '1AAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      { key: DRIVE_JOB_FOLDER_PATTERN_KEY, value_text: '["year","number"]' },
      { key: DRIVE_FOLDERS_MADE_KEY, value_text: 'as-needed' },
    ]
    expect(driveSettingsFromRows(rows, '1EEEEEEEEEEEEEEEEEEEEEEEEEEE')).toEqual({
      rootFolderId: '1AAAAAAAAAAAAAAAAAAAAAAAAAAA',
      rootFrom: 'setting',
      jobPattern: ['year', 'number'],
      bidPattern: [...DEFAULT_BID_FOLDER_PATTERN],
      foldersMade: 'as-needed',
    })
    expect(driveSettingsFromRows([], '1EEEEEEEEEEEEEEEEEEEEEEEEEEE')).toMatchObject({ rootFolderId: '1EEEEEEEEEEEEEEEEEEEEEEEEEEE', rootFrom: 'env', jobPattern: ['number', 'name'], foldersMade: 'upfront' })
    expect(driveSettingsFromRows([{ key: DRIVE_JOBS_ROOT_FOLDER_ID_KEY, value_text: '  ' }], undefined)).toMatchObject({ rootFolderId: null, rootFrom: null })
  })

  it('uses the keys the app’s settings file names, so the page and the functions read one row', () => {
    expect(DRIVE_JOBS_ROOT_FOLDER_ID_KEY).toBe(APP_SETTINGS_KEY_DRIVE_JOBS_ROOT_FOLDER_ID)
    expect(DRIVE_JOB_FOLDER_PATTERN_KEY).toBe(APP_SETTINGS_KEY_DRIVE_JOB_FOLDER_PATTERN)
    expect(DRIVE_BID_FOLDER_PATTERN_KEY).toBe(APP_SETTINGS_KEY_DRIVE_BID_FOLDER_PATTERN)
    expect(DRIVE_FOLDERS_MADE_KEY).toBe(APP_SETTINGS_KEY_DRIVE_FOLDERS_MADE)
  })
})

describe('the write check', () => {
  const email = 'drive-intake@example.iam.gserviceaccount.com'

  it('reads a folder link or a bare id, and nothing else', () => {
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA?usp=sharing')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/drive/u/1/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId(' 1AAAAAAAAAAAAAAAAAAAAAAAAAAA ')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAA/view')).toBeNull()
    expect(driveFolderIdFromLinkOrId('short')).toBeNull()
    expect(driveFolderIdFromLinkOrId('')).toBeNull()
  })

  it('answers in the same words everywhere: the app can write here, or Drive’s refusal with the account to share with', () => {
    expect(writeCheckWords({ kind: 'ok' }, email)).toEqual({ ok: true, words: 'The app can write here.' })
    expect(writeCheckWords({ kind: 'cannot_write' }, email)).toEqual({ ok: false, words: `The app can open this folder but cannot add a file to it. Share it with ${email} as an editor.` })
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: null }, email).words).toBe(`The app cannot open this folder. Drive answered 404. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'cannot_open', status: 403, reason: 'The caller does not have permission' }, email).words).toContain('Drive answered 403: The caller does not have permission.')
    // Drive's own reason ends in a period (v2.6073): the sentence keeps one.
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: 'File not found: 1AAAAAAAAAAAAAAAAAAAAAAAAAAA.' }, email).words).toBe(`The app cannot open this folder. Drive answered 404: File not found: 1AAAAAAAAAAAAAAAAAAAAAAAAAAA. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: ' . ' }, email).words).toBe(`The app cannot open this folder. Drive answered 404. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'not_a_folder' }, email).ok).toBe(false)
    expect(writeCheckWords({ kind: 'no_link' }, email).words).toBe('Paste a Drive folder link first.')
  })

  it('keeps every answer in plain words', () => {
    const seen = [{ kind: 'ok' }, { kind: 'no_link' }, { kind: 'not_a_folder' }, { kind: 'cannot_write' }, { kind: 'cannot_open', status: 403, reason: null }, { kind: 'outside_drive', owner: 'taunya' }, { kind: 'outside_drive', owner: null }] as const
    for (const s of seen) expect(plainWordsFailures(writeCheckWords(s, 'robot@example.com').words)).toEqual([])
  })

  it('fails a folder in a My Drive, naming whose, since the app can make folders there but never own a file (J1091, 2026-11-01)', () => {
    const r = writeCheckWords({ kind: 'outside_drive', owner: 'taunya' }, email)
    expect(r.ok).toBe(false)
    expect(r.words).toBe('This folder is in taunya’s My Drive, where the app can make folders but cannot save a file. Move it into the app’s Shared Drive, or clear the link and press Make the job’s Drive folders.')
    expect(writeCheckWords({ kind: 'outside_drive', owner: null }, email).words).toContain('in a My Drive')
    expect(outsideDriveWords('taunya')).toBe(r.words)
  })

  it('reads Drive’s quota refusal as the folder being outside the Shared Drive, and leaves any other reason as it is', () => {
    const google = 'Upload failed (403): Service Accounts do not have storage quota. Leverage shared drives (https://developers.google.com/workspace/drive/api/guides/about-shareddrives), or use OAuth delegation instead.'
    expect(driveFailWords(google)).toBe(outsideDriveWords(null))
    expect(driveFailWords('Our copy of that photo did not read.')).toBe('Our copy of that photo did not read.')
  })
})

describe('the tree under the customer (v2.6284)', () => {
  it('names a customer’s folder by the customer, Drive-safe, or by the id when the name is empty; the apart form adds the id', () => {
    expect(customerFolderName({ id: '30d29df1-16ca-4834-a47f-5f7baa1617fa', name: ' Achilles-  Austin ' })).toBe('Achilles- Austin')
    expect(customerFolderName({ id: '30d29df1-16ca-4834-a47f-5f7baa1617fa', name: '' })).toBe('Customer 30d29df1')
    expect(customerFolderName({ id: '30d29df1-16ca-4834-a47f-5f7baa1617fa', name: null })).toBe('Customer 30d29df1')
    expect(customerFolderNameApart({ id: '30d29df1-16ca-4834-a47f-5f7baa1617fa', name: 'Smith' })).toBe('Smith · 30d29df1')
    expect(customerFolderName({ id: 'x'.repeat(36), name: 'a'.repeat(300) })).toHaveLength(FOLDER_NAME_MAX)
    expect(NO_CUSTOMER_FOLDER_NAME).toBe('No customer yet')
  })

  it('places a folder: in place, a move, a rename, both, or a hold outside the Shared Drive', () => {
    const wanted = { parentId: 'customer-folder', name: '972 · Oak Hollow Bldg C' }
    const seen = { id: 'f', name: '972 · Oak Hollow Bldg C', parentId: 'customer-folder', inDrive: true, owner: null }
    expect(placeFolder(seen, wanted)).toEqual({ act: 'in_place' })
    expect(placeFolder({ ...seen, parentId: 'jobs-root' }, wanted)).toEqual({ act: 'move' })
    expect(placeFolder({ ...seen, name: '_Oak Hollow' }, wanted)).toEqual({ act: 'rename' })
    expect(placeFolder({ ...seen, parentId: 'jobs-root', name: '_Oak Hollow' }, wanted)).toEqual({ act: 'move_rename' })
    const held = placeFolder({ ...seen, parentId: 'click-customers', inDrive: false, owner: 'taunya' }, wanted)
    expect(held).toEqual({ act: 'hold', kind: 'outside_drive', why: outsideDriveWords('taunya') })
    // Outside the drive, the place and the name do not matter: it is never moved or renamed.
    expect(placeFolder({ ...seen, inDrive: false }, wanted).act).toBe('hold')
  })

  it('writes the path and the sweep’s line', () => {
    expect(folderPathWords(['Jobs', 'Oak Hollow HOA', '972 · Oak Hollow Bldg C'])).toBe('Jobs › Oak Hollow HOA › 972 · Oak Hollow Bldg C')
    expect(folderPathWords(['Jobs', null, '', '972'])).toBe('Jobs › 972')
    expect(tidyOutcomeWords({ looked: 25, made: 3, moved: 12, renamed: 4, inPlace: 4, held: 2, left: 410 })).toBe('Looked at 25 jobs: 3 folders made, 12 moved, 4 renamed, 2 held. 410 more to look at.')
    expect(tidyOutcomeWords({ looked: 1, made: 1, moved: 0, renamed: 0, inPlace: 0, held: 0, left: 0 })).toBe('Looked at 1 job: 1 folder made.')
    expect(tidyOutcomeWords({ looked: 8, made: 0, moved: 0, renamed: 0, inPlace: 8, held: 0, left: 0 })).toBe('Looked at 8 jobs: every folder already in place.')
    expect(tidyOutcomeWords({ looked: 0, made: 0, moved: 0, renamed: 0, inPlace: 0, held: 0, left: 0 })).toBe('Looked at 0 jobs: nothing to do.')
    for (const line of [tidyOutcomeWords({ looked: 25, made: 3, moved: 12, renamed: 4, inPlace: 4, held: 2, left: 410 }), outsideDriveWords('taunya')]) expect(plainWordsFailures(line)).toEqual([])
  })
})
